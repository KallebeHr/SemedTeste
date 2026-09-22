const { createHash, randomUUID } = require("node:crypto");
const { FieldValue } = require("firebase-admin/firestore");
const sharp = require("sharp");
const { validarVisita } = require("../../shared/protocolo-af.mjs");
const {
  Falha,
  idValido,
  uuid,
  autorizar,
  conferir,
  auditar,
  limite,
  GESTAO,
} = require("./seguranca.cjs");
const TIPOS = [
  "estoque",
  "movimentacoes",
  "vistorias",
  "visitasAF",
  "cardapios",
  "conteudos",
];
const hash = (b) => createHash("sha256").update(b).digest("hex");
function texto(v, max) {
  if (typeof v !== "string" || v.length > max)
    throw new Falha(400, "Texto inválido ou muito longo.");
  return v.trim();
}
function vinculo(v) {
  if (v == null) return null;
  if (!TIPOS.includes(v.tipo))
    throw new Falha(400, "Tipo de vínculo inválido.");
  return { tipo: v.tipo, id: idValido(v.id) };
}
async function destinoValido(tx, db, base, v) {
  const r = await tx.get(
    db.doc(
      v.tipo === "conteudos"
        ? "conteudos/" + v.id
        : base + "/" + v.tipo + "/" + v.id,
    ),
  );
  return (
    r.exists &&
    (v.tipo !== "conteudos" ||
      (r.data().tipo === "cardapio" &&
        r.data().escolaId === base.split("/")[1]))
  );
}
async function arquivo(b) {
  if (
    typeof b.base64 !== "string" ||
    b.base64.length > 2800000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(b.base64)
  )
    throw new Falha(400, "Arquivo inválido ou maior que 2 MB.");
  const bytes = Buffer.from(b.base64, "base64");
  if (
    !bytes.length ||
    bytes.length > 2 * 1024 * 1024 ||
    bytes.toString("base64") !== b.base64
  )
    throw new Falha(400, "Arquivo inválido.");
  let mime, ext;
  if (bytes.subarray(0, 5).toString() === "%PDF-") {
    mime = "application/pdf";
    ext = "pdf";
    if (!bytes.subarray(-2048).includes(Buffer.from("%%EOF")))
      throw new Falha(400, "PDF incompleto.");
  } else {
    try {
      const m = await sharp(bytes, { limitInputPixels: 24000000 }).metadata();
      if (!["jpeg", "png"].includes(m.format) || !m.width || !m.height)
        throw new Error();
      mime = m.format === "jpeg" ? "image/jpeg" : "image/png";
      ext = m.format === "jpeg" ? "jpg" : "png";
    } catch {
      throw new Falha(
        400,
        "Use uma imagem JPEG/PNG válida (até 24 megapixels) ou PDF.",
      );
    }
  }
  if (
    b.mime !== mime ||
    !(
      mime === "image/jpeg"
        ? /\.jpe?g$/i
        : mime === "image/png"
          ? /\.png$/i
          : /\.pdf$/i
    ).test(b.nome || "")
  )
    throw new Falha(
      400,
      "Extensão, tipo e conteúdo do arquivo não correspondem.",
    );
  return { bytes, mime, ext, sha256: hash(bytes) };
}
function criarHandler({ db, auth, b2, origens, clienteId }) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        throw new Falha(405, "Use POST.");
      }
      if (!origens.includes(req.headers.origin))
        throw new Falha(403, "Origem não autorizada.");
      if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || ""))
        throw new Falha(400, "Use JSON.");
      if (!/^Bearer [^\s]{10,8192}$/.test(req.headers.authorization || ""))
        throw new Falha(401, "Entre para continuar.");
      let token;
      try {
        token = await auth.verifyIdToken(
          req.headers.authorization.slice(7),
          true,
        );
      } catch {
        throw new Falha(401, "Sua sessão expirou. Entre novamente.");
      }
      const b = req.body;
      if (
        !b ||
        typeof b !== "object" ||
        Array.isArray(b) ||
        Buffer.byteLength(JSON.stringify(b)) > 3000000
      )
        throw new Falha(400, "Pedido inválido.");
      const escolaId = idValido(b.escolaId),
        base = "escolas/" + escolaId;
      const [perfil, escola] = await Promise.all([
        db.doc("usuarios/" + token.uid).get(),
        db.doc(base).get(),
      ]);
      autorizar(token, perfil.data(), escolaId, escola.data());
      if (b.acao === "status")
        return res
          .status(200)
          .json({ documentos: !!b2, visitas: true, maxBytes: 2 * 1024 * 1024 });
      if (b.acao === "salvarVisita") {
        if (escolaId === "deposito-municipal")
          throw new Falha(
            400,
            "O protocolo de Agricultura Familiar é destinado às escolas.",
          );
        const id = uuid(b.id);
        let dados;
        try {
          dados = validarVisita(b.visita);
        } catch (e) {
          throw new Falha(400, e.message);
        }
        const digest = hash(
          JSON.stringify({
            ...dados,
            responsavelCpf: b.visita.responsavel.cpf,
            acompanhanteCpf: b.visita.acompanhante.cpf,
          }),
        );
        const ref = db.doc(base + "/visitasAF/" + id);
        await db.runTransaction(async (tx) => {
          const { perfil: p, escola: e } = await conferir(
            tx,
            db,
            token,
            escolaId,
          );
          const antes = await tx.get(ref);
          if (antes.exists) {
            if (
              antes.data().criadoPor !== token.uid ||
              antes.data().digest !== digest
            )
              throw new Falha(
                409,
                "Identificador já utilizado. Confira o histórico.",
              );
            return;
          }
          const docs = await Promise.all(
            dados.documentos.map((id) =>
              tx.get(db.doc(base + "/documentos/" + id)),
            ),
          );
          if (
            docs.some(
              (s) =>
                !s.exists ||
                s.data().estado !== "pronto" ||
                s.data().arquivado ||
                s.data().vinculo ||
                s.data().criadoPor !== token.uid,
            )
          )
            throw new Falha(
              400,
              "Anexos devem estar confirmados, sem vínculo e enviados por você nesta escola.",
            );
          const registrarLimite = await limite(tx, db, token);
          registrarLimite();
          const depois = {
            ...dados,
            escolaNome: e.nome,
            criadoPor: token.uid,
            criadoPorNome: p.nome,
            criadoEm: FieldValue.serverTimestamp(),
            digest,
          };
          auditar(tx, db, ref, null, depois, token, p);
          tx.create(db.doc(base + "/visitasAFIdentificacoes/" + id), {
            responsavel: {
              nome: b.visita.responsavel.nome,
              cpf: b.visita.responsavel.cpf,
            },
            acompanhante: {
              nome: b.visita.acompanhante.nome,
              cpf: b.visita.acompanhante.cpf,
            },
            criadoPor: token.uid,
            visitaId: id,
            criadoEm: FieldValue.serverTimestamp(),
          });
          for (const s of docs)
            auditar(
              tx,
              db,
              s.ref,
              s.data(),
              { ...s.data(), vinculo: { tipo: "visitasAF", id } },
              token,
              p,
            );
        });
        return res.status(200).json({ id });
      }
      if (b.acao === "acompanharVisita") {
        const ref = db.doc(base + "/visitasAF/" + uuid(b.id)),
          observacao = texto(b.texto, 3000);
        if (
          !observacao ||
          typeof b.resolvida !== "boolean" ||
          !Number.isInteger(b.versao)
        )
          throw new Falha(400, "Descreva o acompanhamento.");
        await db.runTransaction(async (tx) => {
          const { perfil: p } = await conferir(tx, db, token, escolaId),
            s = await tx.get(ref);
          if (!s.exists) throw new Falha(404, "Visita não encontrada.");
          if ((s.data().versaoAcompanhamento || 0) !== b.versao)
            throw new Falha(
              409,
              "O acompanhamento mudou. Atualize e confira antes de salvar.",
            );
          const reg = await limite(tx, db, token);
          reg();
          auditar(
            tx,
            db,
            ref,
            s.data(),
            {
              ...s.data(),
              versaoAcompanhamento: b.versao + 1,
              acompanhamento: {
                texto: observacao,
                estado: b.resolvida ? "resolvida" : "em_aberto",
                por: token.uid,
                nome: p.nome,
                em: FieldValue.serverTimestamp(),
              },
            },
            token,
            p,
          );
        });
        return res.status(200).json({ id: b.id });
      }
      if (!b2)
        throw new Falha(
          503,
          "Armazenamento ainda não configurado. A gestão deve configurar o B2 no servidor.",
        );
      const id = uuid(b.id),
        ref = db.doc(base + "/documentos/" + id);
      if (b.acao === "enviar") {
        const f = await arquivo(b),
          nome = texto(b.nome, 160),
          titulo = texto(b.titulo, 160),
          ocr = texto(b.texto || "", 30000),
          v = vinculo(b.vinculo);
        if (!titulo || b.revisado !== true)
          throw new Falha(
            400,
            "Informe um título e confirme a revisão do documento.",
          );
        const operacao = randomUUID(),
          key = `${clienteId}/${escolaId}/${id}.${f.ext}`,
          digest = hash(
            JSON.stringify({ sha256: f.sha256, nome, titulo, ocr, v }),
          );
        const repetido = await db.runTransaction(async (tx) => {
          const { perfil: p } = await conferir(tx, db, token, escolaId),
            old = await tx.get(ref);
          if (old.exists) {
            const d = old.data();
            if (d.criadoPor !== token.uid || d.digest !== digest)
              throw new Falha(
                409,
                "Arquivo ou dados mudaram. Inicie um novo envio.",
              );
            if (d.estado === "pronto") return true;
            if (d.estado === "enviando" && Date.now() - d.iniciadoEm < 120000)
              throw new Falha(
                409,
                "Envio em andamento. Aguarde dois minutos e confira a lista antes de repetir.",
              );
          }
          if (v && !(await destinoValido(tx, db, base, v)))
            throw new Falha(
              404,
              "Registro de destino não encontrado nesta unidade.",
            );
          const reg = await limite(tx, db, token, f.bytes.length);
          reg();
          auditar(
            tx,
            db,
            ref,
            old.exists ? old.data() : null,
            {
              nome,
              titulo,
              texto: ocr,
              mime: f.mime,
              tamanho: f.bytes.length,
              sha256: f.sha256,
              digest,
              key,
              versionId: null,
              estado: "enviando",
              iniciadoEm: Date.now(),
              operacao,
              vinculo: v,
              arquivado: false,
              revisado: true,
              criadoPor: token.uid,
              criadoPorNome: p.nome,
              criadoEm: old.data()?.criadoEm || FieldValue.serverTimestamp(),
            },
            token,
            p,
          );
          return false;
        });
        if (repetido) return res.status(200).json({ id, repetido: true });
        try {
          const versionId = await b2.put(key, f.bytes, f.mime);
          await db.runTransaction(async (tx) => {
            const { perfil: p } = await conferir(tx, db, token, escolaId);
            const s = await tx.get(ref);
            if (s.data()?.operacao !== operacao)
              throw new Falha(
                409,
                "O envio foi substituído; confira o histórico.",
              );
            auditar(
              tx,
              db,
              ref,
              s.data(),
              {
                ...s.data(),
                estado: "pronto",
                versionId,
                confirmadoEm: FieldValue.serverTimestamp(),
              },
              token,
              p,
            );
          });
        } catch (e) {
          await db
            .runTransaction(async (tx) => {
              const s = await tx.get(ref);
              if (
                s.data()?.operacao === operacao &&
                s.data()?.estado !== "pronto"
              )
                auditar(
                  tx,
                  db,
                  ref,
                  s.data(),
                  { ...s.data(), estado: "falhou" },
                  token,
                  perfil.data(),
                );
            })
            .catch(() => {});
          if (e instanceof Falha) throw e;
          throw new Falha(
            502,
            "O arquivo não foi confirmado no B2. Confira a configuração e tente novamente.",
          );
        }
        return res.status(200).json({ id });
      }
      if (b.acao === "baixar") {
        const s = await ref.get(),
          d = s.data();
        if (!s.exists || d.estado !== "pronto")
          throw new Falha(404, "Arquivo não disponível.");
        if (!d.key?.startsWith(`${clienteId}/${escolaId}/`) || !d.versionId)
          throw new Falha(409, "Referência de arquivo inválida.");
        await db.runTransaction(async (tx) => {
          await conferir(tx, db, token, escolaId);
          const reg = await limite(tx, db, token);
          reg();
        });
        const bytes = await b2.get(d.key, d.versionId);
        if (bytes.length > 2 * 1024 * 1024 || hash(bytes) !== d.sha256)
          throw new Falha(
            502,
            "A integridade do arquivo não pôde ser confirmada.",
          );
        res.setHeader("Content-Type", d.mime);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="documento.${d.mime === "application/pdf" ? "pdf" : d.mime === "image/png" ? "png" : "jpg"}"`,
        );
        return res.status(200).send(bytes);
      }
      if (["arquivar", "vincular"].includes(b.acao)) {
        await db.runTransaction(async (tx) => {
          const { perfil: p } = await conferir(tx, db, token, escolaId),
            s = await tx.get(ref);
          if (!s.exists || s.data().estado !== "pronto")
            throw new Falha(404, "Arquivo não encontrado.");
          if (s.data().criadoPor !== token.uid && !GESTAO.includes(p.papel))
            throw new Falha(
              403,
              "Apenas o autor ou a gestão podem organizar este arquivo.",
            );
          const v =
            b.acao === "vincular" ? vinculo(b.vinculo) : s.data().vinculo;
          if (b.acao === "vincular" && (!v || s.data().vinculo))
            throw new Falha(
              409,
              "Escolha um destino; vínculos confirmados não podem ser substituídos.",
            );
          if (
            v &&
            b.acao === "vincular" &&
            !(await destinoValido(tx, db, base, v))
          )
            throw new Falha(404, "Destino não encontrado.");
          const reg = await limite(tx, db, token);
          reg();
          auditar(
            tx,
            db,
            ref,
            s.data(),
            {
              ...s.data(),
              ...(b.acao === "arquivar" ? { arquivado: true } : { vinculo: v }),
            },
            token,
            p,
          );
        });
        return res.status(200).json({ id });
      }
      throw new Falha(400, "Ação desconhecida.");
    } catch (e) {
      return res.status(e instanceof Falha ? e.status : 500).json({
        erro:
          e instanceof Falha
            ? e.message
            : "Não foi possível concluir. Confira a conexão e tente novamente.",
      });
    }
  };
}
module.exports = { criarHandler, arquivo };
