import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const pdfPath =
  "../upload/CARDÁPIO-ED.INFANTIL-CRECHE VOVÓ INÁCIA,MARIA DE LOURDES VIANA-OUTUBRO-1(1).pdf";
const pdf = readFileSync(pdfPath);
const mocks = {
  "FotoPublicacao.vue": `export default {props:["modelValue","conteudoId","tipo","alt","disabled"],render(){return null}}`,
  "firebase/firestore": `export const collection=(db,...p)=>({path:p.join('/')});export const query=r=>r;export const where=()=>null;`,
  firebase: `export const db={};`,
  useColecao: `import {ref} from 'vue';export const state={escolas:ref([{id:'real-vovo',nome:'E. M. Vovó Inácia'},{id:'real-maria',nome:'E. de E. Infantil Maria de Lurdes Viana dos Santos'},{id:'terceira',nome:'Escola terceira'}]),conteudos:ref([]),publicacoes:ref([])};state.escolasPublicas=state.escolas;window.__dados=state;export function useColecao(fn){const p=fn()?.path;return {dados:state[p]||ref([]),carregando:ref(false),erro:ref('')}}`,
  usePortal: `import {computed,ref} from 'vue';export function usePortal(){const s=window.__dados;return {escolas:{dados:s.escolasPublicas,carregando:ref(false),erro:ref('')},conteudos:computed(()=>s.publicacoes.value),publicacoes:{dados:s.publicacoes,carregando:ref(false),erro:ref('')}}}`,
  useSaidaSegura: `export function useSaidaSegura(){}`,
  editaisApi: `export const arquivoBase64=f=>new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(f)});`,
  cardapiosApi: `export async function cardapiosApi(b,blob){window.__chamadas??=[];window.__chamadas.push(b);if(b.acao==='upload')return {arquivoId:'pdf-unico',nome:b.nome};if(b.acao==='salvar'){const d={...b.form,tipo:'cardapio',versao:1,publicado:b.publicar};window.__dados.conteudos.value=[d];if(b.publicar)window.__dados.publicacoes.value=[d];return {id:b.id,versao:1}}if(blob)return new Blob(['%PDF-1.7'],{type:'application/pdf'});return {linhas:[]}}`,
};
const server = await createServer({
  configFile: false,
  plugins: [
    vue(),
    {
      name: "qa-cardapios",
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
          if (!req.url.startsWith("/qa-cardapios")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              `<!doctype html><html lang="pt-BR"><head><title>QA Cardápios</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#app{padding:16px;max-width:1150px;margin:auto;box-sizing:border-box}</style></head><body><div id="app"></div><script type="module">import {createApp,h} from 'vue';import {createRouter,createMemoryHistory,RouterView} from 'vue-router';import '/src/styles/portal.css';import Admin from '/src/views/admin/CardapiosAdmin.vue';import Publica from '/src/views/portal/MerendaPublica.vue';const router=createRouter({history:createMemoryHistory(),routes:[{path:'/',component:Admin},{path:'/merenda-escolar',component:Publica}]});window.__router=router;createApp({render:()=>h(RouterView)}).use(router).mount('#app');</script></body></html>`,
            ),
          );
        });
      },
    },
  ],
  optimizeDeps: { noDiscovery: true, include: ["vue", "vue-router"] },
  server: { host: "127.0.0.1", port: 4204, strictPort: true },
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
  const erros = [];
  page.on("pageerror", (e) => {
    erros.push(e.message);
    console.error("PAGEERROR", e.message);
  });
  page.on("console", (m) => {
    if (m.type() === "error") console.error(m.text());
  });
  page.on("dialog", (d) => d.accept());
  await page.route("**/api/cardapios?**", (route) =>
    route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="cardapio-2026-10.pdf"',
      },
      body: pdf,
    }),
  );
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://127.0.0.1:4204/qa-cardapios");
    await expect(
      page.getByRole("heading", { name: "Gerenciar cardápios", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "+ Novo cardápio" }).click();
    await page.getByRole("button", { name: /Preparar exemplo/ }).click();
    await expect(page.getByLabel("Título", { exact: true })).toHaveValue(
      "Educação Infantil — Outubro 2026",
    );
    assert.equal(
      await page.locator('input[type="checkbox"]:checked').count(),
      2,
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow admin ${width}`,
    );
    await page
      .getByLabel("Enviar ou substituir PDF original (até 2 MB)")
      .setInputFiles(pdfPath);
    await page
      .getByLabel(
        "Conferi o período, as escolas selecionadas e o conteúdo oficial.",
      )
      .check();
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Cardápio publicado");
    const chamadas = await page.evaluate(() => window.__chamadas);
    assert.equal(chamadas.filter((c) => c.acao === "upload").length, 1);
    const upload = chamadas.find((c) => c.acao === "upload");
    assert.equal(
      createHash("sha256")
        .update(Buffer.from(upload.base64, "base64"))
        .digest("hex"),
      createHash("sha256").update(pdf).digest("hex"),
    );
    const salvo = chamadas.find((c) => c.acao === "salvar");
    assert.deepEqual(salvo.form.escolaIds, ["real-vovo", "real-maria"]);
    assert.equal(salvo.form.gradeCardapio, undefined);
    await page.evaluate(() =>
      window.__router.push("/merenda-escolar?escola=real-vovo&mes=2026-10"),
    );
    await expect(
      page.getByRole("heading", { name: "Cardápio mensal" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Educação Infantil — Outubro 2026" }),
    ).toBeVisible();
    await page.getByLabel("Escola", { exact: true }).selectOption("real-maria");
    await expect(
      page.getByRole("heading", { name: "Educação Infantil — Outubro 2026" }),
    ).toBeVisible();
    if (width === 390) {
      await page.getByText("Visualizar PDF oficial", { exact: true }).click();
      await expect(
        page.locator('iframe[title="Cardápio oficial em PDF"]'),
      ).toBeVisible();
      await page.screenshot({
        path: "/tmp/cardapios-publico-390.png",
        fullPage: true,
      });
    }
    const dl = page.waitForEvent("download");
    await page
      .getByRole("link", { name: "Baixar Cardápio em PDF", exact: true })
      .click();
    assert.equal((await dl).suggestedFilename(), "cardapio-2026-10.pdf");
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow público ${width}`,
    );
    await page.getByLabel("Escola", { exact: true }).selectOption("terceira");
    await expect(
      page.getByText(
        "Não há cardápio publicado para esta escola no período selecionado.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Baixar Cardápio em PDF", exact: true }),
    ).toHaveCount(0);
    await page.getByLabel("Escola", { exact: true }).selectOption("real-vovo");
    await page.getByLabel("Mês do cardápio").fill("2026-11");
    await expect(
      page.getByText(
        "Não há cardápio publicado para esta escola no período selecionado.",
        { exact: true },
      ),
    ).toBeVisible();
  }
  assert.deepEqual(erros, []);
  console.log(
    "PASS: 320, 390 e 1280px; PDF real, duas escolas por ID, um upload, download, terceira escola e mês sem vínculo. Serviços simulados.",
  );
} finally {
  await browser?.close();
  await server.close();
}
