import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  collectionGroup,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { configuracao, campos, DECLARACAO } from "../../shared/editais.mjs";
import {
  enviarFicha,
  listarFichas,
  catalogoFormularios,
  refFicha,
  protocoloFicha,
  resumoConfig,
} from "../../src/services/editaisFirestore.mjs";
if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error("Somente emulador.");
let env;
const id = "edital-texto",
  now = Date.now();
const c = {
  ...configuracao({
    ativo: true,
    validado: true,
    privacidade: "Aviso institucional",
  }),
  modo: "texto",
  versao: 1,
  pdf: null,
  inicioEm: null,
  fimEm: null,
};
const ficha = {
  ...Object.fromEntries(campos(c).map((f) => [f.id, "Escola Teste"])),
  telefone: "(86) 99999-1234",
  email: "teste@example.com",
  coautores: "",
  aceite: true,
};
const ctx = (uid) =>
  env
    .authenticatedContext(uid, {
      auth_time: Math.floor(now / 1000),
      firebase: { sign_in_provider: "anonymous" },
    })
    .firestore();
async function seed(path, data) {
  await env.withSecurityRulesDisabled(async (context) =>
    setDoc(doc(context.firestore(), path), data),
  );
}
async function auditWrite(db, ref, patch, antes = null) {
  const batch = writeBatch(db),
    a = doc(db, "auditoriaRegistros", crypto.randomUUID());
  const depois = {
    ...antes,
    ...patch,
    _auditoria: a.id,
    _registradoEm: serverTimestamp(),
  };
  const partes = ref.path.split("/");
  batch.set(ref, depois);
  batch.set(a, {
    versaoEsquema: 1,
    caminho: ref.path,
    alvo: ref,
    colecao: partes.at(-2),
    documentoId: ref.id,
    escolaId: null,
    dominio: "portal",
    acao: antes ? "update" : "create",
    usuarioId: "master",
    usuarioNome: "Master Teste",
    papelUsuario: "master",
    dadosAntes: antes,
    dadosDepois: depois,
    timestamp: serverTimestamp(),
  });
  return batch.commit();
}
before(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-seduc-direto",
    firestore: {
      host,
      port: Number(port),
      rules: fs.readFileSync("firebase/firestore.rules", "utf8"),
    },
  });
  await env.clearFirestore();
  await seed("usuarios/master", {
    papel: "master",
    ativo: true,
    nome: "Master Teste",
  });
  await seed("usuarios/editor", {
    papel: "alimentador",
    ativo: true,
    nome: "Editor",
  });
  await seed("conteudos/" + id, { tipo: "edital", titulo: "Teste" });
  await seed("publicacoes/" + id, { tipo: "edital", titulo: "Teste" });
});
after(async () => env?.cleanup());
test("Master configura com auditoria; público não altera configuração nem PDF", async () => {
  const db = ctx("master"),
    ref = doc(db, "editaisConfiguracao", id);
  await assertFails(setDoc(ref, c));
  await assertSucceeds(auditWrite(db, ref, c));
  await assertSucceeds(
    getDoc(
      doc(env.unauthenticatedContext().firestore(), "editaisConfiguracao", id),
    ),
  );
  await assertFails(
    updateDoc(doc(ctx("pessoa"), "editaisConfiguracao", id), { ativo: false }),
  );
  await assertFails(updateDoc(ref, { pdf: { key: "injetado" } }));
});
test("envio direto confirmado, repetição idempotente e isolamento de dados", async () => {
  const db = ctx("participante");
  const r = await enviarFicha(db, "participante", id, ficha, 1);
  assert.equal(r.status, "recebida");
  assert.equal(r.protocolo, await protocoloFicha(id, "participante"));
  assert.ok(r.criadoEm);
  assert.equal(r.dados.escola, "Escola Teste");
  const repeat = await enviarFicha(db, "participante", id, { ...ficha }, 1);
  assert.equal(repeat.protocolo, r.protocolo);
  await assert.rejects(
    enviarFicha(db, "participante", id, { ...ficha, titulo: "Outro" }, 1),
    /outros dados/,
  );
  await assertFails(getDoc(refFicha(ctx("outra"), id, "participante")));
  await assertFails(
    getDoc(
      refFicha(env.unauthenticatedContext().firestore(), id, "participante"),
    ),
  );
  await assertFails(getDocs(collectionGroup(db, "inscricoesTexto")));
  await assertFails(
    updateDoc(refFicha(db, id, "participante"), { status: "confirmada" }),
  );
  await assertFails(
    updateDoc(refFicha(ctx("editor"), id, "participante"), {
      status: "confirmada",
    }),
  );
});
test("regras rejeitam payloads adulterados, campos extras e datas falsas", async () => {
  const db = ctx("fraude"),
    ref = refFicha(db, id, "fraude");
  const payload = {
    uid: "fraude",
    editalId: id,
    protocolo: await protocoloFicha(id, "fraude"),
    dados: ficha,
    config: resumoConfig(c),
    versaoConfig: 1,
    declaracao: DECLARACAO,
    status: "recebida",
    criadoEm: serverTimestamp(),
    aceiteEm: serverTimestamp(),
  };
  for (const patch of [
    { status: "confirmada" },
    { uid: "outro" },
    { protocolo: "inventado" },
    { versaoConfig: 2 },
    { criadoEm: Timestamp.fromMillis(0) },
    { config: { ...resumoConfig(c), nome: "Falso" } },
    { dados: { ...ficha, aceite: false } },
    { dados: { ...ficha, email: "invalido" } },
    { dados: { ...ficha, escola: "" } },
    { dados: { ...ficha, acoes: "x".repeat(20001) } },
    { dados: { ...ficha, extra: "injetado" } },
    { declaracao: "não aceitei" },
    { arquivos: [] },
  ])
    await assertFails(setDoc(ref, { ...payload, ...patch }));
  await assertFails(setDoc(refFicha(db, id, "outra"), payload));
});
test("Master lista, busca, conta e confirma somente com auditoria vinculada", async () => {
  const db = ctx("master");
  const list = await listarFichas(db, id, {
    busca: "Escola",
    campoBusca: "dados.responsavel",
  });
  assert.equal(list.linhas.length, 1);
  const protocol = await listarFichas(db, id, {
    busca: list.linhas[0].protocolo,
    campoBusca: "protocolo",
  });
  assert.equal(protocol.linhas.length, 1);
  const ref = refFicha(db, id, "participante"),
    antes = (await getDoc(ref)).data();
  await assertFails(
    updateDoc(ref, {
      status: "confirmada",
      confirmadoPor: "master",
      confirmadoEm: serverTimestamp(),
    }),
  );
  await assertSucceeds(
    auditWrite(
      db,
      ref,
      {
        status: "confirmada",
        confirmadoPor: "master",
        confirmadoEm: serverTimestamp(),
      },
      antes,
    ),
  );
  const totals = await catalogoFormularios(db);
  assert.equal(totals.totais.recebidas, 1);
  assert.equal(totals.totais.confirmadas, 1);
  const confirmado = (await getDoc(ref)).data();
  await assertFails(
    auditWrite(db, ref, { dados: { ...ficha, titulo: "Mudado" } }, confirmado),
  );
});
test("servidor impede novas inscrições encerradas, ocultas ou em manutenção", async () => {
  await seed("editaisConfiguracao/" + id, {
    ...c,
    fimEm: Timestamp.fromMillis(now - 1000),
  });
  await assert.rejects(enviarFicha(ctx("atrasado"), "atrasado", id, ficha, 1));
  // Comprovante existente continua recuperável após encerramento.
  assert.equal(
    (await enviarFicha(ctx("participante"), "participante", id, ficha, 1))
      .status,
    "confirmada",
  );
  await seed("editaisConfiguracao/" + id, c);
  await seed("operacao/estado", { bloqueado: true });
  await assert.rejects(
    enviarFicha(ctx("manutencao"), "manutencao", id, ficha, 1),
  );
  await seed("operacao/estado", { bloqueado: false });
  await env.withSecurityRulesDisabled(async (x) => {
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(x.firestore(), "publicacoes", id));
  });
  await assert.rejects(enviarFicha(ctx("oculto"), "oculto", id, ficha, 1));
});
test("modelo personalizado valida todos os campos nas regras", async () => {
  const personalizado = {
    ...c,
    modelo: "personalizado",
    camposExtras: ["Proposta", "Objetivo"],
  };
  await seed("publicacoes/" + id, { tipo: "edital" });
  await seed("editaisConfiguracao/" + id, personalizado);
  const d = {
    responsavel: "Autor",
    email: "autor@example.com",
    extra0: "Proposta",
    extra1: "Objetivo",
    aceite: true,
  };
  const r = await enviarFicha(ctx("custom"), "custom", id, d, 1);
  assert.equal(r.dados.extra1, "Objetivo");
  const payload = {
    uid: "invalido",
    editalId: id,
    protocolo: await protocoloFicha(id, "invalido"),
    dados: { ...d, extra1: 33 },
    config: resumoConfig(personalizado),
    versaoConfig: 1,
    declaracao:
      "Declaro que as informações prestadas são verdadeiras e que li o regulamento e o aviso de privacidade.",
    status: "recebida",
    criadoEm: serverTimestamp(),
    aceiteEm: serverTimestamp(),
  };
  await assertFails(setDoc(refFicha(ctx("invalido"), id, "invalido"), payload));
});

