import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const server = await createServer({
  configFile: false,
  plugins: [
    vue(),
    {
      name: "qa",
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url.startsWith("/qa-calendario")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>QA calendário</title><style>body{margin:0}#app{padding:16px;max-width:1200px;margin:auto}</style></head><body><div id="app"></div><script type="module">import {createApp,h} from 'vue';import '/src/styles/portal.css';import Grade from '/src/components/calendario/GradeCalendario.vue';import calendario from '/src/data/calendario2026.json';createApp({render:()=>h(Grade,{calendario})}).mount('#app')</script></body></html>`,
            ),
          );
        });
      },
    },
  ],
  optimizeDeps: { noDiscovery: true, include: ["vue"] },
  server: { host: "127.0.0.1", port: 4200, strictPort: true },
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
    await page.goto("http://127.0.0.1:4200/qa-calendario");
    await expect(page.locator(".cal-mes")).toHaveCount(12);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await expect(page.locator(".cal-grade button")).toHaveCount(365);
    if (width === 390)
      await page.screenshot({ path: "/tmp/semed-calendario-390.png" });
  }
  await page.getByRole("button", { name: /2026-01-01:/ }).click();
  await expect(
    page.getByRole("heading", { name: "Férias escolares", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Feriado em 1º de janeiro" }),
  ).toBeVisible();
  await page.getByLabel("Pesquisar eventos").fill("carnaval");
  await expect(page.locator("details.cal-evento")).toHaveCount(1);
  await page.getByLabel("Mês", { exact: true }).selectOption("2");
  await expect(page.locator(".cal-mes")).toHaveCount(1);
  assert.deepEqual(errors, []);
  console.log(
    "OK: 12 meses/365 dias, 3 larguras, duas ocorrências no mesmo dia, pesquisa e filtro por mês.",
  );
} finally {
  await browser?.close();
  await server.close();
}
