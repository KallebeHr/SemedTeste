import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import fs from "node:fs/promises";
const server = await createServer({
  configFile: false,
  plugins: [
    vue(),
    {
      name: "qa-calendario-mensal",
      enforce: "pre",
      resolveId(id) {
        if (id.endsWith("/composables/usePortal")) return "\0qa-portal";
        if (id.endsWith("/services/calendarios")) return "\0qa-servico";
      },
      load(id) {
        if (id === "\0qa-portal")
          return `import {ref} from 'vue';const conteudos=ref([]);export function usePortal(){return {conteudos,publicacoes:{dados:ref([]),carregando:ref(false),erro:ref(''),recarregar(){}}}}`;
        if (id === "\0qa-servico")
          return `import dados from '/src/data/calendario2026.json';export async function lerCalendario(){return {dados,versao:1}}export async function anosPublicados(){return [2026]}`;
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url.startsWith("/qa-mensal")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Calendário</title><style>body{margin:0}</style></head><body><div id="app"></div><script type="module">import {createApp} from 'vue';import {createRouter,createMemoryHistory} from 'vue-router';import '/src/styles/portal.css';import Calendario from '/src/views/portal/CalendarioEscolarView.vue';const router=createRouter({history:createMemoryHistory(),routes:[{path:'/',component:Calendario}]});createApp(Calendario).use(router).mount('#app');</script></body></html>`,
            ),
          );
        });
      },
    },
  ],
  optimizeDeps: { noDiscovery: true, include: ["vue", "vue-router"] },
  server: { host: "127.0.0.1", port: 4201, strictPort: true },
  logLevel: "error",
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE,
    headless: true,
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
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("http://127.0.0.1:4201/qa-mensal");
    await expect(page.locator(".calendar-grid")).toBeVisible();
    await expect(page.locator(".cal-ano")).toHaveCount(0);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    if (width === 390)
      await page.screenshot({
        path: "/tmp/semed-mensal-390.png",
        fullPage: true,
      });
  }
  await page.getByLabel("Ir para o mês").fill("2026-12");
  assert((await page.locator(".p-card-link").count()) <= 4);
  await page.getByRole("button", { name: "Ver calendário anual" }).click();
  await expect(page.locator(".cal-mes")).toHaveCount(12);
  await expect(page.locator("details.cal-evento").first()).not.toBeVisible();
  let downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar PDF", exact: true }).click();
  let download = await downloading;
  await download.saveAs("/tmp/calendario-anual-interface.pdf");
  assert.equal(
    (
      await PDFDocument.load(
        await fs.readFile("/tmp/calendario-anual-interface.pdf"),
      )
    ).getPageCount(),
    2,
  );
  await page.getByLabel("Período para baixar ou imprimir").selectOption("12");
  downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar PDF", exact: true }).click();
  download = await downloading;
  await download.saveAs("/tmp/calendario-mensal-interface.pdf");
  assert.equal(
    (
      await PDFDocument.load(
        await fs.readFile("/tmp/calendario-mensal-interface.pdf"),
      )
    ).getPageCount(),
    1,
  );
  await page
    .getByRole("button", { name: "Voltar ao calendário mensal" })
    .click();
  await expect(page.locator(".calendar-grid")).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "OK: mensal como padrão, agenda limitada, anual sob demanda, lista recolhida, PDF anual 2 páginas e PDF mensal 1 página; 3 larguras sem overflow.",
  );
} finally {
  await browser?.close();
  await server.close();
}
