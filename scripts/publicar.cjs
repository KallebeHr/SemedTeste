const fs = require("node:fs"),
  path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  carregarCliente,
  argumentos,
  raiz,
  validarImplantacao,
} = require("./cliente.cjs");
try {
  const a = argumentos(),
    c = carregarCliente(a.cliente),
    project = c.firebase.projectId;
  const m = JSON.parse(
    fs.readFileSync(path.join(raiz, "dist/implantacao.json"), "utf8"),
  );
  validarImplantacao(c, m, a["confirmar-projeto"]);
  const r = spawnSync(
    process.execPath,
    [
      path.join(raiz, "node_modules/firebase-tools/lib/bin/firebase.js"),
      "deploy",
      "--only",
      "hosting,firestore:rules,firestore:indexes",
      "--project",
      project,
    ],
    { cwd: raiz, stdio: "inherit" },
  );
  if (r.error) throw r.error;
  process.exitCode = r.status ?? 1;
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
