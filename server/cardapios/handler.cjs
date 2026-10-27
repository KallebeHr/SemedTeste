const { randomUUID, createHash } = require("node:crypto");
const { FieldValue } = require("firebase-admin/firestore");
const { validarArquivo } = require("../editais/arquivos.cjs");
const hash = (v) => createHash("sha256").update(v).digest("hex");
class Erro extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
function id(v) {
  if (typeof v !== "string" || !/^[\w-]{1,128}$/.test(v))
    throw new Erro(400, "Identificador inválido.");
  return v;
}
const texto = (v, max = 200) => {
  if (v == null) return "";
  if (typeof v !== "string" || v.length > max)
    throw new Erro(400, "Texto inválido ou muito longo.");
  return v.trim();
};
function criarHandlerCardapios({ db, auth, b2, origens, clienteId }) {
  const ref = (col, v) => db.doc(col + "/" + id(v));
  const url = (id, arquivoId) =>
    `/api/cardapios?acao=pdf&id=${id}&arquivo=${arquivoId}`;
  async function usuario(req, tx) {
    let token;
    try {
      token = await auth.verifyIdToken(
        (req.headers.authorization || "").replace(/^Bearer /, ""),
        true,
      );
    } catch {
      throw new Erro(401, "Entre novamente para continuar.");
    }
    const s = await (tx
        ? tx.get(ref("usuarios", token.uid))
        : ref("usuarios", token.uid).get()),
      p = s.data();
    const agora = Date.now() / 1000;
    if (
      !p ||
      p.ativo === false ||
      !["master", "admin", "nutricionista", "gerente"].includes(p.papel) ||
      !token.auth_time ||
      token.auth_time > agora ||
      agora - token.auth_time >= 28800 ||
      token.auth_time < (p.sessaoRevogadaEm || 0)
    )
      throw new Erro(
        403,
        "Apenas Master e nutrição autorizada podem gerenciar cardápios.",
      );
    return { uid: token.uid, nome: p.nome || "", papel: p.papel };
  }
  function auditar(tx, u, r, antes, depois, acao) {
    tx.create(db.collection("auditoriaRegistros").doc(), {
      versaoEsquema: 1,
      dominio: "cardapios",
      colecao: r.parent.id,
      documentoId: r.id,
      caminho: r.path,
      acao,
      usuarioId: u.uid,
      usuarioNome: u.nome,
      papelUsuario: u.papel,
      timestamp: FieldValue.serverTimestamp(),
      dadosAntes: antes || null,
      dadosDepois: depois || null,
    });
  }
  async function liberado(tx) {
    if ((await tx.get(db.doc("operacao/estado"))).data()?.bloqueado)
      throw new Erro(503, "Sistema em manutenção. Aguarde.");
  }
  return async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      const modelo = await import("../../shared/cardapios.mjs");
      if (req.method === "GET") {
        if (req.query.acao !== "pdf") throw new Erro(400, "Ação inválida.");
        const menu = (await ref("publicacoes", req.query.id).get()).data();
        if (
          menu?.tipo !== "cardapio" ||
          !menu.arquivoId ||
          menu.arquivoId !== req.query.arquivo
        )
          throw new Erro(404, "PDF não publicado.");
        const escolas = await Promise.all(
          modelo.idsEscolas(menu).map(async (escolaId) => {
            const [e, p] = await Promise.all([
              ref("escolas", escolaId).get(),
              ref("escolasPublicas", escolaId).get(),
            ]);
            return e.exists &&
              e.data().ativo !== false &&
              !e.data().arquivada &&
              p.exists
              ? escolaId
              : null;
          }),
        );
        if (
          req.query.escola
            ? !escolas.includes(req.query.escola)
            : !escolas.some(Boolean)
        )
          throw new Erro(404, "Cardápio indisponível para esta escola.");
        const f = (await ref("cardapiosArquivos", menu.arquivoId).get()).data();
        if (!f || f.estado !== "pronto")
          throw new Erro(404, "Arquivo indisponível.");
        const bytes = await b2.get(f.key, f.version);
        if (hash(bytes) !== f.sha256)
          throw new Erro(
            502,
            "Não foi possível conferir a integridade do PDF.",
          );
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("X-Frame-Options", "SAMEORIGIN");
        res.setHeader(
          "Content-Security-Policy",
          "default-src 'none'; frame-ancestors 'self'",
        );
        res.setHeader(
          "Content-Disposition",
          `${req.query.baixar === "1" ? "attachment" : "inline"}; filename="cardapio-${menu.numero}.pdf"`,
        );
        return res.status(200).send(bytes);
      }
      if (req.method !== "POST") throw new Erro(405, "Use POST.");
      if (!origens.includes(req.headers.origin))
        throw new Erro(403, "Origem não autorizada.");
      if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || ""))
        throw new Erro(400, "Use JSON.");
      const b = req.body;
      if (!b || Buffer.byteLength(JSON.stringify(b)) > 3000000)
        throw new Erro(400, "Pedido muito grande.");
      const u = await usuario(req);
      if (b.acao === "visualizar") {
        const f = (await ref("cardapiosArquivos", b.arquivoId).get()).data();
        if (!f || f.estado !== "pronto")
          throw new Erro(404, "PDF não encontrado.");
        const bytes = await b2.get(f.key, f.version);
        if (hash(bytes) !== f.sha256)
          throw new Erro(502, "Integridade do PDF inválida.");
        res.setHeader("Content-Type", "application/pdf");
        return res.status(200).send(bytes);
      }
      if (b.acao === "upload") {
        let f;
        try {
          f = await validarArquivo(b, 2, true);
        } catch (e) {
          throw new Erro(400, e.message);
        }
        const arquivoId = randomUUID(),
          r = ref("cardapiosArquivos", arquivoId);
        await db.runTransaction(async (tx) => {
          await usuario(req, tx);
          await liberado(tx);
        });
        const sha256 = hash(f.bytes),
          key = `${clienteId}/cardapios/${arquivoId}/${sha256}.pdf`;
        const version = await b2.put(key, f.bytes, f.mime);
        await db.runTransaction(async (tx) => {
          const atual = await usuario(req, tx);
          await liberado(tx);
          const dados = {
            nome: f.nome,
            bytes: f.bytes.length,
            key,
            version,
            sha256,
            estado: "pronto",
            criadoPor: u.uid,
            criadoEm: FieldValue.serverTimestamp(),
          };
          tx.create(r, dados);
          auditar(tx, atual, r, null, dados, "enviar_pdf");
        });
        return res
          .status(200)
          .json({ arquivoId, nome: f.nome, bytes: f.bytes.length });
      }
      if (!["salvar", "retirar", "historico"].includes(b.acao))
        throw new Erro(400, "Ação inválida.");
      const r = ref("conteudos", b.id);
      if (b.acao === "historico") {
        const s = await db
          .collection("auditoriaRegistros")
          .where("caminho", "==", r.path)
          .orderBy("timestamp", "desc")
          .limit(100)
          .get();
        return res.status(200).json({
          linhas: s.docs
            .map((x) => ({
              id: x.id,
              acao: x.data().acao,
              nome: x.data().usuarioNome,
              em: x.data().timestamp?.toDate().toISOString(),
            }))
            .sort((a, b) => String(b.em).localeCompare(String(a.em))),
        });
      }
      if (b.acao === "salvar" && typeof b.publicar !== "boolean")
        throw new Erro(400, "Escolha salvar rascunho ou publicar.");
      let p;
      if (b.acao === "salvar") {
        const f = b.form || {},
          ids = modelo.idsEscolas(f);
        if (!ids.length || ids.length > 100)
          throw new Erro(400, "Selecione de 1 a 100 escolas.");
        ids.forEach(id);
        if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(f.numero || ""))
          throw new Erro(400, "Informe o mês de referência.");
        p = {
          tipo: "cardapio",
          titulo: texto(f.titulo),
          resumo: texto(f.resumo, 800),
          texto: texto(f.texto, 30000),
          categoria: texto(f.categoria),
          slug: "",
          url: texto(f.url, 2000),
          imagemUrl: texto(f.imagemUrl, 2000),
          imagemAlt: texto(f.imagemAlt),
          dataInicio: texto(f.dataInicio, 10),
          dataFim: texto(f.dataFim, 10),
          local: texto(f.local),
          numero: f.numero,
          destaque: f.destaque === true,
          ordem: Number(f.ordem) || 0,
          escolaId: ids[0],
          escolaIds: ids,
          etapa: texto(f.etapa || f.gradeCardapio?.etapa || f.categoria, 100),
          turno: texto(f.turno || f.gradeCardapio?.turno, 60),
          programa: texto(f.programa, 100),
          observacoes: texto(f.observacoes, 3000),
        };
        if (!Number.isInteger(p.ordem) || p.ordem < 0 || p.ordem > 9999)
          throw new Erro(400, "Ordem de exibição inválida.");
        for (const campo of ["dataInicio", "dataFim"]) {
          if (
            p[campo] &&
            (!/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(
              p[campo],
            ) ||
              new Date(p[campo] + "T12:00:00Z").toISOString().slice(0, 10) !==
                p[campo])
          )
            throw new Erro(400, "Data de publicação inválida.");
        }
        if (p.dataInicio && p.dataFim && p.dataFim < p.dataInicio)
          throw new Erro(400, "A data final deve ser posterior à inicial.");
        if (p.imagemUrl && !p.imagemAlt)
          throw new Erro(400, "Descreva a imagem para acessibilidade.");
        if (p.titulo.length < 3 || !p.etapa || !p.turno)
          throw new Erro(400, "Informe título, etapa e turno.");
        if (f.gradeCardapio) {
          const { validarCardapio, serializarCardapio, textoCardapio } =
            await import("../../src/portal/cardapioMensal.js");
          try {
            const g = validarCardapio(
              { ...f.gradeCardapio, etapa: p.etapa, turno: p.turno },
              { mes: p.numero, publicar: b.publicar === true },
            );
            p.gradeCardapio = serializarCardapio(g);
            p.texto = textoCardapio(g);
            if (p.texto.length > 30000)
              throw Error("Reduza as observações do cardápio para publicar.");
          } catch (e) {
            throw new Erro(400, e.message);
          }
        }
        if (f.arquivoId) {
          p.arquivoId = id(f.arquivoId);
          p.arquivoPdfUrl = url(b.id, p.arquivoId);
        }
        if (b.publicar && !p.arquivoId && !p.gradeCardapio && !p.texto)
          throw new Erro(400, "Envie o PDF original ou preencha o cardápio.");
        for (const campo of ["url", "imagemUrl"])
          if (
            p[campo] &&
            !/^https:\/\/[^ @\r\n]+$|^\/(?!\/)[^\r\n]*$/.test(p[campo])
          )
            throw new Erro(400, "Link inválido.");
      }
      const resultado = await db.runTransaction(async (tx) => {
        const atual = await usuario(req, tx);
        await liberado(tx);
        // Documento comum serializa também inserções concorrentes (consultas não bloqueiam fantasmas).
        const trava = db.doc("cardapiosControle/publicacao"),
          lock = await tx.get(trava);
        const s = await tx.get(r),
          antes = s.data();
        if (antes && (antes.tipo !== "cardapio" || antes.versao !== b.versao))
          throw new Erro(409, "O registro mudou. Reabra antes de continuar.");
        if (b.acao === "retirar" && !antes)
          throw new Erro(404, "Cardápio não encontrado.");
        const publicados = await tx.get(
          db.collection("publicacoes").where("tipo", "==", "cardapio"),
        );
        const versao = (antes?.versao || 0) + 1;
        if (b.acao === "retirar") {
          const depois = {
            ...antes,
            versao,
            publicado: false,
            atualizadoPor: u.uid,
            atualizadoEm: FieldValue.serverTimestamp(),
          };
          tx.set(r, depois);
          tx.delete(ref("publicacoes", b.id));
          tx.set(trava, { versao: (lock.data()?.versao || 0) + 1 });
          auditar(tx, atual, r, antes, depois, "retirar_publicacao");
          return { id: b.id, versao };
        }
        for (const escolaId of p.escolaIds) {
          const e = await tx.get(ref("escolas", escolaId));
          if (!e.exists || escolaId === "deposito-municipal")
            throw new Erro(400, "Uma escola selecionada não existe.");
          if (
            b.publicar &&
            (e.data().ativo === false ||
              e.data().arquivada ||
              !(await tx.get(ref("escolasPublicas", escolaId))).exists)
          )
            throw new Erro(
              400,
              `Publique e ative a escola “${e.data().nome}” antes de publicar o cardápio.`,
            );
        }
        if (p.arquivoId) {
          const f = (
            await tx.get(ref("cardapiosArquivos", p.arquivoId))
          ).data();
          if (f?.estado !== "pronto")
            throw new Erro(400, "PDF não confirmado no B2.");
          p.arquivoNome = f.nome;
        }
        const conflitos = b.publicar
          ? modelo.conflitosCardapio(
              { ...p, id: b.id },
              publicados.docs.map((d) => ({ id: d.id, ...d.data() })),
            )
          : [];
        if (conflitos.length && b.substituir !== true)
          throw new Erro(
            409,
            "Há cardápios publicados para a mesma escola, mês, etapa e turno. Revise ou confirme a substituição dos vínculos indicados.",
            {
              conflitos: conflitos.map((c) => ({
                id: c.id,
                titulo: c.titulo,
                escolaIds: modelo
                  .idsEscolas(c)
                  .filter((id) => p.escolaIds.includes(id)),
              })),
            },
          );
        // Leia todas as versões antes da primeira escrita.
        const anteriores = await Promise.all(
          conflitos.map((c) => tx.get(ref("conteudos", c.id))),
        );
        for (let i = 0; i < conflitos.length; i++) {
          const c = conflitos[i],
            origem = anteriores[i],
            privado = origem.data();
          if (!origem.exists || !privado.publicado)
            throw new Erro(
              409,
              "Publicação conflitante mudou. Atualize e revise.",
            );
          const restantes = modelo
            .idsEscolas(c)
            .filter((id) => !p.escolaIds.includes(id));
          // Preserva rascunhos em edição: altera apenas os vínculos removidos, mantendo demais campos.
          const idsPrivados = modelo
            .idsEscolas(privado)
            .filter((id) => !p.escolaIds.includes(id));
          const depois = {
            ...privado,
            escolaIds: idsPrivados,
            escolaId: idsPrivados[0] || "",
            publicado: restantes.length > 0,
            versao: (privado.versao || 0) + 1,
            atualizadoPor: u.uid,
            atualizadoEm: FieldValue.serverTimestamp(),
          };
          tx.set(origem.ref, depois);
          if (restantes.length)
            tx.set(ref("publicacoes", c.id), {
              ...Object.fromEntries(
                Object.entries(c).filter(([k]) => k !== "id"),
              ),
              escolaIds: restantes,
              escolaId: restantes[0],
              publicadoEm: FieldValue.serverTimestamp(),
            });
          else tx.delete(ref("publicacoes", c.id));
          auditar(
            tx,
            atual,
            origem.ref,
            privado,
            depois,
            "substituir_vinculos",
          );
        }
        const depois = {
          ...p,
          versao,
          publicado: b.publicar === true || antes?.publicado || false,
          atualizadoPor: u.uid,
          atualizadoEm: FieldValue.serverTimestamp(),
        };
        tx.set(r, depois);
        if (b.publicar)
          tx.set(ref("publicacoes", b.id), {
            ...p,
            publicadoEm: FieldValue.serverTimestamp(),
          });
        tx.set(trava, { versao: (lock.data()?.versao || 0) + 1 });
        auditar(
          tx,
          atual,
          r,
          antes,
          depois,
          b.publicar ? "publicar" : "salvar_rascunho",
        );
        return { id: b.id, versao };
      });
      return res.status(200).json(resultado);
    } catch (e) {
      return res.status(e.status || 500).json({
        erro: e.status
          ? e.message
          : "Não foi possível concluir. Confira a configuração Firebase/B2 e tente novamente.",
        ...(e.extra || {}),
      });
    }
  };
}
module.exports = { criarHandlerCardapios };
