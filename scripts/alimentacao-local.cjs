// Servidor somente local. Usa as credenciais privadas de .env.server.
const http = require("node:http");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { carregarCliente } = require("./cliente.cjs");
const { criarHandler } = require("../server/alimentacao/handler.cjs");
const { criarB2 } = require("../server/alimentacao/b2.cjs");
const c = carregarCliente(process.env.SEDUC_CLIENTE || "pedro-ii"),
  cred = JSON.parse(process.env.SEDUC_ADMIN_CREDENTIALS_JSON || "null");
if (!cred || cred.project_id !== c.firebase.projectId)
  throw new Error(
    "Configure .env.server com o cliente e a credencial do mesmo projeto.",
  );
const app = initializeApp({
  credential: cert(cred),
  projectId: c.firebase.projectId,
});
const handler = criarHandler({
  db: getFirestore(app),
  auth: getAuth(app),
  b2: process.env.B2_BUCKET ? criarB2(process.env) : null,
  clienteId: c.id,
  origens: ["http://localhost:3000", "http://127.0.0.1:3000"],
});
http
  .createServer(async (req, res) => {
    res.status = (n) => {
      res.statusCode = n;
      return res;
    };
    res.json = (d) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(d));
    };
    res.send = (b) => res.end(b);
    if (req.url !== "/api/alimentacao/documentos")
      return res.status(404).json({ erro: "Rota inexistente." });
    let n = 0,
      chunks = [];
    try {
      for await (const c of req) {
        n += c.length;
        if (n > 3000000) {
          res.status(413).json({ erro: "Arquivo grande demais." });
          return;
        }
        chunks.push(c);
      }
      req.body = JSON.parse(Buffer.concat(chunks).toString());
      await handler(req, res);
    } catch {
      if (!res.writableEnded)
        res.status(400).json({ erro: "Pedido inválido." });
    }
  })
  .listen(3001, "127.0.0.1", () =>
    console.log("API de alimentação em http://127.0.0.1:3001 (apenas local)."),
  );
