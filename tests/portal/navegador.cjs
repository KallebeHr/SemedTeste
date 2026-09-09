// Executar somente por firebase emulators:exec. Nunca acessa dados de produção.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium, expect: expectBase } = require("@playwright/test");
const {default:AxeBuilder}=require('@axe-core/playwright');
const expect = expectBase.configure({ timeout: 15000 });
const { initializeTestEnvironment } = require("@firebase/rules-unit-testing");
const { doc, setDoc, Timestamp } = require("firebase/firestore");
const OUT =
  process.env.SEDUC_QA_OUTPUT || path.join(__dirname, "../../test-results");
const PASSWORD = "Somente-Teste-Local-2026!";
let ambiente, servidor, browser;
const erros = [];
async function conta(email) {
  const base = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/";
  const r = await fetch(base + "accounts:signUp?key=demo-seduc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      returnSecureToken: true,
    }),
  });
  const d = await r.json();
  if (!r.ok) throw Error(JSON.stringify(d));
  const v = await fetch(base + "projects/demo-seduc/accounts:update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer owner",
    },
    body: JSON.stringify({ localId: d.localId, emailVerified: true }),
  });
  if (!v.ok) throw Error(await v.text());
  return d.localId;
}
async function seed(caminho, dados) {
  await ambiente.withSecurityRulesDisabled((c) =>
    setDoc(doc(c.firestore(), caminho), dados),
  );
}
async function pagina() {
  const c = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await c.route("**/*", (r) => {
    const h = new URL(r.request().url()).hostname;
    if (["127.0.0.1", "localhost"].includes(h)) r.continue();
    else r.abort();
  });
  const p = await c.newPage();
  p.setDefaultTimeout(15000);
  p.setDefaultNavigationTimeout(30000);
  p.on("requestfailed", (r) => {
    if (!r.url().includes(".hot-update."))
      console.log("REDE", r.url().split("?")[0], r.failure()?.errorText);
  });
  p.on("pageerror", (e) => erros.push(e.message));
  return p;
}
async function ir(p, rota) {
  await p.goto("http://127.0.0.1:4173" + rota);
  await p.waitForLoadState("domcontentloaded");
}
async function login(p, email, admin = true) {
  await ir(p, admin ? "/login" : "/atendimento");
  await p.getByLabel("E-mail", { exact: true }).fill(email);
  await p.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await p.getByRole("button", { name: "Entrar", exact: true }).click();
  if (admin) await expect(p).toHaveURL(/\/administracao$/);
  else
    await expect(
      p.getByRole("heading", { name: "Nova solicitação" }),
    ).toBeVisible();
}
async function executar() {
  if (
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099"
  )
    throw Error("Os dois emuladores locais são obrigatórios.");
  fs.mkdirSync(OUT, { recursive: true });
  ambiente = await initializeTestEnvironment({
    projectId: "demo-seduc",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: fs.readFileSync(
        path.join(__dirname, "../../firebase/firestore.rules"),
        "utf8",
      ),
    },
  });
  await ambiente.clearFirestore();
  const master = await conta("master@example.test"),
    prof = await conta("professor@example.test"),
    familia = await conta("familia@example.test");
  await seed("usuarios/" + master, {
    nome: "Master de teste",
    papel: "master",
    ativo: true,
    email: "master@example.test",
    escolasVinculadas: [],
  });
  await seed("usuarios/" + prof, {
    nome: "Professor de teste",
    papel: "professor",
    ativo: true,
    email: "professor@example.test",
    escolasVinculadas: ["a"],
  });
  await seed("equipe/" + prof, {
    nome: "Professor de teste",
    papel: "professor",
    ativo: true,
    escolasVinculadas: ["a"],
  });
  await seed("escolas/a", { nome: "Escola de teste A", ativo: true });
  await seed("alunos/aluno-a", {
    nome: "Aluno de teste A",
    turma: "5º ano A",
    ano: 2026,
    responsavelUid: familia,
    professoresUids: [prof],
    escolaId: "a",
    ativo: true,
    versao: 1,
    atualizadoEm: Timestamp.now(),
  });
  await seed("escolas/a/assinaturas/publicavel", {
    metodo: "identificacao_cpf",
    versao: 2,
    nomeSignatario: "Responsável de teste",
    cpf: "52998224725",
    papelSignatario: "master",
    hashDocumento: "a".repeat(64),
    dataHora: Timestamp.now(),
    criadoPor: master,
    documentoId: "v1",
    documentoTipo: "vistoria",
    cargoDocumento: "responsavel",
  });
  await seed("escolas/a/vistorias/v1", {
    tipo: "sanitaria",
    status: "conforme",
    notaGeral: 10,
    data: Timestamp.now(),
    responsavelNome: "Responsável de teste",
    assinaturaResponsavelId: "publicavel",
    metodoConfirmacao: "identificacao_cpf",
    responsavelId: master,
    planoDeAcao: "Conteúdo interno que não será publicado",
  });
  process.env.VITE_FIREBASE_EMULATORS = "true";
  const { createServer } = await import("vite");
  servidor = await createServer({
    server: { host: "127.0.0.1", port: 4173, strictPort: true },
  });
  await servidor.listen();
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--no-zygote",
            "--single-process",
            "--disable-gpu",
          ],
        }
      : {}),
  });
  let publico = await pagina();
  await ir(publico, "/");
  await expect(
    publico.getByRole("heading", { name: "Como podemos ajudar?" }),
  ).toBeVisible();
  await expect(
    publico.getByText("Carregando informações…", { exact: true }),
  ).toHaveCount(0);
  await publico.screenshot({
    path: path.join(OUT, "inicio-desktop.png"),
    fullPage: true,
  });
  if (!process.env.SEDUC_QA_VISUAL_ONLY) {
    await ir(publico, "/merenda-escolar");
    await expect(
      publico.getByRole("heading", { name: "Cuidado que chega à mesa." }),
    ).toBeVisible();
    assert.equal(await publico.getByLabel("Senha", { exact: true }).count(), 0);
    await ir(publico, "/administracao/usuarios");
    await expect(publico).toHaveURL(/\/login\?redirect=/);
    const admin = await pagina();
    await login(admin, "master@example.test");
    await ir(admin, "/administracao/escolas");
    await admin.getByRole("button", { name: "Editar e publicar" }).click();
    await admin.getByLabel("Endereço público").fill("Endereço de teste");
    await admin
      .getByRole("checkbox", { name: "Exibir a ficha no portal público" })
      .check();
    await admin
      .getByRole("button", { name: "Salvar escola", exact: true })
      .click();
    await expect(
      admin.getByRole("status").filter({ hasText: "Escola salva" }),
    ).toBeVisible();
    await ir(admin, "/administracao/conteudos");
    await admin.getByRole("button", { name: "+ Novo conteúdo" }).click();
    await admin
      .getByLabel("Título", { exact: true })
      .fill("Publicação criada pelo painel");
    await admin
      .getByLabel("Resumo", { exact: true })
      .fill("Resumo criado no teste do portal.");
    await admin
      .getByLabel("Conteúdo completo", { exact: false })
      .fill("Texto publicado pela equipe.");
    await admin.getByRole("checkbox", { name: /Revisei o conteúdo/ }).check();
    await admin
      .getByRole("button", { name: "Publicar no portal", exact: true })
      .click();
    await expect(
      admin.getByRole("status").filter({ hasText: "Publicação concluída" }),
    ).toBeVisible();
    await ir(publico, "/busca?q=publicacao");
    await expect(
      publico.getByRole("heading", { name: "Publicação criada pelo painel" }),
    ).toBeVisible();
    await ir(admin, "/administracao/conteudos");
    await admin.getByLabel("Tipo de conteúdo").selectOption("cardapio");
    await admin.getByRole("button", { name: "+ Novo conteúdo" }).click();
    await admin
      .getByLabel("Título", { exact: true })
      .fill("Cardápio mensal de teste");
    await admin.getByLabel("Escola", { exact: true }).selectOption("a");
    await admin.getByLabel("Mês de referência").fill("2026-09");
    await admin
      .getByLabel("Cardápio completo")
      .fill(
        "Segunda-feira: arroz, feijão e legumes.\nTerça-feira: refeição de teste.",
      );
    await admin.getByRole("checkbox", { name: /Revisei o conteúdo/ }).check();
    await admin
      .getByRole("button", { name: "Publicar no portal", exact: true })
      .click();
    await expect(
      admin.getByRole("status").filter({ hasText: "Publicação concluída" }),
    ).toBeVisible();
    await ir(admin, "/administracao/vistorias");
    await admin.getByLabel("Escola", { exact: true }).selectOption("a");
    await admin.getByRole("button", { name: "Publicar resumo" }).click();
    await expect(
      admin.getByRole("status").filter({ hasText: "Resumo publicado" }),
    ).toBeVisible();
    await ir(publico, "/merenda-escolar?escola=a");
    await publico.getByLabel("Mês do cardápio").fill("2026-09");
    await expect(
      publico.getByRole("heading", { name: "Cardápio mensal de teste" }),
    ).toBeVisible();
    await expect(
      publico.getByRole("cell", { name: "Responsável de teste" }),
    ).toBeVisible();
    assert.equal(
      (await publico.locator("body").innerText()).includes(
        "Conteúdo interno que não será publicado",
      ),
      false,
    );
    const download = publico.waitForEvent("download");
    await publico
      .getByRole("button", { name: "Baixar cardápio em PDF" })
      .click();
    await (await download).saveAs(path.join(OUT, "cardapio-teste.pdf"));
    assert.ok(fs.statSync(path.join(OUT, "cardapio-teste.pdf")).size > 1000);
    await ir(admin, "/administracao/conteudos");
    await admin.getByLabel("Tipo de conteúdo").selectOption("servico");
    await admin.getByRole("button", { name: "+ Novo conteúdo" }).click();
    await admin
      .getByLabel("Título", { exact: true })
      .fill("Declaração escolar de teste");
    await admin.getByLabel("Identificador do serviço").fill("declaracao-teste");
    await admin
      .getByLabel("Conteúdo completo")
      .fill("Orientação completa cadastrada pela Secretaria.");
    await admin.getByRole("checkbox", { name: /Revisei o conteúdo/ }).check();
    await admin
      .getByRole("button", { name: "Publicar no portal", exact: true })
      .click();
    await expect(
      admin.getByRole("status").filter({ hasText: "Publicação concluída" }),
    ).toBeVisible();
    await ir(publico, "/servico/declaracao-teste");
    await expect(
      publico.getByText("Orientação completa cadastrada pela Secretaria.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      publico.getByRole("link", { name: "Solicitar atendimento" }),
    ).toBeVisible();
    console.log("ETAPA: CMS e documentos públicos passaram");
    await ir(admin, "/administracao/merenda");
    await admin.locator(".barra-escolas select").selectOption("a");
    await admin.getByRole("button", { name: "Vistorias", exact: true }).click();
    for (const b of await admin
      .getByRole("button", { name: "Conforme", exact: true })
      .all())
      await b.click();
    await admin
      .getByRole("button", { name: "Continuar para identificação" })
      .click();
    for (const [nome, cpf] of [
      ["Responsável do navegador", "52998224725"],
      ["Testemunha do navegador", "11144477735"],
    ]) {
      const form = admin.locator("form.identificacao").first();
      await form.getByLabel("Nome completo (nome e sobrenome)").fill(nome);
      await form.getByLabel("CPF", { exact: true }).fill(cpf);
      await form
        .getByRole("button", { name: "Confirmar identificação" })
        .click();
    }
    await admin
      .getByRole("button", { name: "Salvar vistoria", exact: true })
      .click();
    await expect(
      admin.getByRole("heading", { name: "Vistoria salva com sucesso" }),
    ).toBeVisible();
    await ir(admin, "/administracao/usuarios");
    await admin.getByRole("button", { name: "+ Cadastrar acesso" }).click();
    await admin
      .getByRole("checkbox", { name: "Criar também a conta de e-mail e senha" })
      .check();
    await admin
      .getByLabel("Nome completo", { exact: true })
      .fill("Professor adicional de teste");
    await admin
      .getByLabel("E-mail", { exact: true })
      .fill("professor-adicional@example.test");
    await admin.getByLabel("Senha temporária").fill(PASSWORD);
    await admin.getByRole("checkbox", { name: "Escola de teste A" }).check();
    await admin
      .getByRole("button", { name: "Salvar acesso", exact: true })
      .click();
    await expect(
      admin.getByRole("status").filter({ hasText: "Acesso salvo" }),
    ).toBeVisible();
    await expect(admin.locator(".admin-name")).toContainText("Master de teste");
    await ir(admin, "/administracao/auditoria");
    await expect(
      admin.getByRole("heading", { name: "Auditoria do sistema" }),
    ).toBeVisible();
    await expect(admin.locator("tbody tr").first()).toContainText(
      "Master de teste",
    );
    await ir(admin, "/administracao/recuperacao");
    await expect(
      admin.getByRole("heading", {
        name: "Recuperação e ambiente",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      admin.getByRole("button", { name: "Copiar comando de backup" }),
    ).toBeVisible();
    console.log("ETAPA: vistoria com CPF e criação de conta passaram");
    await publico.goto("about:blank");
    const professor = await pagina();
    await login(professor, "professor@example.test");
    await ir(professor, "/administracao/usuarios");
    await expect(professor).toHaveURL(/\/administracao$/);
    await ir(professor, "/administracao/notas");
    await professor
      .getByLabel("Aluno", { exact: true })
      .selectOption("aluno-a");
    await professor.getByRole("button", { name: "+ Registrar nota" }).click();
    await professor.getByLabel("Componente curricular").fill("Matemática");
    await professor.getByLabel("Nota (0 a 10)").fill("8.5");
    await professor.getByLabel("Frequência (%)").fill("95");
    await professor.getByRole("button", { name: "Salvar registro" }).click();
    await expect(
      professor.getByRole("status").filter({ hasText: "Registro salvo" }),
    ).toBeVisible();
    console.log("ETAPA: professor e nota passaram");
    await professor.goto("about:blank");
    const familiar = await pagina();
    await login(familiar, "familia@example.test", false);
    await familiar
      .getByLabel("Serviço", { exact: true })
      .selectOption("matricula");
    await familiar
      .getByLabel("Seu nome completo")
      .fill("Responsável familiar teste");
    await familiar.getByLabel("Escola", { exact: true }).selectOption("a");
    await familiar.getByLabel("Nome do aluno").fill("Aluno de teste A");
    await familiar.getByLabel("Etapa / série pretendida").fill("5º ano");
    await familiar
      .getByLabel("Assunto", { exact: true })
      .fill("Matrícula solicitada pelo portal");
    await familiar
      .getByLabel("Solicitação", { exact: true })
      .fill("Solicitação de teste sem dados reais.");
    await familiar.getByRole("checkbox", { name: /Confirmo os dados/ }).check();
    await familiar
      .getByRole("button", { name: "Enviar solicitação", exact: true })
      .click();
    await expect(
      familiar.getByRole("status").filter({ hasText: "Solicitação recebida" }),
    ).toBeVisible();
    await ir(admin, "/administracao/solicitacoes");
    await admin.getByRole("button", { name: "Atender solicitação" }).click();
    await admin
      .getByLabel("Situação", { exact: true })
      .last()
      .selectOption("respondida");
    await admin
      .getByLabel("Resposta visível ao solicitante")
      .fill("Resposta de teste enviada pela Secretaria.");
    await admin
      .getByRole("button", { name: "Salvar andamento e resposta" })
      .click();
    await expect(
      admin.getByRole("status").filter({ hasText: "Andamento salvo" }),
    ).toBeVisible();
    await expect(
      familiar.getByText("Resposta de teste enviada pela Secretaria.", {
        exact: true,
      }),
    ).toBeVisible();
    await ir(familiar, "/boletim");
    await expect(
      familiar.getByRole("cell", { name: "Matemática", exact: true }),
    ).toBeVisible();
    await expect(
      familiar.getByRole("cell", { name: "8,5", exact: true }),
    ).toBeVisible();
    await familiar.goto("about:blank");
    await admin.goto("about:blank");
  } else {
    await seed("escolasPublicas/a", {
      nome: "Escola de teste A",
      endereco: "Endereço público de teste",
      telefone: "",
      etapas: "Ensino fundamental",
      horario: "Manhã e tarde",
      descricao: "Ficha pública de teste",
    });
    await seed("escolasPublicas/a/vistorias/v1", {
      tipo: "sanitaria",
      status: "conforme",
      nota: 10,
      data: Timestamp.now(),
      responsavelNome: "Responsável de teste",
      publicadoEm: Timestamp.now(),
    });
    await seed("publicacoes/cardapio-teste", {
      tipo: "cardapio",
      titulo: "Cardápio mensal de teste",
      resumo: "",
      texto: "Segunda-feira: arroz, feijão e legumes.",
      escolaId: "a",
      numero: "2026-09",
      ordem: 0,
      dataInicio: "2026-09-01",
    });
  }
  for (const rota of [
    "/carta-de-servicos",
    "/servico/merenda",
    "/noticias",
    "/escolas",
    "/calendario",
    "/editais",
    "/matricula",
    "/transporte-escolar",
    "/biblioteca-digital",
    "/fale-conosco",
    "/institucional",
    "/transparencia",
    "/legislacao",
    "/planejamento",
    "/indicadores",
    "/acesso-a-informacao",
    "/sistemas",
    "/privacidade",
    "/mapa-do-site",
    "/acessibilidade",
  ]) {
    await ir(publico, rota);
    await expect(publico.locator("h1").first()).toBeVisible();
    assert.equal(
      await publico
        .getByRole("heading", { name: "Vamos encontrar o caminho?" })
        .count(),
      0,
    );
  }
  await publico.setViewportSize({ width: 390, height: 844 });
  await ir(publico, "/");
  await publico.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(
    publico.getByRole("navigation", { name: "Navegação principal" }),
  ).toBeVisible();
  await publico.keyboard.press("Escape");
  await publico.getByRole('button',{name:'Abrir menu de acessibilidade'}).click();
  for (let i = 0; i < 10; i++)
    await publico
      .getByRole("button", { name: "Aumentar tamanho da fonte", exact: true })
      .click();
  await expect
    .poll(() =>
      publico.evaluate(
        () => getComputedStyle(document.documentElement).fontSize,
      ),
    )
    .toBe("32px");
  console.log(
    "LAYOUT",
    await publico.evaluate(() => ({
      largura: innerWidth,
      conteudo: document.documentElement.scrollWidth,
      excessos: [...document.querySelectorAll("body *")]
        .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
        .slice(0, 8)
        .map((e) => [e.tagName, e.className]),
    })),
  );
  assert.ok(
    await publico.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "A página não pode transbordar em 200% no celular",
  );
  await publico.screenshot({
    path: path.join(OUT, "inicio-mobile-200.png"),
    fullPage: true,
  });
  await publico
    .getByRole("button", { name: "Restaurar tamanho da fonte" })
    .click();
  await publico
    .getByRole("button", { name: "Alto contraste", exact: true })
    .click();
  await expect(publico.locator("html")).toHaveClass(/high-contrast/);
  await publico.screenshot({
    path: path.join(OUT, "inicio-contraste.png"),
    fullPage: true,
  });
  await ir(publico, "/merenda-escolar?escola=a");
  assert.ok(
    await publico.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Merenda deve caber no celular",
  );
  await publico.screenshot({
    path: path.join(OUT, "merenda-mobile.png"),
    fullPage: true,
  });
  const acessibilidade=await new AxeBuilder({page:publico}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  fs.writeFileSync(path.join(OUT,'axe-merenda.json'),JSON.stringify(acessibilidade,null,2));
  assert.deepEqual(acessibilidade.violations,[], 'Sem violações automáticas axe na página pública de merenda; não substitui teste humano.');
  assert.deepEqual(erros, [], "Nenhum erro de execução do Vue no navegador");
  console.log(
    process.env.SEDUC_QA_VISUAL_ONLY
      ? "NAVEGADOR: rotas públicas, fonte 200%, menu, contraste e merenda no celular passaram."
      : "NAVEGADOR: portal, publicação, escolas, cardápio/PDF, vistoria pública, contas, permissões, atendimento, notas, família, rotas e acessibilidade passaram.",
  );
}
executar()
  .catch(async (e) => {
    console.error(e);
    if (browser) {
      for (const [c, i] of browser.contexts().map((c, i) => [c, i]))
        for (const p of c.pages()) {
          await p
            .screenshot({
              path: path.join(OUT, "falha-" + i + ".png"),
              fullPage: true,
            })
            .catch(() => {});
          console.error(
            "PÁGINA:",
            p.url(),
            (
              await p
                .locator("body")
                .innerText()
                .catch(() => "")
            ).slice(-4500),
          );
        }
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    await servidor?.close();
    await ambiente?.cleanup();
  });
