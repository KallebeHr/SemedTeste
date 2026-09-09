const { spawnSync } = require("node:child_process");
const fs = require("node:fs"),
  path = require("node:path");
const { carregarCliente, argumentos, raiz } = require("./cliente.cjs");
try {
  const args = argumentos(),
    c = carregarCliente(args.cliente);
  const r = spawnSync(
    process.execPath,
    [path.join(raiz, "node_modules/vite/bin/vite.js"), "build"],
    {
      cwd: raiz,
      stdio: "inherit",
      env: { ...process.env, SEDUC_CLIENTE: c.id },
    },
  );
  if (r.status !== 0) process.exit(r.status || 1);
  fs.writeFileSync(
    path.join(raiz, "dist/implantacao.json"),
    JSON.stringify(
      {
        cliente: c.id,
        projectId: c.firebase.projectId,
        versao: 2,
        geradoEm: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log("Build identificado:", c.id, "/", c.firebase.projectId);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
