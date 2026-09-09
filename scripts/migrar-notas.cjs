const fs = require("node:fs");
const { createHash, randomUUID } = require("node:crypto");
const { deleteApp } = require("firebase-admin/app");
const { FieldValue } = require("firebase-admin/firestore");
const { carregarCliente, argumentos } = require("./cliente.cjs");
const {
  ambiente,
  verificarArquivo,
  senhaOculta,
} = require("./recuperacao.cjs");
const { codificar, resumo, abrir } = require("./arquivo-backup.cjs");

function chave(d) {
  const c = String(d.componente || "")
    .trim()
    .toLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(/[áàãâä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[íìîï]/g, "i")
    .replace(/[óòõôö]/g, "o")
    .replace(/[úùûü]/g, "u")
    .replace(/ç/g, "c")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (
    !c ||
    !Number.isInteger(d.ano) ||
    !Number.isInteger(d.bimestre) ||
    d.bimestre < 1 ||
    d.bimestre > 4 ||
    typeof d.professorUid !== "string" ||
    !d.professorUid ||
    !Number.isInteger(d.versao)
  )
    throw new Error(
      "Nota sem componente, período, professor ou versão válidos.",
    );
  return createHash("sha256")
    .update(`${c}|${d.ano}|${d.bimestre}|${d.professorUid}`)
    .digest("hex");
}
async function planejar(db, decisoes = {}) {
  const grupos = new Map(),
    invalidas = [];
  for (const doc of (await db.collectionGroup("notas").get()).docs) {
    if (!/^alunos\/[^/]+\/notas\/[^/]+$/.test(doc.ref.path)) continue;
    try {
      const destino = doc.ref.parent.path + "/" + chave(doc.data());
      if (!grupos.has(destino)) grupos.set(destino, []);
      grupos.get(destino).push({ path: doc.ref.path, data: doc.data() });
    } catch (e) {
      invalidas.push({ path: doc.ref.path, erro: e.message });
    }
  }
  const alteracoes = [];
  for (const [destino, registros] of grupos) {
    if (registros.length === 1 && registros[0].path === destino) continue;
    const escolhido =
      registros.length === 1 ? registros[0].path : decisoes[destino];
    alteracoes.push({
      destino,
      registros,
      escolhido: registros.some((r) => r.path === escolhido) ? escolhido : null,
    });
  }
  return { invalidas, alteracoes };
}
function relatorio(plano) {
  return {
    invalidas: plano.invalidas,
    alteracoes: plano.alteracoes.map((g) => ({
      destino: g.destino,
      escolhido: g.escolhido,
      registros: g.registros.map((r) => ({
        path: r.path,
        nota: r.data.nota,
        frequencia: r.data.frequencia,
        versao: r.data.versao,
      })),
    })),
  };
}
async function aplicar(ctx, plano, backup, operador) {
  verificarArquivo(backup);
  if (backup.projectId !== ctx.app.options.projectId)
    throw new Error("O backup precisa pertencer ao projeto de origem.");
  if (!operador || operador.trim().length < 3)
    throw new Error("Identifique o operador responsável pela manutenção.");
  if (plano.invalidas.length || plano.alteracoes.some((g) => !g.escolhido))
    throw new Error(
      "Resolva os registros inválidos e as decisões de duplicidade antes de aplicar.",
    );
  const preservados = new Map(
    backup.documentos.map((d) => [d.path, resumo(d.data)]),
  );
  for (const g of plano.alteracoes)
    for (const r of g.registros)
      if (preservados.get(r.path) !== resumo(codificar(r.data)))
        throw new Error(
          "O backup não contém o estado atual de todas as notas. Gere outro backup.",
        );
  const lock = ctx.db.doc("operacao/estado"),
    id = randomUUID();
  await ctx.db.runTransaction(async (t) => {
    const s = await t.get(lock);
    if (s.data()?.bloqueado) throw new Error("Outra manutenção está ativa.");
    t.set(lock, {
      bloqueado: true,
      tipo: "migracao_notas",
      id,
      iniciadoEm: FieldValue.serverTimestamp(),
    });
  });
  let concluidas = 0;
  try {
    for (const g of plano.alteracoes) {
      // Cada grupo é atômico. Os descartados permanecem integralmente no arquivo
      // restrito de migração e no histórico; uma decisão nunca apaga a evidência.
      await ctx.db.runTransaction(async (t) => {
        const refs = [
          ...new Set([...g.registros.map((r) => r.path), g.destino]),
        ].map((p) => ctx.db.doc(p));
        const atuais = await t.getAll(...refs),
          esperados = new Map(g.registros.map((r) => [r.path, r.data]));
        for (const s of atuais)
          if (
            resumo(codificar(s.exists ? s.data() : null)) !==
            resumo(codificar(esperados.get(s.ref.path) || null))
          )
            throw new Error(
              "Uma nota mudou após o planejamento. Gere novo backup e plano.",
            );
        const arquivo = ctx.db.collection("migracoesNotas").doc(),
          escolhida = g.registros.find((r) => r.path === g.escolhido);
        t.create(arquivo, {
          operador,
          backupSha256: backup.manifesto.sha256,
          escolhido: g.escolhido,
          destino: g.destino,
          originais: g.registros,
          criadoEm: FieldValue.serverTimestamp(),
        });
        for (const r of refs) {
          const antes = esperados.get(r.path) || null;
          const evento = ctx.db.collection("auditoriaRegistros").doc();
          const depois =
            r.path === g.destino
              ? {
                  ...escolhida.data,
                  _auditoria: evento.id,
                  _registradoEm: FieldValue.serverTimestamp(),
                }
              : null;
          if (depois) t.set(r, depois);
          else t.delete(r);
          t.create(evento, {
            versaoEsquema: 1,
            caminho: r.path,
            alvo: r,
            colecao: "notas",
            documentoId: r.id,
            escolaId: null,
            dominio: "portal",
            acao: depois ? (antes ? "update" : "create") : "delete",
            usuarioId: "operador_cli",
            usuarioNome: operador,
            papelUsuario: "manutencao",
            dadosAntes: antes,
            dadosDepois: depois,
            timestamp: FieldValue.serverTimestamp(),
            migracaoId: arquivo.id,
          });
        }
      });
      concluidas++;
    }
    return { gruposMigrados: concluidas };
  } finally {
    // Grupos confirmados permanecem íntegros. Um novo plano retoma apenas os restantes.
    await ctx.db.runTransaction(async (t) => {
      const s = await t.get(lock);
      if (s.data()?.id === id)
        t.set(lock, {
          bloqueado: false,
          tipo: "migracao_notas",
          gruposMigrados: concluidas,
          concluidoEm: FieldValue.serverTimestamp(),
        });
    });
  }
}
async function main() {
  const a = argumentos(),
    cliente = carregarCliente(a.cliente),
    project = cliente.firebase.projectId;
  if (a["confirmar-projeto"] !== project)
    throw new Error("Confirme --confirmar-projeto " + project);
  const ctx = ambiente(project);
  try {
    const decisoes = a.decisoes
      ? JSON.parse(fs.readFileSync(a.decisoes, "utf8"))
      : {};
    const plano = await planejar(ctx.db, decisoes);
    if (!a.aplicar) {
      if (!a.relatorio)
        throw new Error(
          "Informe --relatorio plano-notas.json. O plano não altera o banco.",
        );
      fs.writeFileSync(a.relatorio, JSON.stringify(relatorio(plano), null, 2), {
        flag: "wx",
        mode: 0o600,
      });
      console.log(
        "Plano gerado. Grupos:",
        plano.alteracoes.length,
        "Registros inválidos:",
        plano.invalidas.length,
      );
      return;
    }
    if (!a.backup)
      throw new Error("A aplicação exige --backup arquivo.seducbak recente.");
    console.log(
      await aplicar(
        ctx,
        plano,
        abrir(fs.readFileSync(a.backup), await senhaOculta()),
        a.operador,
      ),
    );
  } finally {
    await deleteApp(ctx.app);
  }
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
module.exports = { chave, planejar, relatorio, aplicar };
