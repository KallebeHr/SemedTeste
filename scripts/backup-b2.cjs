// Exporta somente as versões referenciadas pelo Firestore; nunca exclui arquivos.
const fs = require("node:fs/promises"),
  path = require("node:path"),
  { createHash } = require("node:crypto");
const { initializeApp, cert, deleteApp } = require("firebase-admin/app"),
  { getFirestore } = require("firebase-admin/firestore");
const { carregarCliente } = require("./cliente.cjs"),
  { criarB2 } = require("../server/alimentacao/b2.cjs");
async function executar() {
  const c = carregarCliente(process.env.SEDUC_CLIENTE),
    cred = JSON.parse(process.env.SEDUC_ADMIN_CREDENTIALS_JSON || "null");
  if (!cred || cred.project_id !== c.firebase.projectId)
    throw new Error("Credencial e cliente devem ser do mesmo projeto.");
  const app = initializeApp({
    projectId: c.firebase.projectId,
    credential: cert(cred),
  });
  try {
    const db = getFirestore(app),
      b2 = criarB2(process.env),
      pasta = path.resolve(
        "backups-b2",
        c.id + "-" + new Date().toISOString().replace(/[:.]/g, "-"),
      );
    await fs.mkdir(pasta, { recursive: true, mode: 0o700 });
    const snap = await db.collectionGroup("documentos").get(),
      manifesto = {
        cliente: c.id,
        projectId: c.firebase.projectId,
        bucket: process.env.B2_BUCKET,
        geradoEm: new Date().toISOString(),
        arquivos: [],
        pendentes: [],
      };
    for (const s of snap.docs) {
      const d = s.data();
      if (!/^escolas\/[^/]+\/documentos\/[^/]+$/.test(s.ref.path)) continue;
      if (d.estado !== "pronto") {
        manifesto.pendentes.push(s.ref.path);
        continue;
      }
      if (!d.key?.startsWith(c.id + "/") || !d.versionId)
        throw new Error("Referência inválida: " + s.ref.path);
      const bytes = await b2.get(d.key, d.versionId),
        sha = createHash("sha256").update(bytes).digest("hex");
      if (sha !== d.sha256)
        throw new Error("Integridade divergente: " + s.ref.path);
      const nome =
        createHash("sha256").update(s.ref.path).digest("hex") + ".bin";
      await fs.writeFile(path.join(pasta, nome), bytes, { mode: 0o600 });
      manifesto.arquivos.push({
        documento: s.ref.path,
        arquivo: nome,
        key: d.key,
        versionId: d.versionId,
        sha256: sha,
        mime: d.mime,
        tamanho: bytes.length,
      });
    }
    await fs.writeFile(
      path.join(pasta, "manifesto.json"),
      JSON.stringify(manifesto, null, 2),
      { mode: 0o600 },
    );
    console.log(
      "Cópia B2 concluída: " +
        pasta +
        " (" +
        manifesto.arquivos.length +
        " arquivos). Faça também o backup do Firestore.",
    );
  } finally {
    await deleteApp(app);
  }
}
if (require.main === module)
  executar().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
