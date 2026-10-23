const { randomUUID, createHash, createHmac } = require("node:crypto");
const {
  FieldValue,
  FieldPath,
  AggregateField,
} = require("firebase-admin/firestore");
const { Falha, idValido, uuid } = require("../alimentacao/seguranca.cjs");
const { validarArquivo } = require("./arquivos.cjs");
const hash = (v) => createHash("sha256").update(v).digest("hex");
function criarHandlerEditais({
  db,
  auth,
  b2,
  origens,
  clienteId,
  rateSecret,
  agora = () => Date.now(),
}) {
  const root = (id) => db.collection("editaisInscricoes").doc(id);
  const cfg = (id) => db.collection("editaisConfiguracao").doc(id);
  async function master(req, tx) {
    let token;
    try {
      token = await auth.verifyIdToken(
        (req.headers.authorization || "").replace(/^Bearer /, ""),
        true,
      );
    } catch {
      throw new Falha(401, "Entre como Master para continuar.");
    }
    const ref = db.doc("usuarios/" + token.uid),
      p = (await (tx ? tx.get(ref) : ref.get())).data();
    if (
      agora() / 1000 < Number(token.auth_time || 0) ||
      !p ||
      p.ativo === false ||
      !["master", "admin"].includes(p.papel) ||
      agora() / 1000 - Number(token.auth_time || 0) >= 28800 ||
      Number(token.auth_time || 0) < Number(p.sessaoRevogadaEm || 0)
    )
      throw new Falha(
        403,
        "Somente o Administrador Master pode acessar as inscrições.",
      );
    return { uid: token.uid, nome: p.nome || "Master", papel: p.papel };
  }
  async function ativo(id, tx) {
    const read = (r) => (tx ? tx.get(r) : r.get());
    const [p, c, m] = await Promise.all([
      read(db.doc("publicacoes/" + id)),
      read(cfg(id)),
      read(db.doc("operacao/estado")),
    ]);
    if (m.data()?.bloqueado)
      throw new Falha(503, "Sistema em manutenção. Aguarde.");
    if (p.data()?.tipo !== "edital")
      throw new Falha(404, "Edital não disponível.");
    const data = c.data();
    if (!data) throw new Falha(404, "Inscrições ainda não configuradas.");
    const { abertura } = await import("../../shared/editais.mjs");
    const erro = abertura(data, agora());
    if (erro) throw new Falha(409, erro);
    return data;
  }
  function cred(b) {
    if (typeof b.chave !== "string" || !/^\w{64}$/.test(b.chave))
      throw new Falha(403, "Chave de acesso inválida.");
    return hash(b.chave);
  }
  function dono(s, b) {
    if (!s || s.chaveHash !== cred(b))
      throw new Falha(403, "Inscrição não acessível.");
  }
  async function limite(req, tipo, max) {
    // x-forwarded-for é normalizado pela Vercel; no servidor local usamos o endereço da conexão.
    const ip = String(
      req.headers["x-vercel-forwarded-for"] ||
        req.headers["x-forwarded-for"] ||
        req.socket?.remoteAddress ||
        "unknown",
    )
      .split(",")[0]
      .trim();
    const dia = new Date(agora()).toISOString().slice(0, 10);
    const chave = createHmac("sha256", rateSecret).update(ip).digest("hex");
    await db.runTransaction(async (tx) => {
      const r = db.doc("limitesEditais/" + hash(tipo + dia + chave)),
        g = db.doc("limitesEditais/" + tipo + "-" + dia);
      const [s, total] = await Promise.all([tx.get(r), tx.get(g)]);
      if ((s.data()?.n || 0) >= max || (total.data()?.n || 0) >= max * 200)
        throw new Falha(
          429,
          "Limite temporário atingido. Tente novamente amanhã ou procure a SEMED.",
        );
      for (const [ref, v] of [
        [r, s],
        [g, total],
      ])
        tx.set(ref, {
          n: (v.data()?.n || 0) + 1,
          expiraEm: new Date(agora() + 3 * 86400000),
        });
    });
  }
  function audit(tx, id, u, acao, antes, depois) {
    tx.create(db.collection("auditoriaRegistros").doc(), {
      versaoEsquema: 1,
      dominio: "editais",
      colecao: "editaisInscricoes",
      documentoId: id,
      caminho: "editaisInscricoes/" + id,
      acao,
      usuarioId: u.uid,
      usuarioNome: u.nome,
      papelUsuario: u.papel,
      timestamp: FieldValue.serverTimestamp(),
      dadosAntes: antes,
      dadosDepois: depois,
    });
  }
  function publico(s, id) {
    const {
      chaveHash: _chaveHash,
      busca: _busca,
      dadosHash: _dadosHash,
      ...rest
    } = s;
    const { pdf: _pdf, ...config } = s.config;
    return {
      id,
      ...rest,
      config,
      arquivos: Object.values(s.arquivos || {})
        .filter((a) => a.estado === "pronto")
        .map(
          ({
            key: _key,
            version: _version,
            sha256: _sha256,
            nonce: _nonce,
            ...a
          }) => a,
        ),
    };
  }
  return async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      const {
        configuracao,
        validarFicha,
        normalizar,
        DECLARACAO,
        abertura,
        TIPOS_ANEXO,
      } = await import("../../shared/editais.mjs");
      if (req.method === "GET") {
        const id = idValido(req.query?.editalId),
          p = (await db.doc("publicacoes/" + id).get()).data(),
          c = (await cfg(id).get()).data();
        if (p?.tipo !== "edital" || !c)
          throw new Falha(404, "Edital não disponível.");
        if (req.query.acao === "pdf") {
          if (!c.pdf) throw new Falha(404, "PDF não disponível.");
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            'attachment; filename="edital.pdf"',
          );
          return res.status(200).send(await b2.get(c.pdf.key, c.pdf.version));
        }
        const { pdf, ...config } = c;
        return res.status(200).json({
          config: { ...config, temPdf: !!pdf },
          titulo: p.titulo,
          aviso: abertura(c, agora()),
          agora: agora(),
        });
      }
      if (req.method !== "POST") throw new Falha(405, "Método não permitido.");
      if (!origens.includes(req.headers.origin))
        throw new Falha(403, "Origem não autorizada.");
      if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || ""))
        throw new Falha(400, "Use JSON.");
      const b = req.body;
      if (
        !b ||
        Array.isArray(b) ||
        Buffer.byteLength(JSON.stringify(b)) > 3000000
      )
        throw new Falha(413, "Pedido inválido ou grande demais.");
      const id = idValido(b.editalId),
        acao = b.acao;
      if (
        [
          "catalogo",
          "config",
          "configurar",
          "pdf",
          "listar",
          "detalhe",
          "confirmar",
          "anexoMaster",
        ].includes(acao)
      ) {
        const u = await master(req);
        if (acao === "catalogo") {
          let q = db
            .collection("editaisConfiguracao")
            .orderBy(FieldPath.documentId());
          if (b.cursor) q = q.startAfter(idValido(b.cursor));
          const [lista, count, total] = await Promise.all([
            q.limit(51).get(),
            db.collection("editaisConfiguracao").count().get(),
            db
              .collection("editaisInscricoes")
              .aggregate({
                recebidas: AggregateField.sum("recebidas"),
                confirmadas: AggregateField.sum("confirmadas"),
              })
              .get(),
          ]);
          return res.status(200).json({
            editais: lista.docs
              .slice(0, 50)
              .map((d) => ({ id: d.id, nome: d.data().nome })),
            cursor: lista.docs.length > 50 ? lista.docs[49].id : null,
            totais: { editais: count.data().count, ...total.data() },
          });
        }
        if (acao === "config")
          return res
            .status(200)
            .json({ config: (await cfg(id).get()).data() || null });
        if (acao === "configurar") {
          let data;
          try {
            data = configuracao(b.config);
          } catch (e) {
            throw new Falha(400, e.message);
          }
          await db.runTransaction(async (tx) => {
            await master(req, tx);
            const [p, old, m] = await Promise.all([
              tx.get(db.doc("conteudos/" + id)),
              tx.get(cfg(id)),
              tx.get(db.doc("operacao/estado")),
            ]);
            if (m.data()?.bloqueado)
              throw new Falha(409, "Sistema em manutenção.");
            if (p.data()?.tipo !== "edital")
              throw new Falha(409, "Salve primeiro o rascunho do edital.");
            if ((old.data()?.versao || 0) !== b.versao)
              throw new Falha(409, "Configuração alterada. Reabra o editor.");
            tx.set(cfg(id), {
              ...data,
              pdf: old.data()?.pdf || null,
              versao: b.versao + 1,
            });
            audit(tx, id, u, "configurar", null, {
              versao: b.versao + 1,
              ativo: data.ativo,
            });
          });
          return res.status(200).json({ ok: true });
        }
        if (acao === "pdf") {
          await limite(req, "pdf", 100);
          let f;
          try {
            f = await validarArquivo(b, 2, true);
          } catch (e) {
            throw new Falha(400, e.message);
          }
          const key = `${clienteId}/editais/${id}/publicos/${hash(f.bytes)}.pdf`,
            version = await b2.put(key, f.bytes, f.mime);
          await db.runTransaction(async (tx) => {
            await master(req, tx);
            const c = await tx.get(cfg(id));
            if (!c.exists)
              throw new Falha(409, "Salve a configuração primeiro.");
            if (c.data().versao !== b.versao)
              throw new Falha(
                409,
                "Configuração alterada. Reabra antes de reenviar.",
              );
            tx.update(cfg(id), {
              pdf: { key, version, nome: f.nome, bytes: f.bytes.length },
              versao: b.versao + 1,
            });
            audit(tx, id, u, "pdf", null, { bytes: f.bytes.length });
          });
          return res.status(200).json({ ok: true });
        }
        if (acao === "listar") {
          let query = root(id)
            .collection("inscricoes")
            .where("enviada", "==", true);
          if (b.status) {
            if (!["recebida", "confirmada"].includes(b.status))
              throw new Falha(400, "Situação inválida.");
            query = query.where("status", "==", b.status);
          }
          if (b.busca) {
            const q = normalizar(b.busca);
            if (!q || q.length > 64)
              throw new Falha(
                400,
                "Busque por uma palavra ou protocolo, até 64 caracteres.",
              );
            query = query.where("busca", "array-contains", q);
          }
          query = query.orderBy(FieldPath.documentId(), "desc");
          if (b.cursor) query = query.startAfter(uuid(b.cursor));
          const [s, totais] = await Promise.all([
            query.limit(26).get(),
            root(id).get(),
          ]);
          return res.status(200).json({
            linhas: s.docs.slice(0, 25).map((d) => {
              const v = d.data();
              return {
                id: d.id,
                protocolo: v.protocolo,
                status: v.status,
                criadoEm: v.criadoEm,
                dados: Object.fromEntries(
                  ["responsavel", "escola", "titulo", "categoria"].map((k) => [
                    k,
                    v.dados[k] || "",
                  ]),
                ),
              };
            }),
            cursor: s.docs.length > 25 ? s.docs[24].id : null,
            totais: totais.data() || { recebidas: 0, confirmadas: 0 },
          });
        }
        const rid = uuid(b.id),
          ref = root(id).collection("inscricoes").doc(rid),
          s = (await ref.get()).data();
        if (!s?.enviada) throw new Falha(404, "Inscrição não encontrada.");
        if (acao === "detalhe") return res.status(200).json(publico(s, rid));
        if (acao === "confirmar") {
          await db.runTransaction(async (tx) => {
            const actor = await master(req, tx),
              [snap, m] = await Promise.all([
                tx.get(ref),
                tx.get(db.doc("operacao/estado")),
              ]);
            if (m.data()?.bloqueado)
              throw new Falha(409, "Sistema em manutenção.");
            if (!snap.data()?.enviada)
              throw new Falha(404, "Inscrição não encontrada.");
            if (snap.data().status === "confirmada") return;
            const confirmadoEm = new Date(agora()).toISOString();
            tx.update(ref, {
              status: "confirmada",
              confirmadoPor: actor.uid,
              confirmadoEm,
            });
            tx.set(
              root(id),
              { confirmadas: FieldValue.increment(1) },
              { merge: true },
            );
            audit(
              tx,
              rid,
              actor,
              "confirmar",
              { status: snap.data().status },
              { status: "confirmada", confirmadoEm },
            );
          });
          return res.status(200).json({ ok: true });
        }
        const a = s.arquivos?.[uuid(b.arquivoId)];
        if (a?.estado !== "pronto")
          throw new Falha(404, "Anexo não encontrado.");
        res.setHeader("Content-Type", a.mime);
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="anexo.' +
            (a.mime === "application/pdf" ? "pdf" : "jpg") +
            '"',
        );
        return res.status(200).send(await b2.get(a.key, a.version));
      }
      const rid = uuid(b.id),
        ref = root(id).collection("inscricoes").doc(rid);
      if (acao === "iniciar") {
        cred(b);
        if (b.website) throw new Falha(400, "Não foi possível iniciar.");
        await ativo(id);
        await limite(req, "iniciar", 10);
        await db.runTransaction(async (tx) => {
          const c = await ativo(id, tx),
            s = await tx.get(ref);
          if (s.exists) {
            dono(s.data(), b);
            return;
          }
          tx.create(ref, {
            chaveHash: cred(b),
            enviada: false,
            inicio: agora(),
            config: c,
            arquivos: {},
          });
        });
        return res.status(200).json({ ok: true });
      }
      let s = (await ref.get()).data();
      dono(s, b);
      if (acao === "consultar") {
        if (!s.enviada)
          throw new Falha(409, "O envio ainda não foi confirmado.");
        return res.status(200).json(publico(s, rid));
      }
      if (acao === "anexo") {
        const a = s.arquivos?.[uuid(b.arquivoId)];
        if (a?.estado !== "pronto")
          throw new Falha(404, "Anexo não encontrado.");
        res.setHeader("Content-Type", a.mime);
        return res.status(200).send(await b2.get(a.key, a.version));
      }
      if (acao === "enviar" && s.enviada) {
        const same =
          hash(
            JSON.stringify(
              validarFicha(b.dados, s.config, Object.values(s.arquivos)),
            ),
          ) === s.dadosHash;
        if (!same)
          throw new Falha(
            409,
            "Esta inscrição já foi enviada com outros dados.",
          );
        return res.status(200).json(publico(s, rid));
      }
      const c = await ativo(id);
      if (s.enviada)
        throw new Falha(409, "A inscrição enviada não pode ser alterada.");
      if (c.versao !== s.config.versao)
        throw new Falha(
          409,
          "As regras foram atualizadas. Recarregue o formulário e inicie nova inscrição.",
        );
      if (agora() - s.inicio > 86400000)
        throw new Falha(410, "Rascunho expirado. Inicie nova inscrição.");
      if (acao === "upload") {
        if (!TIPOS_ANEXO[b.tipo])
          throw new Falha(400, "Tipo de anexo inválido.");
        await limite(req, "upload", 100);
        let f;
        try {
          f = await validarArquivo(b, c.maxMB);
        } catch (e) {
          throw new Falha(400, e.message);
        }
        const fid = uuid(b.arquivoId),
          digest = hash(f.bytes),
          key = `${clienteId}/editais/${id}/privados/${rid}/${fid}`,
          nonce = randomUUID();
        let pronto = false;
        await db.runTransaction(async (tx) => {
          const current = await ativo(id, tx),
            ss = (await tx.get(ref)).data();
          dono(ss, b);
          if (ss.enviada || current.versao !== ss.config.versao)
            throw new Falha(409, "Inscrição ou configuração alterada.");
          const a = ss.arquivos[fid];
          if (a && (a.sha256 !== digest || a.tipo !== b.tipo))
            throw new Falha(409, "Identificador já utilizado.");
          if (a?.estado === "pronto") {
            pronto = true;
            return;
          }
          if (a?.estado === "enviando" && agora() - a.inicio < 120000)
            throw new Falha(
              409,
              "Envio em andamento. Aguarde dois minutos antes de repetir.",
            );
          if (!a && Object.keys(ss.arquivos).length >= current.maxArquivos)
            throw new Falha(400, "Limite de arquivos atingido.");
          tx.update(ref, {
            ["arquivos." + fid]: {
              id: fid,
              nome: f.nome,
              tipo: b.tipo,
              mime: f.mime,
              bytes: f.bytes.length,
              sha256: digest,
              estado: "enviando",
              inicio: agora(),
              nonce,
            },
          });
        });
        if (!pronto) {
          const version = await b2.put(key, f.bytes, f.mime);
          await db.runTransaction(async (tx) => {
            const ss = (await tx.get(ref)).data();
            dono(ss, b);
            if (ss.enviada || ss.arquivos[fid]?.nonce !== nonce)
              throw new Falha(409, "Envio alterado. Confira os anexos.");
            tx.update(ref, {
              ["arquivos." + fid]: {
                ...ss.arquivos[fid],
                key,
                version,
                estado: "pronto",
              },
            });
          });
        }
        s = (await ref.get()).data();
        return res.status(200).json({ arquivos: publico(s, rid).arquivos });
      }
      if (acao === "enviar") {
        await limite(req, "enviar", 20);
        await db.runTransaction(async (tx) => {
          const current = await ativo(id, tx),
            ss = (await tx.get(ref)).data();
          dono(ss, b);
          if (ss.enviada) {
            let received;
            try {
              received = validarFicha(
                b.dados,
                ss.config,
                Object.values(ss.arquivos),
              );
            } catch (e) {
              throw new Falha(400, e.message);
            }
            if (hash(JSON.stringify(received)) !== ss.dadosHash)
              throw new Falha(
                409,
                "Esta inscrição já foi enviada com outros dados.",
              );
            return;
          }
          if (current.versao !== ss.config.versao)
            throw new Falha(409, "Configuração alterada.");
          if (Object.values(ss.arquivos).some((a) => a.estado !== "pronto"))
            throw new Falha(409, "Conclua o envio de todos os anexos.");
          let dados;
          try {
            dados = validarFicha(
              b.dados,
              ss.config,
              Object.values(ss.arquivos),
            );
          } catch (e) {
            throw new Falha(400, e.message);
          }
          const protocolo = "SEMED-" + rid.toUpperCase(),
            criadoEm = new Date(agora()).toISOString();
          const palavras = normalizar(
              [
                dados.responsavel,
                dados.escola,
                dados.titulo,
                protocolo,
                rid,
              ].join(" "),
            ).split(" "),
            busca = new Set([normalizar(protocolo), normalizar(rid)]);
          for (const word of palavras)
            for (
              let n = 2;
              n <= Math.min(word.length, 40) && busca.size < 500;
              n++
            )
              busca.add(word.slice(0, n));
          tx.update(ref, {
            dados,
            dadosHash: hash(JSON.stringify(dados)),
            declaracao:
              ss.config.modelo === "anexo-ii-2026"
                ? DECLARACAO
                : "Declaro que as informações prestadas são verdadeiras e que li o regulamento e o aviso de privacidade.",
            aceiteEm: criadoEm,
            protocolo,
            criadoEm,
            status: "recebida",
            enviada: true,
            busca: [...busca],
          });
          tx.set(
            root(id),
            {
              recebidas: FieldValue.increment(1),
              confirmadas: FieldValue.increment(0),
            },
            { merge: true },
          );
        });
        return res.status(200).json(publico((await ref.get()).data(), rid));
      }
      throw new Falha(400, "Ação inválida.");
    } catch (e) {
      return res.status(e.status || 500).json({
        erro: e.status
          ? e.message
          : "Não foi possível confirmar a operação. Seus dados não foram descartados; tente novamente.",
      });
    }
  };
}
module.exports = { criarHandlerEditais };