test("paginação entrega páginas distintas e modelo de 15 campos permanece válido", async () => {
  const full = {
    ...c,
    modelo: "personalizado",
    camposExtras: Array.from({ length: 15 }, (_, i) => "Campo " + i),
  };
  await seed("editaisConfiguracao/" + id, full);
  const dados = {
    responsavel: "Autor",
    email: "autor@example.com",
    aceite: true,
    ...Object.fromEntries(
      Array.from({ length: 15 }, (_, i) => ["extra" + i, "Texto"]),
    ),
  };
  await enviarFicha(ctx("trinta"), "trinta", id, dados, 1);
  await env.withSecurityRulesDisabled(async (x) => {
    const banco = x.firestore(),
      batch = writeBatch(banco);
    for (let i = 0; i < 27; i++)
      batch.set(refFicha(banco, id, "pagina" + String(i).padStart(2, "0")), {
        uid: "pagina" + i,
        dados: { responsavel: "Pagina Teste" },
        status: "recebida",
        criadoEm: Timestamp.now(),
      });
    await batch.commit();
  });
  const first = await listarFichas(ctx("master"), id, {
    busca: "Pagina",
    campoBusca: "dados.responsavel",
  });
  const second = await listarFichas(ctx("master"), id, {
    busca: "Pagina",
    campoBusca: "dados.responsavel",
    cursor: first.cursor,
  });
  assert.equal(first.linhas.length, 25);
  assert.equal(second.linhas.length, 2);
  assert.equal(
    new Set([...first.linhas, ...second.linhas].map((x) => x.id)).size,
    27,
  );
  assert.equal(second.cursor, null);
});
