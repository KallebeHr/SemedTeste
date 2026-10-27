// Testa rotas e interação reais em navegador, usando somente publicações simuladas.
import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../..", import.meta.url));
const html = `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Teste do aviso</title><style>body{margin:0;font:16px Arial}main{padding:16px}</style></head><body><div id="app"></div><script type="module">import {createApp,h} from 'vue';import {createRouter,createMemoryHistory} from 'vue-router';import '/src/styles/portal.css';import Aviso from '/src/components/portal/AvisoPortalAtualizacao.vue';const paths=['/','/noticias','/escolas','/editais','/inscricao/:id','/publicacao/:id','/login','/administracao'];const router=createRouter({history:createMemoryHistory(),routes:paths.map(path=>({path,component:{render:()=>null},meta:path==='/login'?{login:true}:path==='/administracao'?{requerAuth:true}:{}}))});window.__router=router;const app=createApp({render(){return h('div',[h('main',{id:'conteudo-principal',tabindex:-1},[h('h1','Portal de teste'),h('p','Conteúdo da seção')]),h(Aviso)])}});app.use(router);router.push(new URLSearchParams(location.search).get('destino')||'/');app.mount('#app')</script></body></html>`;
const server = await createServer({
  root,
  configFile: false,
  plugins: [
    vue(),
    {
      name: "portal-simulado",
      enforce: "pre",
      resolveId(id) {
        if (id === "../../composables/usePortal") return "\0qa-portal";
      },
      load(id) {
        if (id === "\0qa-portal")
          return `import {ref} from 'vue';const conteudos=ref([]),dados=ref([]);window.__conteudos=conteudos;window.__configAviso=dados;export function usePortal(){return {conteudos,publicacoes:{dados}}}`;
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url.startsWith("/qa-aviso")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(await s.transformIndexHtml(req.url, html));
        });
      },
    },
  ],
  optimizeDeps: { noDiscovery: true, include: ["vue", "vue-router"] },
  server: { host: "127.0.0.1", port: 4199, strictPort: true },
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
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const modal = page.getByRole("dialog", {
    name: "Nosso portal está em atualização",
  });
  const navegar = async (path) => {
    await page.evaluate((p) => window.__router.push(p), path);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
  };
  await page.goto("http://127.0.0.1:4199/qa-aviso");
  await page.waitForFunction(() => window.__configAviso);
  await expect(modal).not.toBeVisible();
  await page.evaluate(
    () =>
      (window.__configAviso.value = [
        { id: "config-aviso-portal", avisoAtualizacaoAtivo: true },
      ]),
  );
  await expect(modal).toBeVisible();
  await page.evaluate(
    () => (window.__configAviso.value[0].avisoAtualizacaoAtivo = false),
  );
  await expect(modal).not.toBeVisible();
  await page.evaluate(
    () => (window.__configAviso.value[0].avisoAtualizacaoAtivo = true),
  );
  await expect(modal).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fechar aviso de atualização do portal" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();
  await expect(page.locator("#conteudo-principal")).toBeFocused();
  await navegar("/?filtro=teste#conteudo");
  await expect(modal).not.toBeVisible();
  await navegar("/noticias");
  await expect(modal).toBeVisible();
  await page.getByRole("button", { name: "Entendi, continuar" }).tap();
  await expect(modal).not.toBeVisible();
  await navegar("/escolas");
  await expect(modal).toBeVisible();
  await page
    .getByRole("button", { name: "Fechar aviso de atualização do portal" })
    .tap();
  await expect(modal).not.toBeVisible();
  for (const path of [
    "/editais",
    "/inscricao/e1",
    "/login",
    "/administracao",
  ]) {
    await navegar(path);
    await expect(modal).not.toBeVisible();
  }
  await navegar("/publicacao/e1");
  await expect(modal).not.toBeVisible();
  await page.evaluate(
    () =>
      (window.__conteudos.value = [
        { id: "e1", tipo: "edital" },
        { id: "n1", tipo: "noticia" },
      ]),
  );
  await expect(modal).not.toBeVisible();
  await navegar("/publicacao/n1");
  await expect(modal).toBeVisible();
  await page.getByRole("button", { name: "Entendi, continuar" }).tap();
  await page.evaluate(
    () => (window.__conteudos.value = [...window.__conteudos.value]),
  );
  await expect(modal).not.toBeVisible();
  await navegar("/publicacao/futuro");
  await expect(modal).not.toBeVisible();
  await navegar("/editais");
  await page.evaluate(() =>
    window.__conteudos.value.push({ id: "futuro", tipo: "noticia" }),
  );
  await expect(modal).not.toBeVisible();
  await navegar("/");
  await expect(modal).toBeVisible();
  await page.getByRole("link", { name: "Consultar editais" }).tap();
  await expect(modal).not.toBeVisible();
  assert.equal(
    await page.evaluate(() => window.__router.currentRoute.value.path),
    "/editais",
  );
  for (const width of [320, 390, 1024]) {
    await page.setViewportSize({ width, height: 740 });
    await navegar("/noticias");
    await expect(modal).toBeVisible();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Sem overflow em ${width}`,
    );
    const box = await modal.boundingBox();
    assert(box.x >= 0 && box.x + box.width <= width);
    if (width === 390)
      await page.screenshot({ path: "/tmp/semed-aviso-portal-390.png" });
    await page.getByRole("button", { name: "Entendi, continuar" }).click();
    await navegar("/editais");
  }
  await page.goto("http://127.0.0.1:4199/qa-aviso?destino=/publicacao/e1");
  await page.waitForFunction(
    () => window.__router?.isReady && window.__conteudos,
  );
  await page.evaluate(() => window.__router.isReady());
  await page.evaluate(
    () =>
      (window.__configAviso.value = [
        { id: "config-aviso-portal", avisoAtualizacaoAtivo: true },
      ]),
  );
  await expect(modal).not.toBeVisible();
  await page.evaluate(
    () => (window.__conteudos.value = [{ id: "e1", tipo: "edital" }]),
  );
  await expect(modal).not.toBeVisible();
  await navegar("/publicacao/nova");
  await expect(modal).not.toBeVisible();
  await page.evaluate(() =>
    window.__conteudos.value.push({ id: "nova", tipo: "noticia" }),
  );
  await expect(modal).toBeVisible();
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  assert(
    await modal.evaluate((el) => el.scrollWidth <= el.clientWidth),
    "Fonte ampliada sem overflow horizontal",
  );
  assert.deepEqual(errors, []);
  console.log(
    "OK: abertura, X, Escape, foco, navegação/filtros, acesso direto ao edital, conteúdo assíncrono, inscrição/admin excluídos, link Editais, 3 larguras e fonte 200%.",
  );
} finally {
  await browser?.close();
  await server.close();
}
