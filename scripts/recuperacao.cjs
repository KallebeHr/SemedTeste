const fs = require("node:fs"),
  path = require("node:path");
const {
  initializeApp,
  applicationDefault,
  deleteApp,
} = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { carregarCliente, argumentos, raiz } = require("./cliente.cjs");
const {
  codificar,
  decodificar,
  resumo,
  criptografar,
  abrir,
} = require("./arquivo-backup.cjs");

function ambiente(projectId) {
  const emulado =
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (
    emulado &&
    (!projectId.startsWith("demo-") ||
      ![
        process.env.FIRESTORE_EMULATOR_HOST,
        process.env.FIREBASE_AUTH_EMULATOR_HOST,
      ].every((h) => /^(127\.0\.0\.1|localhost):\d+$/.test(h || "")))
  )
    throw new Error(
      "Emuladores exigem projeto demo- e ambos os serviços locais.",
    );
  const app = initializeApp(
    { projectId, ...(emulado ? {} : { credential: applicationDefault() }) },
    "recuperacao-" + projectId + "-" + Date.now(),
  );
  return { app, db: getFirestore(app), auth: getAuth(app), emulado: !!emulado };
}
async function listarContas(auth) {
  let contas = [],
    page;
  do {
    const r = await auth.listUsers(1000, page);
    contas.push(...r.users.map((u) => JSON.parse(JSON.stringify(u.toJSON()))));
    page = r.pageToken;
  } while (page);
  return contas.sort((a, b) => a.uid.localeCompare(b.uid));
}
async function todosDocumentos(db) {
  const docs = [];
  // A manutenção bloqueia escritas clientes; o snapshot transacional mantém a
  // consistência dos valores. Pausar também integrações/Admin SDK na operação real.
  await db.runTransaction(
    async (tx) => {
      async function visitar(col) {
        const refs = await col.listDocuments();
        for (let i = 0; i < refs.length; i += 100) {
          const grupo = refs.slice(i, i + 100),
            snapshots = await tx.getAll(...grupo);
          for (let j = 0; j < grupo.length; j++) {
            if (snapshots[j].exists && !grupo[j].path.startsWith("operacao/"))
              docs.push({
                path: grupo[j].path,
                data: codificar(snapshots[j].data()),
              });
            // Inclui subcoleções mesmo quando o documento pai não existe.
            for (const sub of await grupo[j].listCollections())
              await visitar(sub);
          }
        }
      }
      for (const col of await db.listCollections())
        if (col.id !== "operacao") await visitar(col);
    },
    { readOnly: true },
  );
  return docs.sort((a, b) => a.path.localeCompare(b.path));
}
function validarHashConfig(config, contas, emulado) {
  const senhas = contas.filter((u) =>
    u.providerData?.some((p) => p.providerId === "password"),
  );
  if (!senhas.length) return null;
  if (emulado)
    return {
      algorithm: "SCRYPT",
      key: "",
      saltSeparator: "",
      rounds: 8,
      memoryCost: 14,
      emulador: true,
    };
  if (senhas.some((u) => !u.passwordHash))
    throw new Error(
      "Faltam hashes das contas. Confira firebaseauth.configs.getHashConfig; o backup não será considerado completo.",
    );
  if (
    !config ||
    config.algorithm !== "SCRYPT" ||
    !config.key ||
    typeof config.saltSeparator !== "string" ||
    !Number.isInteger(config.rounds) ||
    !Number.isInteger(config.memoryCost)
  )
    throw new Error(
      "Forneça os parâmetros SCRYPT do Firebase em --hash-config arquivo.json para preservar as senhas.",
    );
  return config;
}
async function gerar(ctx, { cliente, senha, hashConfig }) {
  const lock = ctx.db.doc("operacao/estado"),
    id = require("node:crypto").randomUUID();
  await ctx.db.runTransaction(async (t) => {
    const s = await t.get(lock);
    if (s.data()?.bloqueado)
      throw new Error(
        "Já existe uma operação de manutenção. Verifique o estado antes de continuar.",
      );
    t.set(lock, {
      bloqueado: true,
      tipo: "backup",
      id,
      iniciadoEm: FieldValue.serverTimestamp(),
    });
  });
  try {
    const documentos = await todosDocumentos(ctx.db),
      contas = await listarContas(ctx.auth);
    if (
      contas.some(
        (u) =>
          u.tenantId ||
          u.multiFactor?.enrolledFactors?.some((f) => f.factorId !== "phone"),
      )
    )
      throw new Error(
        "A recuperação desta versão não suporta tenants do Authentication ou fatores TOTP. Use a recuperação específica desse provedor antes de prosseguir.",
      );
    const hash = validarHashConfig(hashConfig, contas, ctx.emulado);
    const arquivos = {};
    for (const n of [
      "firebase/firestore.rules",
      "firebase/firestore.indexes.json",
      "firebase/storage.rules",
      "firebase.json",
      "package.json",
    ])
      arquivos[n] = fs.readFileSync(path.join(raiz, n), "utf8");
    const dados = {
      formato: "seduc-recuperacao",
      versao: 1,
      cliente: cliente.id,
      projectId: ctx.app.options.projectId,
      geradoEm: new Date().toISOString(),
      emulador: ctx.emulado,
      documentos,
      contas,
      hashConfig: hash,
      configuracaoCliente: cliente,
      arquivos,
    };
    dados.manifesto = {
      documentos: documentos.length,
      contas: contas.length,
      sha256: resumo({ documentos, contas, arquivos }),
    };
    return { arquivo: criptografar(dados, senha), manifesto: dados.manifesto };
  } finally {
    await ctx.db.runTransaction(async (t) => {
      const s = await t.get(lock);
      if (s.data()?.id === id)
        t.set(lock, {
          bloqueado: false,
          concluidoEm: FieldValue.serverTimestamp(),
        });
    });
  }
}
function verificarArquivo(d) {
  if (
    d.formato !== "seduc-recuperacao" ||
    d.versao !== 1 ||
    !Array.isArray(d.documentos) ||
    !Array.isArray(d.contas)
  )
    throw new Error("Conteúdo incompatível.");
  if (
    d.manifesto.sha256 !==
      resumo({
        documentos: d.documentos,
        contas: d.contas,
        arquivos: d.arquivos,
      }) ||
    d.manifesto.documentos !== d.documentos.length ||
    d.manifesto.contas !== d.contas.length
  )
    throw new Error("Contagem ou integridade do backup inválida.");
  if (
    new Set(d.documentos.map((v) => v.path)).size !== d.documentos.length ||
    new Set(d.contas.map((v) => v.uid)).size !== d.contas.length
  )
    throw new Error("Registros repetidos no backup.");
  for (const r of d.documentos)
    if (
      !/^[^/]+\/[^/]+(?:\/[^/]+\/[^/]+)*$/.test(r.path) ||
      r.path.startsWith("operacao/")
    )
      throw new Error("Caminho inválido no backup.");
}
function contaImportacao(u) {
  const r = {};
  for (const k of [
    "uid",
    "email",
    "emailVerified",
    "displayName",
    "disabled",
    "phoneNumber",
    "photoURL",
    "customClaims",
    "providerData",
    "multiFactor",
  ])
    if (u[k] !== undefined) r[k] = u[k];
  if (u.metadata)
    r.metadata = {
      creationTime: u.metadata.creationTime,
      lastSignInTime: u.metadata.lastSignInTime,
    };
  if (u.passwordHash) r.passwordHash = Buffer.from(u.passwordHash, "base64");
  if (u.passwordSalt) r.passwordSalt = Buffer.from(u.passwordSalt, "base64");
  return r;
}
async function restaurar(ctx, d, { aplicar = false, retomar = false } = {}) {
  verificarArquivo(d);
  if (!ctx.emulado && d.emulador)
    throw new Error("Backups de teste não podem ser restaurados em produção.");
  const atuais = await todosDocumentos(ctx.db),
    contas = await listarContas(ctx.auth);
  const estado = (await ctx.db.doc("operacao/estado").get()).data();
  const retomada =
    retomar &&
    estado?.tipo === "restauracao" &&
    estado?.sha256 === d.manifesto.sha256 &&
    estado?.bloqueado;
  if (!retomada && (atuais.length || contas.length))
    throw new Error(
      "O destino deve estar vazio. A ferramenta não mistura nem sobrescreve uma base em uso.",
    );
  if (retomar && !retomada)
    throw new Error(
      "Não há restauração interrompida deste arquivo no destino.",
    );
  // Em retomada, qualquer divergência é tratada como conflito; não é sobrescrita.
  const previstos = new Map(d.documentos.map((r) => [r.path, resumo(r.data)]));
  for (const r of atuais)
    if (previstos.get(r.path) !== resumo(r.data))
      throw new Error("Conflito no destino: " + r.path);
  const porUid = new Map(d.contas.map((c) => [c.uid, c]));
  for (const u of contas)
    if (!porUid.has(u.uid) || porUid.get(u.uid).email !== u.email)
      throw new Error("Conflito entre contas de acesso.");
  const plano = {
    origem: d.projectId,
    destino: ctx.app.options.projectId,
    documentos: d.documentos.length,
    contas: d.contas.length,
    aplicar,
  };
  if (!aplicar) return plano;
  const lock = ctx.db.doc("operacao/estado");
  await lock.set({
    bloqueado: true,
    tipo: "restauracao",
    sha256: d.manifesto.sha256,
    iniciadoEm: FieldValue.serverTimestamp(),
  });
  try {
    const existentes = new Set(contas.map((u) => u.uid));
    let hash;
    if (d.hashConfig)
      hash = d.hashConfig.emulador
        ? {
            algorithm: "SCRYPT",
            key: Buffer.from("demo-only"),
            saltSeparator: Buffer.from("demo-only"),
            rounds: 8,
            memoryCost: 14,
          }
        : {
            algorithm: "SCRYPT",
            key: Buffer.from(d.hashConfig.key, "base64"),
            saltSeparator: Buffer.from(d.hashConfig.saltSeparator, "base64"),
            rounds: d.hashConfig.rounds,
            memoryCost: d.hashConfig.memoryCost,
          };
    const novas = d.contas.filter((u) => !existentes.has(u.uid));
    for (let i = 0; i < novas.length; i += 1000) {
      const grupo = novas.slice(i, i + 1000);
      if (ctx.emulado) {
        // O emulador usa hashes fictícios em texto; a conversão base64 do Admin
        // SDK é exclusiva dos hashes reais e destruiria os valores do emulador.
        const users = grupo.map((u) => ({
          localId: u.uid,
          email: u.email,
          emailVerified: u.emailVerified,
          displayName: u.displayName,
          photoUrl: u.photoURL,
          disabled: u.disabled,
          phoneNumber: u.phoneNumber,
          passwordHash: u.passwordHash,
          salt: u.passwordSalt,
          customAttributes: JSON.stringify(u.customClaims || {}),
          createdAt: u.metadata?.creationTime
            ? String(Date.parse(u.metadata.creationTime))
            : undefined,
          lastLoginAt: u.metadata?.lastSignInTime
            ? String(Date.parse(u.metadata.lastSignInTime))
            : undefined,
          providerUserInfo: (u.providerData || []).map((p) => ({
            providerId: p.providerId,
            rawId: p.uid,
            email: p.email,
            displayName: p.displayName,
            photoUrl: p.photoURL,
          })),
          mfaInfo: u.multiFactor?.enrolledFactors?.map((f) => ({
            mfaEnrollmentId: f.uid,
            displayName: f.displayName,
            phoneInfo: f.phoneNumber,
            enrolledAt: f.enrollmentTime,
          })),
        }));
        const r = await fetch(
          "http://" +
            process.env.FIREBASE_AUTH_EMULATOR_HOST +
            "/identitytoolkit.googleapis.com/v1/projects/" +
            ctx.app.options.projectId +
            "/accounts:batchCreate",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer owner",
            },
            body: JSON.stringify({ users, sanityCheck: true }),
          },
        );
        const resposta = await r.json();
        if (!r.ok || resposta.error?.length)
          throw new Error("Falha ao importar contas do emulador.");
      } else {
        const r = await ctx.auth.importUsers(
          grupo.map(contaImportacao),
          hash ? { hash } : undefined,
        );
        if (r.failureCount)
          throw new Error(
            "Falha ao importar contas: " +
              r.errors.map((e) => e.error.code).join(", "),
          );
      }
    }
    const escritos = new Set(atuais.map((r) => r.path));
    const faltantes = d.documentos.filter((r) => !escritos.has(r.path));
    for (let i = 0; i < faltantes.length; i += 200) {
      const b = ctx.db.batch();
      for (const r of faltantes.slice(i, i + 200))
        b.create(ctx.db.doc(r.path), decodificar(r.data, ctx.db));
      await b.commit();
    }
    const verificados = await todosDocumentos(ctx.db),
      usuarios = await listarContas(ctx.auth);
    if (
      resumo(verificados) !== resumo(d.documentos) ||
      usuarios.length !== d.contas.length
    )
      throw new Error("A verificação da restauração encontrou divergência.");
    for (const u of usuarios) {
      const original = porUid.get(u.uid);
      for (const k of [
        "email",
        "emailVerified",
        "displayName",
        "disabled",
        "phoneNumber",
        "photoURL",
      ])
        if ((u[k] ?? null) !== (original[k] ?? null))
          throw new Error("Uma conta não corresponde ao backup.");
      for (const k of ["passwordHash", "passwordSalt"])
        if (
          original[k] &&
          (ctx.emulado
            ? u[k] !== original[k]
            : !Buffer.from(u[k] || "", "base64").equals(
                Buffer.from(original[k], "base64"),
              ))
        )
          throw new Error("Uma credencial não foi preservada na recuperação.");
      const provedores = (v) =>
        [...(v.providerData || [])].sort((a, b) =>
          a.providerId.localeCompare(b.providerId),
        );
      if (
        resumo(codificar(provedores(u))) !==
          resumo(codificar(provedores(original))) ||
        resumo(codificar(u.multiFactor || null)) !==
          resumo(codificar(original.multiFactor || null))
      )
        throw new Error("Provedores ou fatores de autenticação divergentes.");
      if (
        resumo(codificar(u.customClaims || {})) !==
        resumo(codificar(original.customClaims || {}))
      )
        throw new Error("Permissões de identidade divergentes.");
    }
    // Mantém manutenção até regras/índices e domínio serem conferidos pelo operador.
    await lock.set({
      bloqueado: true,
      tipo: "restauracao",
      sha256: d.manifesto.sha256,
      verificada: true,
      concluidoEm: FieldValue.serverTimestamp(),
    });
    return { ...plano, verificada: true };
  } catch (e) {
    throw new Error(
      e.message +
        " A manutenção permanece ativa; corrija a causa e utilize --retomar.",
    );
  }
}
async function senhaOculta() {
  if (process.env.SEDUC_BACKUP_SENHA) return process.env.SEDUC_BACKUP_SENHA;
  if (!process.stdin.isTTY)
    throw new Error(
      "Informe SEDUC_BACKUP_SENHA em ambiente seguro ou execute em um terminal interativo.",
    );
  process.stderr.write("Senha do backup (mínimo 16 caracteres): ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let s = "";
    const ler = (b) => {
      const v = b.toString();
      if (v === "\u0003") {
        fim();
        reject(new Error("Cancelado."));
      } else if (v === "\r" || v === "\n") {
        fim();
        resolve(s);
      } else if (v === "\u007f" || v === "\b") s = s.slice(0, -1);
      else s += v;
    };
    function fim() {
      process.stdin.off("data", ler);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stderr.write("\n");
    }
    process.stdin.on("data", ler);
  });
}
async function main() {
  const a = argumentos(),
    cliente = carregarCliente(a.cliente),
    project = cliente.firebase.projectId;
  if (a["confirmar-projeto"] !== project)
    throw new Error("Confirme --confirmar-projeto " + project);
  const ctx = ambiente(project);
  try {
    if (a.acao === "backup") {
      if (!a.arquivo) throw new Error("Informe --arquivo caminho.seducbak.");
      if (fs.existsSync(a.arquivo))
        throw new Error("O arquivo já existe. Escolha outro nome.");
      const senha = await senhaOculta(),
        hashConfig = a["hash-config"]
          ? JSON.parse(fs.readFileSync(a["hash-config"], "utf8"))
          : null;
      const r = await gerar(ctx, { cliente, senha, hashConfig });
      fs.writeFileSync(a.arquivo, r.arquivo, { flag: "wx", mode: 0o600 });
      console.log("Backup protegido concluído.", r.manifesto);
    } else if (a.acao === "restaurar") {
      const d = abrir(fs.readFileSync(a.arquivo), await senhaOculta());
      if (d.projectId !== project && !a["permitir-projeto-diferente"])
        throw new Error(
          "Origem e destino diferentes. Para recuperação isolada, use --permitir-projeto-diferente após conferir o cliente.",
        );
      console.log(
        await restaurar(ctx, d, { aplicar: !!a.aplicar, retomar: !!a.retomar }),
      );
    } else if (a.acao === "liberar") {
      const r = ctx.db.doc("operacao/estado"),
        s = (await r.get()).data();
      if (!s?.verificada || !a["regras-conferidas"])
        throw new Error(
          "Libere somente restauração verificada, com --regras-conferidas após publicar as regras e índices.",
        );
      await r.update({
        bloqueado: false,
        liberadoEm: FieldValue.serverTimestamp(),
      });
      console.log("Manutenção encerrada.");
    } else
      throw new Error(
        "Ações disponíveis: --acao backup, restaurar ou liberar.",
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
module.exports = {
  ambiente,
  gerar,
  restaurar,
  todosDocumentos,
  listarContas,
  verificarArquivo,
  senhaOculta,
};
