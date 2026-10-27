import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const mocks = {
  firebase: `export const db={};`,
  useColecao: `import {ref} from 'vue';const dados=ref([{id:'legado-canto',nome:'E. M. Canto da Várzea',ativo:true,versao:2,alunos:0,funcionarios:null},{id:'legado-b',nome:'Escola B',ativo:false,arquivada:true,versao:1}]);window.__escolas=dados;export function useColecao(){return {dados,carregando:ref(false),erro:ref('')}}`,
  usePortal: `import {ref} from 'vue';export function usePortal(){return {escolas:{dados:ref([])}}}`,
  useAuth: `export function useAuth(){return {pode:()=>true}}`,
  escolasCadastro: `export const PUBLICAVEIS=['endereco','contato','email','latitude','longitude'];export async function salvarFichaEscola(form,pub,campos){window.__salvo=JSON.parse(JSON.stringify({form,pub,campos}));window.__escolas.value.push({...form,id:'nova-escola'});return 'nova-escola'}export async function alterarSituacaoEscola(e,acao){window.__situacao={id:e.id,acao};const item=window.__escolas.value.find(x=>x.id===e.id);item.ativo=acao==='reativar';item.arquivada=acao==='arquivar'}`,
  importacaoEscolas: `export async function importarEscolas(){throw Error('Teste de interface não grava dados.')}`,
};
const server = await createServer({
  configFile: false,
  plugins: [
    vue(),
    {
      name: "qa-escolas",
      enforce: "pre",
      resolveId(id) {
        const name = id.split("/").at(-1);
        if (mocks[name]) return "\0qa-" + name;
      },
      load(id) {
        if (id.startsWith("\0qa-")) return mocks[id.slice(4)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url.startsWith("/qa-escolas")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              `<!doctype html><html lang="pt-BR"><head><title>Escolas teste</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}main{padding:16px;max-width:1100px;margin:auto}</style></head><body><main id="app"></main><script type="module">import {createApp} from 'vue';import {createRouter,createMemoryHistory} from 'vue-router';import '/src/styles/portal.css';import Escolas from '/src/views/admin/EscolasAdmin.vue';const router=createRouter({history:createMemoryHistory(),routes:[{path:'/',component:Escolas}]});createApp(Escolas).use(router).mount('#app')</script></body></html>`,
            ),
          );
        });
      },
    },
  ],
  optimizeDeps: { noDiscovery: true, include: ["vue", "vue-router"] },
  server: { host: "127.0.0.1", port: 4203, strictPort: true },
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
  page.on("dialog", (d) => d.accept());
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("http://127.0.0.1:4203/qa-escolas");
    await expect(
      page.getByRole("heading", { name: "Escolas da rede", exact: true }),
    ).toBeVisible();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Pesquisar escola").fill("canto");
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByLabel("Pesquisar escola").fill("");
  await page.getByRole("button", { name: "+ Adicionar escola" }).click();
  await page
    .getByLabel("Nome da escola", { exact: true })
    .fill("Escola somente nome");
  await page
    .getByRole("button", { name: "Salvar escola", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Escola salva");
  const salvo = await page.evaluate(() => window.__salvo);
  assert.equal(salvo.form.nome, "Escola somente nome");
  assert.equal(salvo.form.alunos, "");
  assert.equal(salvo.pub, false);
  await page
    .getByRole("button", { name: "Remover / arquivar" })
    .first()
    .click();
  assert.deepEqual(await page.evaluate(() => window.__situacao), {
    id: "legado-canto",
    acao: "arquivar",
  });
  await page
    .locator("summary")
    .filter({ hasText: "Importar escolas por planilha" })
    .click();
  await page
    .getByRole("button", { name: "Conferir lista inicial das 43 escolas" })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(43);
  await expect(page.locator("tbody")).toContainText("Ignorar: já cadastrada");
  assert.deepEqual(errors, []);
  console.log(
    "OK: 3 larguras, pesquisa, nome como único obrigatório, privacidade inicial, arquivamento e prévia de 43 nomes com correspondência ao ID legado.",
  );
} finally {
  await browser?.close();
  await server.close();
}
