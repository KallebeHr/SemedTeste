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
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error("Somente emulador.");
let env;
const ctx = (uid) =>
  env
    .authenticatedContext(uid, { auth_time: Math.floor(Date.now() / 1000) })
    .firestore();
async function auditWrite(db, ref, patch, antes = null, ator = "master") {
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
    escolaId: ["escolas", "escolasPublicas"].includes(partes[0])
      ? partes[1]
      : null,
    dominio: "portal",
    acao: antes ? "update" : "create",
    usuarioId: ator,
    usuarioNome: "Master Teste",
    papelUsuario: ator,
    dadosAntes: antes,
    dadosDepois: depois,
    timestamp: serverTimestamp(),
  });
  return batch.commit();
}

before(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-escolas-cadastro",
    firestore: {
      host,
      port: Number(port),
      rules: fs.readFileSync("firebase/firestore.rules", "utf8"),
    },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    for (const papel of ["master", "alimentador"])
      await setDoc(doc(c.firestore(), "usuarios", papel), {
        papel,
        ativo: true,
        nome: "Master Teste",
      });
  });
});
after(async () => env?.cleanup());
test("Master cadastra apenas nome, edita, arquiva, preserva vínculos e reativa; exclusão física e escrita comum negadas", async () => {
  const db = ctx("master"),
    r = doc(db, "escolas", "id-antigo");
  await assertSucceeds(
    auditWrite(db, r, { nome: "Escola A", ativo: true, versao: 1 }),
  );
  let antes = (await getDoc(r)).data();
  await assertSucceeds(
    auditWrite(
      db,
      r,
      {
        ...antes,
        nome: "Escola A Renomeada",
        alunos: 12,
        funcionarios: 0,
        totalPessoasEscola: 12,
        versao: 2,
      },
      antes,
    ),
  );
  antes = (await getDoc(r)).data();
  await assertFails(
    auditWrite(db, r, { ...antes, totalPessoasEscola: 99 }, antes),
  );
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), "escolas/id-antigo/estoque/arroz"), {
      nome: "Arroz",
      quantidadeAtual: 15,
    });
    await setDoc(doc(c.firestore(), "alunos/aluno-1"), {
      escolaId: "id-antigo",
      nome: "Aluno teste",
    });
  });
  await assertSucceeds(
    auditWrite(
      db,
      r,
      { ...antes, ativo: false, arquivada: true, versao: 3 },
      antes,
    ),
  );
  await assertFails(deleteDoc(r));
  const estoque = await getDoc(doc(db, "escolas/id-antigo/estoque/arroz"));
  assert.equal(estoque.data().quantidadeAtual, 15);
  assert.equal(
    (await getDoc(doc(db, "alunos/aluno-1"))).data().escolaId,
    "id-antigo",
  );
  antes = (await getDoc(r)).data();
  await assertSucceeds(
    auditWrite(
      db,
      r,
      { ...antes, ativo: true, arquivada: false, versao: 4 },
      antes,
    ),
  );
  await assertFails(
    setDoc(doc(env.unauthenticatedContext().firestore(), r.path), {
      nome: "Intruso",
      ativo: true,
    }),
  );
  await assertFails(
    setDoc(doc(ctx("alimentador"), r.path), {
      ...antes,
      observacoes: "Alteração não autorizada",
    }),
  );
});
test("projeção pública autoriza só nome; observações e responsável não podem ser publicados", async () => {
  const db = ctx("master"),
    p = doc(db, "escolasPublicas", "id-antigo");
  const base = {
    nome: "Escola A Renomeada",
    endereco: "",
    contato: "",
    etapas: "",
    horario: "",
    sobre: "",
    publicadoEm: serverTimestamp(),
  };
  await assertSucceeds(auditWrite(db, p, base));
  const snap = await getDoc(
    doc(env.unauthenticatedContext().firestore(), p.path),
  );
  assert.equal(snap.data().nome, "Escola A Renomeada");
  assert(!("responsavel" in snap.data()));
  await assertFails(
    auditWrite(
      db,
      p,
      { ...base, responsavel: "Nome privado" },
      (await getDoc(p)).data(),
    ),
  );
});

test("legado da gestão pode cadastrar nome, mas não pode editar novos dados administrativos com auditoria válida", async () => {
  const staff = ctx("alimentador");
  await assertSucceeds(
    auditWrite(
      staff,
      doc(staff, "escolas", "legado-staff"),
      { nome: "Escola do fluxo de estoque", ativo: true },
      null,
      "alimentador",
    ),
  );
  const ref = doc(staff, "escolas", "id-antigo"),
    antes = (await getDoc(ref)).data();
  await assertFails(
    auditWrite(
      staff,
      ref,
      { ...antes, responsavel: "Mudança indevida" },
      antes,
      "alimentador",
    ),
  );
});
