const { getApps, initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { carregarCliente } = require("../../scripts/cliente.cjs");
const { criarHandler } = require("../../server/alimentacao/handler.cjs");
const { criarB2 } = require("../../server/alimentacao/b2.cjs");
let handler;
module.exports = async (req, res) => {
  if (!handler)
    try {
      const c = carregarCliente(process.env.SEDUC_CLIENTE),
        credencial = JSON.parse(
          process.env.SEDUC_ADMIN_CREDENTIALS_JSON || "null",
        );
      const origens = (process.env.SEDUC_ADMIN_ORIGINS || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (
        !credencial ||
        credencial.project_id !== c.firebase.projectId ||
        !origens.length ||
        origens.some(
          (o) => new URL(o).origin !== o || !o.startsWith("https://"),
        )
      )
        throw new Error("config");
      const app =
        getApps().find((a) => a.name === "alimentacao-segura") ||
        initializeApp(
          { credential: cert(credencial), projectId: c.firebase.projectId },
          "alimentacao-segura",
        );
      const b2 = process.env.B2_BUCKET ? criarB2(process.env) : null;
      handler = criarHandler({
        db: getFirestore(app),
        auth: getAuth(app),
        b2,
        origens,
        clienteId: c.id,
      });
    } catch {
      res.setHeader("Cache-Control", "no-store");
      return res
        .status(503)
        .json({
          erro: "Configure as credenciais do servidor e do B2 na Vercel. Nunca use variáveis VITE_ para chaves privadas.",
        });
    }
  return handler(req, res);
};
