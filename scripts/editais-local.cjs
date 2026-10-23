const http = require("node:http");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { criarHandlerEditais } = require("../server/editais/handler.cjs");
const { criarB2 } = require("../server/alimentacao/b2.cjs");
const { carregarCliente } = require("./cliente.cjs");
const emulador = process.env.SEDUC_EDITAIS_EMULADOR === "true";
let app,
  b2,
  clienteId = "pedro-ii",
  rateSecret;
if (emulador) {
  if (
    !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || "") ||
    !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST || "")
  )
    throw Error("Configure os dois emuladores locais.");
  app = initializeApp({ projectId: "demo-seduc" });
  rateSecret = "somente-emulador";
  const fs = require("node:fs/promises"),
    path = require("node:path"),
    { createHash, randomUUID } = require("node:crypto");
  const dir = path.join(__dirname, "../.editais-emulador");
  const file = (k, v) =>
    path.join(dir, createHash("sha256").update(k).digest("hex") + "-" + v);
  b2 = {
    put: async (k, buf) => {
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
      const v = randomUUID();
      await fs.writeFile(file(k, v), buf, { mode: 0o600 });
      return v;
    },
    get: async (k, v) => {
      if (!/^[0-9a-f-]{36}$/.test(v)) throw Error("Versão inválida.");
      return fs.readFile(file(k, v));
    },
  };
} else {
  const c = carregarCliente(process.env.SEDUC_CLIENTE || "pedro-ii"),
    credential = JSON.parse(process.env.SEDUC_ADMIN_CREDENTIALS_JSON || "null");
  if (credential?.project_id !== c.firebase.projectId)
    throw Error("Credencial do cliente não configurada.");
  app = initializeApp({
    credential: cert(credential),
    projectId: c.firebase.projectId,
  });
  clienteId = c.id;
  rateSecret = credential.private_key;
  b2 = criarB2(process.env);
}
const handler = criarHandlerEditais({
  db: getFirestore(app),
  auth: getAuth(app),
  b2,
  clienteId,
  rateSecret,
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
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/api/editais")
      return res.status(404).json({ erro: "Rota inexistente." });
    req.query = Object.fromEntries(url.searchParams);
    try {
      if (req.method === "POST") {
        let n = 0;
        const parts = [];
        for await (const part of req) {
          n += part.length;
          if (n > 3000000)
            return res.status(413).json({ erro: "Pedido muito grande." });
          parts.push(part);
        }
        req.body = JSON.parse(Buffer.concat(parts));
      }
      await handler(req, res);
    } catch {
      if (!res.writableEnded)
        res.status(400).json({ erro: "Pedido inválido." });
    }
  })
  .listen(3002, "127.0.0.1", () =>
    console.log(
      "API de editais local: 127.0.0.1:3002. Ambiente: " +
        (emulador ? "EMULADOR, sem produção" : "cliente configurado"),
    ),
  );
