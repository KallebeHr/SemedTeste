const { FieldValue } = require("firebase-admin/firestore");
function criarHandlerAviso({ db, auth, origens }) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      if (req.method !== "POST")
        return res.status(405).json({ erro: "Use POST." });
      if (!origens.includes(req.headers.origin))
        return res.status(403).json({ erro: "Origem não autorizada." });
      if (
        !/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "") ||
        typeof req.body?.ativo !== "boolean" ||
        !Number.isInteger(req.body?.versao) ||
        req.body.versao < 0
      )
        return res.status(400).json({ erro: "Configuração inválida." });
      let token;
      try {
        token = await auth.verifyIdToken(
          (req.headers.authorization || "").replace(/^Bearer /, ""),
          true,
        );
      } catch {
        return res
          .status(401)
          .json({ erro: "Entre novamente para continuar." });
      }
      const r = db.doc("publicacoes/config-aviso-portal");
      const resultado = await db.runTransaction(async (tx) => {
        const [perfil, estado, s] = await Promise.all([
          tx.get(db.doc("usuarios/" + token.uid)),
          tx.get(db.doc("operacao/estado")),
          tx.get(r),
        ]);
        const p = perfil.data(),
          idade = Date.now() / 1000 - Number(token.auth_time || 0);
        if (
          !p ||
          p.ativo === false ||
          !["master", "admin", "alimentador"].includes(p.papel) ||
          idade < 0 ||
          idade >= 28800 ||
          token.auth_time < (p.sessaoRevogadaEm || 0)
        )
          throw Object.assign(
            Error("Seu perfil não permite alterar as configurações do portal."),
            { status: 403 },
          );
        if (estado.data()?.bloqueado)
          throw Object.assign(Error("Sistema em manutenção. Aguarde."), {
            status: 503,
          });
        const antes = s.data() || null;
        if ((antes?.versao || 0) !== req.body.versao)
          throw Object.assign(
            Error(
              "O comunicado foi alterado por outra pessoa. Atualize a página antes de salvar.",
            ),
            { status: 409 },
          );
        const depois = {
          tipo: "configuracao_portal",
          avisoAtualizacaoAtivo: req.body.ativo,
          versao: (antes?.versao || 0) + 1,
          atualizadoEm: FieldValue.serverTimestamp(),
        };
        tx.set(r, depois);
        tx.create(db.collection("auditoriaRegistros").doc(), {
          versaoEsquema: 1,
          dominio: "portal",
          colecao: "publicacoes",
          documentoId: r.id,
          caminho: r.path,
          acao: req.body.ativo ? "ativar_comunicado" : "desativar_comunicado",
          usuarioId: token.uid,
          usuarioNome: p.nome || "",
          papelUsuario: p.papel,
          timestamp: FieldValue.serverTimestamp(),
          dadosAntes: antes,
          dadosDepois: depois,
        });
        return { ativo: req.body.ativo, versao: depois.versao };
      });
      return res.status(200).json(resultado);
    } catch (e) {
      return res
        .status(e.status || 500)
        .json({
          erro: e.status
            ? e.message
            : "Não foi possível salvar o comunicado. Tente novamente.",
        });
    }
  };
}
module.exports = { criarHandlerAviso };
