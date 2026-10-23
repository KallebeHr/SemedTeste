const { getApps, initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { carregarCliente } = require("../../scripts/cliente.cjs");
const { criarB2 } = require("../../server/alimentacao/b2.cjs");
const { criarHandlerImagem } = require("../../server/publicacoes/imagem.cjs");
let handler;
module.exports = async (req, res) => {
  if (!handler) {
    try {
      const c = carregarCliente(process.env.SEDUC_CLIENTE),
        credential = JSON.parse(
          process.env.SEDUC_ADMIN_CREDENTIALS_JSON || "null",
        );
      const origens = (process.env.SEDUC_ADMIN_ORIGINS || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (
        !credential ||
        credential.project_id !== c.firebase.projectId ||
        !origens.length ||
        origens.some(
          (o) => new URL(o).origin !== o || !o.startsWith("https://"),
        )
      )
        throw new Error("config");
      const app =
        getApps().find((a) => a.name === "portal-midias") ||
        initializeApp(
          { credential: cert(credential), projectId: c.firebase.projectId },
          "portal-midias",
        );
      handler = criarHandlerImagem({
        db: getFirestore(app),
        auth: getAuth(app),
        b2: criarB2(process.env),
        origens,
        clienteId: c.id,
      });
    } catch {
      res.setHeader("Cache-Control", "no-store");
      return res
        .status(503)
        .json({ erro: "Confira a configuração do armazenamento na Vercel." });
    }
  }
  return handler(req, res);
};
