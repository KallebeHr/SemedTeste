const sharp = require("sharp");
const { randomUUID, createHash } = require("node:crypto");
const { FieldValue } = require("firebase-admin/firestore");
const {
  Falha,
  idValido,
  uuid,
  limite,
} = require("../alimentacao/seguranca.cjs");
function autorizarEditor(token, perfil, tipo) {
  const papeis =
    tipo === "cardapio"
      ? ["master", "admin", "nutricionista", "gerente"]
      : ["master", "admin", "alimentador"];
  if (!perfil || perfil.ativo === false || !papeis.includes(perfil.papel))
    throw new Falha(403, "Seu cargo não permite editar esta publicação.");
  const idade = Date.now() / 1000 - Number(token.auth_time || 0);
  if (
    idade < 0 ||
    idade >= 28800 ||
    Number(token.auth_time || 0) < Number(perfil.sessaoRevogadaEm || 0)
  )
    throw new Falha(401, "Entre novamente para continuar.");
}
async function tratarImagem(b) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(b.mime) ||
    typeof b.base64 !== "string" ||
    b.base64.length > 2800000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(b.base64)
  )
    throw new Falha(400, "Envie JPEG, PNG ou WEBP de até 2 MB.");
  const bytes = Buffer.from(b.base64, "base64");
  if (!bytes.length || bytes.length > 2 * 1024 * 1024)
    throw new Falha(400, "Imagem excede 2 MB.");
  try {
    const image = sharp(bytes, { limitInputPixels: 24000000, animated: false });
    const meta = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format) || meta.pages > 1)
      throw new Error("tipo");
    const output = await image
      .rotate()
      .resize({
        width: 1800,
        height: 1800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82 })
      .toBuffer();
    if (output.length > 2 * 1024 * 1024) throw new Error("tamanho");
    return output;
  } catch {
    throw new Falha(
      400,
      "A imagem não pôde ser validada. Use JPEG, PNG ou WEBP.",
    );
  }
}
function criarHandlerImagem({ db, auth, b2, origens, clienteId }) {
  const origem =
    origens.find((o) => new URL(o).hostname.startsWith("www.")) || origens[0];
  const urlImagem = (id) => origem + "/api/publicacoes/imagem?id=" + id;
  async function permissao(token, tipo, tx) {
    const get = (r) => (tx ? tx.get(r) : r.get());
    const [p, m] = await Promise.all([
      get(db.doc("usuarios/" + token.uid)),
      get(db.doc("operacao/estado")),
    ]);
    autorizarEditor(token, p.data(), tipo);
    if (m.data()?.bloqueado)
      throw new Falha(409, "Sistema em manutenção. Aguarde.");
    return p.data();
  }
  return async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      if (!b2) throw new Falha(503, "Armazenamento B2 não configurado.");
      if (req.method === "GET") {
        const id = uuid(req.query?.id);
        const m = (await db.doc("midiasPublicacoes/" + id).get()).data();
        if (!m || m.estado !== "pronto")
          throw new Falha(404, "Imagem não encontrada.");
        const p = (await db.doc("publicacoes/" + m.conteudoId).get()).data();
        if (p?.imagemUrl !== urlImagem(id))
          throw new Falha(404, "Imagem não publicada.");
        const bytes = await b2.get(m.key, m.version);
        res.setHeader("Content-Type", "image/jpeg");
        return res.status(200).send(bytes);
      }
      if (req.method !== "POST") {
        res.setHeader("Allow", "GET, POST");
        throw new Falha(405, "Método não permitido.");
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
      const id = uuid(b.id),
        ref = db.doc("midiasPublicacoes/" + id);
      if (b.acao === "baixar") {
        const m = (await ref.get()).data();
        if (!m || m.estado !== "pronto")
          throw new Falha(404, "Imagem não encontrada.");
        await permissao(token, m.tipo);
        res.setHeader("Content-Type", "image/jpeg");
        return res.status(200).send(await b2.get(m.key, m.version));
      }
      if (b.acao !== "enviar") throw new Falha(400, "Ação inválida.");
      const conteudoId = idValido(b.conteudoId),
        tipo = b.tipo;
      if (
        ![
          "noticia",
          "pagina",
          "servico",
          "edital",
          "evento",
          "documento",
          "biblioteca",
          "transporte",
          "cardapio",
          "indicador",
          "sistema",
        ].includes(tipo)
      )
        throw new Falha(400, "Tipo inválido.");
      await permissao(token, tipo);
      const bytes = await tratarImagem(b),
        digest = createHash("sha256").update(bytes).digest("hex"),
        nonce = randomUUID();
      let pronto = false;
      await db.runTransaction(async (tx) => {
        await permissao(token, tipo, tx);
        const [s, c] = await Promise.all([
          tx.get(ref),
          tx.get(db.doc("conteudos/" + conteudoId)),
        ]);
        if (c.exists() && c.data().tipo !== tipo)
          throw new Falha(409, "Tipo de conteúdo divergente.");
        const m = s.data();
        if (
          m &&
          (m.uid !== token.uid ||
            m.conteudoId !== conteudoId ||
            m.sha256 !== digest)
        )
          throw new Falha(409, "Identificador de imagem já utilizado.");
        if (m?.estado === "pronto") {
          pronto = true;
          return;
        }
        if (m?.estado === "enviando" && Date.now() - m.inicio < 120000)
          throw new Falha(
            409,
            "Envio em andamento. Aguarde dois minutos antes de repetir.",
          );
        const registrar = await limite(tx, db, token, bytes.length);
        registrar();
        tx.set(ref, {
          uid: token.uid,
          conteudoId,
          tipo,
          sha256: digest,
          estado: "enviando",
          inicio: Date.now(),
          nonce,
        });
      });
      if (pronto) return res.status(200).json({ id, url: urlImagem(id) });
      const key = `${clienteId}/publicacoes/${conteudoId}/${id}.jpg`;
      const version = await b2.put(key, bytes, "image/jpeg");
      await db.runTransaction(async (tx) => {
        const p = await permissao(token, tipo, tx),
          s = await tx.get(ref);
        if (s.data()?.nonce !== nonce)
          throw new Falha(
            409,
            "Envio substituído; confira o resultado antes de repetir.",
          );
        tx.update(ref, {
          estado: "pronto",
          key,
          version,
          bytes: bytes.length,
          criadoEm: FieldValue.serverTimestamp(),
        });
        tx.create(db.doc("auditoriaRegistros/" + randomUUID()), {
          versaoEsquema: 1,
          dominio: "portal",
          colecao: "midiasPublicacoes",
          documentoId: id,
          caminho: ref.path,
          acao: "create",
          usuarioId: token.uid,
          usuarioNome: p.nome || "Profissional",
          papelUsuario: p.papel,
          timestamp: FieldValue.serverTimestamp(),
          dadosAntes: null,
          dadosDepois: {
            conteudoId,
            tipo,
            sha256: digest,
            bytes: bytes.length,
          },
        });
      });
      return res.status(200).json({ id, url: urlImagem(id) });
    } catch (e) {
      return res
        .status(e.status || 500)
        .json({
          erro: e.status
            ? e.message
            : "Não foi possível concluir o envio. Confira o resultado antes de repetir.",
        });
    }
  };
}
module.exports = { criarHandlerImagem, autorizarEditor, tratarImagem };
