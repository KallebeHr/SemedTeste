import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const mocks = {
  "firebase/firestore": `export const collection=(db,...p)=>({path:p.join('/')});export const query=r=>r;export const where=()=>null;`,
  firebase: `export const db={};`,
  useColecao: `import {ref} from 'vue';const dados=ref([]),publicas=ref([]);window.__vida={dados,publicas};export function useColecao(){return {dados,carregando:ref(false),erro:ref('')}}`,
  usePortal: `import {computed,ref} from 'vue';export function usePortal(){return {conteudos:computed(()=>window.__vida.publicas.value),publicacoes:{dados:window.__vida.publicas,carregando:ref(false),erro:ref('')}}}`,
  useSaidaSegura: `export function useSaidaSegura(){}`,
  editorial: `export async function salvarConteudo(form,publicar){const d={...form,versao:(form.versao||0)+1,publicado:publicar||form.publicado||false};const s=window.__vida;s.dados.value=[...s.dados.value.filter(x=>x.id!==d.id),d];if(publicar)s.publicas.value=[...s.publicas.value.filter(x=>x.id!==d.id),d];window.__salvo={form:{...form},publicar};return d.id}export async function retirarPublicacao(t){window.__vida.publicas.value=window.__vida.publicas.value.filter(x=>x.id!==t.id);window.__vida.dados.value.find(x=>x.id===t.id).publicado=false;}`,
  "FotoPublicacao.vue": `import {h} from 'vue';export default {props:['modelValue','conteudoId','tipo','alt','disabled'],emits:['update:modelValue','pendente','ocupado'],setup(p,{emit}){return ()=>h('button',{type:'button',onClick:()=>{window.__fotoDestino={id:p.conteudoId,tipo:p.tipo};emit('update:modelValue','https://example.com/topico.jpg');emit('pendente',false)}},'Simular envio de imagem')}}`,
};
const server = await createServer({
  configFile: false,
  plugins: [
    vue(),
    {
      name: "qa-vida",
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
          if (!req.url.startsWith("/qa-vida")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              `<!doctype html><html lang="pt-BR"><head><title>Vida Escolar teste</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#app{padding:16px;max-width:1150px;margin:auto}</style></head><body><div id="app"></div><script type="module">import {createApp,h} from 'vue';import {createRouter,createMemoryHistory,RouterView} from 'vue-router';import '/src/styles/portal.css';import Admin from '/src/views/admin/VidaEscolarAdmin.vue';import Publica from '/src/views/portal/VidaEscolarView.vue';const router=createRouter({history:createMemoryHistory(),routes:[{path:'/',component:Admin},{path:'/vida-escolar',component:Publica}]});window.__router=router;createApp({render:()=>h(RouterView)}).use(router).mount('#app')</script></body></html>`,
            ),
          );
        });
      },
    },
  ],
  optimizeDeps: { noDiscovery: true, include: ["vue", "vue-router"] },
  server: { host: "127.0.0.1", port: 4206, strictPort: true },
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
  page.on("dialog", (d) => d.accept());
  await page.route("https://example.com/topico.jpg", (r) =>
    r.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#007a72"/></svg>',
    }),
  );
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://127.0.0.1:4206/qa-vida");
    await expect(
      page.getByRole("heading", { name: "Vida Escolar", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "+ Adicionar tópico" }).click();
    await page.getByLabel("Título do tópico").fill("Matrícula online");
    await page
      .getByLabel("Link ao clicar na imagem")
      .fill("https://example.com/matricula");
    await page
      .getByLabel("Descrição da imagem para acessibilidade")
      .fill("Acesso à matrícula online");
    await page.getByRole("button", { name: "Simular envio de imagem" }).click();
    await page
      .getByLabel(
        "Conferi a imagem, o link de destino e as informações para publicação.",
      )
      .check();
    if (width === 390) {
      await page
        .getByLabel("Link ao clicar na imagem")
        .fill("javascript:alert(1)");
      await page
        .getByLabel(
          "Conferi a imagem, o link de destino e as informações para publicação.",
        )
        .check();
      await page
        .getByRole("button", { name: "Publicar tópico", exact: true })
        .click();
      await expect(page.getByRole("alert")).toContainText("Confira o link");
      await page
        .getByLabel("Link ao clicar na imagem")
        .fill("https://example.com/matricula");
      await page
        .getByLabel(
          "Conferi a imagem, o link de destino e as informações para publicação.",
        )
        .check();
    }
    await page
      .getByRole("button", { name: "Publicar tópico", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Tópico publicado");
    const dados = await page.evaluate(() => ({
      salvo: window.__salvo,
      foto: window.__fotoDestino,
    }));
    assert.equal(dados.salvo.form.id, dados.foto.id);
    assert.equal(dados.foto.tipo, "servico");
    assert.equal(dados.salvo.form.categoria, "vida-escolar");
    await page.evaluate(() => window.__router.push("/vida-escolar"));
    await expect(page.locator(".vida-card")).toHaveCount(1);
    await expect(page.locator(".vida-card")).toHaveAttribute(
      "href",
      "https://example.com/matricula",
    );
    await expect(page.locator(".vida-card")).toHaveAttribute(
      "target",
      "_blank",
    );
    await expect(page.locator(".vida-card img")).toHaveAttribute(
      "alt",
      "Acesso à matrícula online",
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await expect(
      page.getByRole("link", { name: "Consultar boletim e notas" }),
    ).toHaveAttribute("href", "/vida-escolar/boletim");
    await page.evaluate(() => window.__router.push("/"));
    await page.getByRole("button", { name: "Editar tópico" }).click();
    await page.getByLabel("Link ao clicar na imagem").fill("/calendario");
    await page
      .getByRole("button", { name: "Salvar rascunho", exact: true })
      .click();
    await page.evaluate(() => window.__router.push("/vida-escolar"));
    await expect(page.locator(".vida-card")).toHaveAttribute(
      "href",
      "https://example.com/matricula",
    );
    await page.evaluate(() => window.__router.push("/"));
    await page.getByRole("button", { name: "Editar tópico" }).click();
    await page
      .getByLabel(
        "Conferi a imagem, o link de destino e as informações para publicação.",
      )
      .check();
    await page
      .getByRole("button", { name: "Publicar tópico", exact: true })
      .click();
    await page.evaluate(() => window.__router.push("/vida-escolar"));
    await expect(page.locator(".vida-card")).toHaveAttribute(
      "href",
      "/calendario",
    );
    await expect(page.locator(".vida-card")).not.toHaveAttribute(
      "target",
      "_blank",
    );
    await page.evaluate(() => window.__router.push("/"));
    await page.getByRole("button", { name: "Retirar do site" }).click();
    await page.evaluate(() => window.__router.push("/vida-escolar"));
    await expect(page.locator(".vida-card")).toHaveCount(0);
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: publicar imagem/link, editar rascunho, republicar, retirar, preservar boletim; 320/390/1280px sem overflow. Serviços simulados.",
  );
} finally {
  await browser?.close();
  await server.close();
}
