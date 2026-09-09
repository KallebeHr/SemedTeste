const fs = require("node:fs"),
  path = require("node:path");
const raiz = path.resolve(__dirname, "..");
function carregarCliente(id, pasta = path.join(raiz, "clientes")) {
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(id || ""))
    throw new Error("Identificador de cliente inválido.");
  const dados = JSON.parse(
    fs.readFileSync(path.join(pasta, id + ".json"), "utf8"),
  );
  const f = dados.firebase;
  if (
    dados.id !== id ||
    !dados.nome ||
    !dados.municipio ||
    !f ||
    !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(f.projectId || "") ||
    !f.apiKey ||
    !f.appId ||
    f.authDomain !== f.projectId + ".firebaseapp.com"
  )
    throw new Error(
      "Preencha e confira a configuração Firebase do cliente " + id + ".",
    );
  if (
    Object.keys(f).some(
      (k) =>
        ![
          "apiKey",
          "authDomain",
          "projectId",
          "storageBucket",
          "messagingSenderId",
          "appId",
          "measurementId",
        ].includes(k),
    )
  )
    throw new Error(
      "A configuração pública contém campos não permitidos. Nunca inclua chaves de serviço.",
    );
  for (const nome of fs
    .readdirSync(pasta)
    .filter((n) => n.endsWith(".json") && n !== id + ".json")) {
    const outro = JSON.parse(fs.readFileSync(path.join(pasta, nome), "utf8"));
    if (outro.firebase?.projectId === f.projectId)
      throw new Error(
        "Clientes diferentes não podem compartilhar o mesmo projeto Firebase.",
      );
  }
  return dados;
}
function argumentos(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--"))
      throw new Error("Argumento inválido: " + argv[i]);
    const k = argv[i].slice(2);
    if (['aplicar','retomar','permitir-projeto-diferente','regras-conferidas','uma-vez'].includes(k) && argv[i+1] && !argv[i+1].startsWith('--')) throw new Error('A opção --'+k+' não recebe valor. Omita a opção para não executar a ação.');
    args[k] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
  }
  return args;
}
function validarImplantacao(c, m, confirmacao) {
  if (m.cliente !== c.id || m.projectId !== c.firebase.projectId)
    throw new Error(
      "O build pertence a outro cliente. Gere o build correto antes de publicar.",
    );
  if (confirmacao !== c.firebase.projectId)
    throw new Error("Confirme o projeto de destino antes de publicar.");
}
module.exports = { carregarCliente, argumentos, raiz, validarImplantacao };
