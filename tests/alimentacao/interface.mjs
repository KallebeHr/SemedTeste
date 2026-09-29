// QA isolado. Dados e serviços simulados somente neste teste, nunca no build.
import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import sharp from "sharp";
const entrega = {
  id: "12345678-1234-4234-8234-123456789012",
  codigo: "AE-2026-000001",
  escolaId: "escola-a",
  escolaNome: "Escola Municipal de Teste",
  status: "enviado",
  criadoEm: "2026-09-28T12:00:00Z",
  enviadoPorNome: "Gestor Municipal",
  responsavelEnvio: "Responsavel Teste",
  itens: [
    {
      itemId: "arroz",
      nome: "Arroz",
      quantidade: 20,
      unidade: "kg",
      lote: "",
      validade: null,
    },
  ],
  fotosEnvio: [],
  fotosRecebimento: [],
  observacao: "Entrega de teste",
};
const mock = {
  useAuth: `import {ref} from 'vue';export function useAuth(){return {usuario:ref({nome:'Gestor Municipal',papel:'gerente'})}}`,
  useEstoque: `import {ref} from 'vue';export function useEstoque(){return {itens:ref([{id:'arroz',nome:'Arroz',unidade:'kg',quantidadeAtual:100,ativo:true}]),carregando:ref(false),erro:ref(''),escutarEstoque(){},parar(){}}}`,
  useSaidaSegura: `export function useSaidaSegura(){};export function confirmarAlteracoes(){return true}`,
  alimentacaoApi: `export async function alimentacaoApi(b){window.__chamadas ||= [];window.__chamadas.push(b);if(b.acao==='listarEntregas')return {registros:[${JSON.stringify(entrega)}],cursor:null};if(b.acao==='resumoEntregas')return {hoje:1,pendentes:1,divergencias:0};if(window.__falhar && b.acao==='enviarEntrega'){window.__falhar=false;throw new Error('Conexão interrompida; tente novamente.')}return {id:b.id,codigo:'AE-2026-000002'}}`,
};
const server = await createServer({
  configFile: false,
  plugins: [
    vue(),
    {
      name: "qa-isolado",
      enforce: "pre",
      resolveId(id) {
        const name = id.split("/").at(-1).replace(/\.js$/, "");
        if (mock[name]) return "\0qa-" + name;
      },
      load(id) {
        if (id.startsWith("\0qa-")) return mock[id.slice(4)];
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url.startsWith("/qa-entregas")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await server.transformIndexHtml(
              req.url,
              `<html lang="pt-BR"><head><title>Teste de entregas</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font:16px Arial;background:#f4f6f3}main{max-width:1100px;margin:auto;padding:16px}</style></head><body><main id="app"></main><script type="module">import {createApp} from 'vue';import Painel from '/src/components/alimentacao/EntregasPainel.vue';createApp(Painel,{escolaId:'deposito-municipal',gestao:true,escolas:[{id:'escola-a',nome:'Escola Municipal de Teste',ativo:true}],modo:new URLSearchParams(location.search).get('modo')||'historico'}).mount('#app')</script></body></html>`,
            ),
          );
        });
      },
    },
  ],
  optimizeDeps: { noDiscovery: true, include: ["vue"] },
  server: { host: "127.0.0.1", port: 4179 },
  logLevel: "error",
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("BROWSER", e.message);
  });
  page.on("console", (m) => {
    if (m.type() === "error") console.error("CONSOLE", m.text());
  });
  await fs.mkdir("tests/resultado-entregas", { recursive: true });
  for (const width of [320, 375, 390, 414, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://127.0.0.1:4179/qa-entregas");
    await page
      .getByText("AE-2026-000001 · Escola Municipal de Teste")
      .waitFor({ timeout: 10000 })
      .catch(async (e) => {
        console.log(await page.locator("body").innerText());
        console.log("CALLS", await page.evaluate(() => window.__chamadas));
        throw e;
      });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `histórico sem transbordamento em ${width}`,
    );
    if (width === 390)
      await page.screenshot({
        path: "tests/resultado-entregas/historico-390.png",
        fullPage: true,
      });
    await page
      .getByRole("button", { name: "+ Alimentação enviada", exact: true })
      .click();
    await page.getByLabel("Escola de destino").selectOption("escola-a");
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `formulário sem transbordamento em ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByLabel(/^Produto/).selectOption("arroz");
  await page.getByLabel("Quantidade", { exact: true }).fill("20");
  await page.getByLabel("CPF do responsável").fill("52998224725");
  const jpg = await sharp({
    create: { width: 1600, height: 1200, channels: 3, background: "#668977" },
  })
    .jpeg()
    .toBuffer();
  await page.getByLabel("Adicionar fotos ou PDF").setInputFiles([
    { name: "foto.jpg", mimeType: "image/jpeg", buffer: jpg },
    { name: "foto2.jpg", mimeType: "image/jpeg", buffer: jpg },
  ]);
  await page.getByText("Pronto para enviar").first().waitFor();
  await page.screenshot({
    path: "tests/resultado-entregas/envio-390.png",
    fullPage: true,
  });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    axe.violations.map((v) => v.id),
    [],
  );
  await page
    .getByRole("button", { name: "Revisar envio", exact: true })
    .click();
  await page.evaluate(() => (window.__falhar = true));
  await page
    .getByRole("button", { name: "Confirmar envio", exact: true })
    .click();
  await page.getByText("Conexão interrompida; tente novamente.").waitFor();
  await page
    .getByRole("button", { name: "Tentar confirmar a mesma operação" })
    .click();
  await page
    .getByText("Operação confirmada. Estoque e histórico atualizados.")
    .waitFor();
  const calls = await page.evaluate(() => window.__chamadas),
    envios = calls.filter((c) => c.acao === "enviarEntrega");
  assert.equal(envios.length, 2);
  assert.equal(envios[0].id, envios[1].id);
  assert.deepEqual(envios[0], envios[1]);
  assert.equal(calls.filter((c) => c.acao === "enviar").length, 2);
  await page
    .getByRole("button", { name: "Confirmar recebimento", exact: true })
    .click();
  await page.getByLabel("Quantidade aceita no estoque").fill("18");
  await page
    .getByLabel("Motivo da divergência")
    .selectOption("quantidade diferente");
  await page.getByLabel("CPF do responsável").fill("52998224725");
  await page.getByRole("button", { name: "Revisar recebimento" }).click();
  await page.getByRole("button", { name: "Confirmar que recebi" }).click();
  await page
    .getByText("Operação confirmada. Estoque e histórico atualizados.")
    .waitFor();
  assert.equal(
    (await page.evaluate(() => window.__chamadas)).find(
      (c) => c.acao === "receberEntrega",
    ).itens[0].quantidadeRecebida,
    18,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASSOU: 7 larguras, 2 fotos, retry com mesmo ID, recebimento parcial e axe sem violações na tela de envio. Serviços simulados somente no teste.",
  );
} finally {
  await browser?.close();
  await server.close();
}
