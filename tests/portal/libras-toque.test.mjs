// Navegador isolado: testa o componente e a ponte reais, sem enviar textos ao serviço externo.
// CHROMIUM_EXECUTABLE=/caminho/chromium node tests/portal/libras-toque.test.mjs
import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../..", import.meta.url));
const config = JSON.parse(
  await fs.readFile(new URL("../../vercel.json", import.meta.url), "utf8"),
);
const cabecalhos = config.headers.find(
  (h) => h.source === "/libras/(.*)",
).headers;
const html = `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Teste de toque VLibras</title><style>body{margin:0;font:16px Arial}main{padding:12px}p,a,button{margin:8px 0}#link,#botao{display:block;min-height:44px}#direto{padding:12px 0}.espaco{height:900px}</style></head><body><div id="app"></div><script type="module">import {createApp,h} from 'vue';import Libras from '/src/components/portal/LibrasPublica.vue';window.__acoes=0;createApp({render(){return h('main',{id:'conteudo-principal'},[h(Libras),h('p',{id:'texto'},'Educação para todos.'),h('a',{id:'link',href:'#destino',onClick:()=>window.__acoes++},[h('svg',{'aria-hidden':'true',id:'icone',width:20,height:20},[h('path',{d:'M0 0h20v20H0z'})]),h('span','Escolas públicas')]),h('button',{id:'botao',onClick:()=>window.__acoes++},'Consultar calendário'),h('div',{id:'direto'},'Texto direto de um cartão'),h('p',{'data-privado':'',id:'privado'},'Informação privada'),h('form',[h('p',{id:'formulario'},'Dado de formulário')]),h('div',{class:'espaco'}),h('p',{id:'destino'},'Rodapé de teste')])}}).mount('#app');</script></body></html>`;
const server = await createServer({
  root,
  configFile: false,
  plugins: [
    vue(),
    {
      name: "qa-libras",
      enforce: "pre",
      resolveId(id) {
        if (id === "vue-router") return "\0qa-router";
      },
      load(id) {
        if (id === "\0qa-router")
          return `import {reactive} from 'vue';const route=reactive({path:'/',fullPath:'/',meta:{},matched:[]});window.__rota=route;export function useRoute(){return route}`;
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (req.url.startsWith("/libras/"))
            for (const { key, value } of cabecalhos) res.setHeader(key, value);
          if (!req.url.startsWith("/qa-libras")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(await s.transformIndexHtml(req.url, html));
        });
      },
    },
  ],
  optimizeDeps: { noDiscovery: true, include: ["vue"] },
  server: { host: "127.0.0.1", port: 4198, strictPort: true },
  logLevel: "error",
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await context.route("https://vlibras.gov.br/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `const root=document.createElement('div');root.id='vlibras-app-root';root.dataset.active='true';root.style.cssText='position:fixed;inset:0;background:#eee';root.innerHTML='<p>Intérprete simulado</p><p id="traduzido"></p><p id="quantidade">0</p>';document.body.append(root);let n=0;window.VLibrasWidget={initBtn:{},open(){root.dataset.active='true'}};window.vlibras={isLoaded:true,stop(){},async translateAndPlay(t){document.getElementById('traduzido').textContent=t;document.getElementById('quantidade').textContent=String(++n);await new Promise(r=>setTimeout(r,50))}};`,
    }),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4198/qa-libras");
  await page.getByRole("button", { name: "Ativar Libras" }).tap();
  await expect(
    page.getByRole("button", { name: "Voltar à navegação" }),
  ).toBeVisible();
  const frame = page.frameLocator("iframe");
  await page.locator("#texto").tap();
  await expect(frame.locator("#traduzido")).toHaveText("Educação para todos.");
  await expect(frame.locator("#quantidade")).toHaveText("1");
  await page.locator("#icone").tap();
  await expect(frame.locator("#traduzido")).toHaveText("Escolas públicas");
  await expect(frame.locator("#quantidade")).toHaveText("2");
  assert.equal(
    await page.evaluate(() => window.__acoes),
    0,
    "Selecionar link não navega nem aciona handlers",
  );
  await page.locator("#botao").tap();
  await expect(frame.locator("#traduzido")).toHaveText("Consultar calendário");
  await expect(frame.locator("#quantidade")).toHaveText("3");
  assert.equal(
    await page.evaluate(() => window.__acoes),
    0,
    "Selecionar botão não executa ação",
  );
  await page.locator("#direto").tap();
  await expect(frame.locator("#traduzido")).toHaveText(
    "Texto direto de um cartão",
  );
  await expect(frame.locator("#quantidade")).toHaveText("4");
  await page
    .locator("#texto")
    .dispatchEvent("pointerdown", {
      pointerId: 20,
      pointerType: "touch",
      isPrimary: true,
      clientX: 30,
      clientY: 80,
    });
  await page
    .locator("#texto")
    .dispatchEvent("pointerup", {
      pointerId: 20,
      pointerType: "touch",
      isPrimary: true,
      clientX: 30,
      clientY: 180,
    });
  await page.locator("#texto").click();
  await expect(frame.locator("#quantidade")).toHaveText("4");
  await page.locator("#privado").dispatchEvent("click", { button: 0 });
  await page.locator("#formulario").dispatchEvent("click", { button: 0 });
  await expect(frame.locator("#quantidade")).toHaveText("4");
  await page.getByRole("button", { name: "Voltar à navegação" }).tap();
  await page.locator("#link").tap();
  assert.equal(
    await page.evaluate(() => window.__acoes),
    1,
    "Navegação normal ao sair da seleção",
  );
  assert.equal(new URL(page.url()).hash, "#destino");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Sem overflow em ${width}`,
    );
    const box = await page.locator("iframe").boundingBox();
    assert(
      box.x >= 0 && box.x + box.width <= width,
      `Intérprete cabe em ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/semed-libras-mobile-390.png" });
  await page.evaluate(() => {
    window.__rota.meta = { requerAuth: true };
    window.__rota.path = "/administracao";
    window.__rota.fullPath = "/administracao";
  });
  await expect(page.locator("iframe")).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log(
    "OK: toque único, ícone/link/botão, texto de cartão, deduplicação, arrasto, privacidade, navegação, 3 larguras e remoção em rota privada.",
  );
} finally {
  await browser?.close();
  await server.close();
}
