import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const mocks = {
  "firebase/firestore": `export const doc=(db,...p)=>({path:p.join('/')});`,
  firebase: `export const db={};export const auth={currentUser:{getIdToken:async()=> 'teste'}};`,
  useColecao: `import {ref} from 'vue';const dados=ref([]);window.__controle=dados;export function useColecao(){return {dados,carregando:ref(false),erro:ref('')}}`,
  usePortal: `import {ref} from 'vue';const conteudos=ref([{id:'destaque',tipo:'edital',destaque:true,titulo:'Título longo da publicação '.repeat(20),resumo:'Resumo longo com informações da publicação. '.repeat(30),texto:'Texto completo preservado.'.repeat(1000)}]);window.__publicacoes=conteudos;export function usePortal(){return {configuracao:ref({}),conteudos}}`,
};
const server = await createServer({
  configFile: false,
  plugins: [
    vue(),
    {
      name: "qa-hero-controle",
      enforce: "pre",
      resolveId(id) {
        const name = id === "firebase/firestore" ? id : id.split("/").at(-1);
        if (mocks[name]) return "\0qa-" + name;
      },
      load(id) {
        if (id.startsWith("\0qa-")) return mocks[id.slice(4)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url.startsWith("/qa-hero-controle")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Teste hero e comunicado</title><style>body{margin:0}#controle{padding:16px}</style></head><body><div id="app"></div><script type="module">import {createApp,h} from 'vue';import {createRouter,createMemoryHistory} from 'vue-router';import '/src/styles/portal.css';import Hero from '/src/components/hero.vue';import Controle from '/src/components/admin/ControleAvisoPortal.vue';const router=createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});createApp({render:()=>h('div',[h(Hero),h('div',{id:'controle'},[h(Controle)])])}).use(router).mount('#app')</script></body></html>`,
            ),
          );
        });
      },
    },
  ],
  optimizeDeps: { noDiscovery: true, include: ["vue", "vue-router"] },
  server: { host: "127.0.0.1", port: 4205, strictPort: true },
  logLevel: "error",
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-gl=angle",
      "--use-angle=swiftshader",
    ],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const operacoes = [];
  await page.route("**/api/aviso-portal", async (route) => {
    const b = route.request().postDataJSON();
    operacoes.push(b);
    await page.evaluate(
      (b) =>
        (window.__controle.value = [
          { avisoAtualizacaoAtivo: b.ativo, versao: b.versao + 1 },
        ]),
      b,
    );
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ativo: b.ativo, versao: b.versao + 1 }),
    });
  });
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://127.0.0.1:4205/qa-hero-controle");
    await expect(page.locator(".hero-read")).toHaveText(/Ver mais/);
    assert((await page.locator(".hero-news h2").innerText()).length <= 100);
    assert((await page.locator(".hero-news p").innerText()).length <= 180);
    await expect(page.locator(".hero-news")).toHaveAttribute(
      "href",
      "/publicacao/destaque",
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await expect(
      page.getByLabel("Exibir comunicado de atualização"),
    ).not.toBeChecked();
    await page.getByLabel("Exibir comunicado de atualização").check();
    await page
      .getByRole("button", { name: "Salvar comunicado", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "Comunicado ativado no site.",
    );
    await page.getByLabel("Exibir comunicado de atualização").uncheck();
    await page
      .getByRole("button", { name: "Salvar comunicado", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "Comunicado desativado no site.",
    );
    await page.evaluate(() => (window.__publicacoes.value[0].resumo = ""));
    await expect(page.locator(".hero-news p")).toContainText(
      "Texto completo preservado",
    );
    assert((await page.locator(".hero-news p").innerText()).length <= 180);
  }
  assert.equal(operacoes.length, 6);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: hero limitado, fallback de texto, link completo, controle ativar/desativar em 320/390/1280px; serviços simulados.",
  );
} finally {
  await browser?.close();
  await server.close();
}
