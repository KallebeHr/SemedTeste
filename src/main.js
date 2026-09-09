import { createApp } from "vue";
import { registerPlugins } from "@/plugins";
import App from "./App.vue";
import { inicializarProtecoes } from "./portal/inicializacao";
async function iniciar() {
  await inicializarProtecoes();
  const app = createApp(App);
  registerPlugins(app);
  app.mount("#app");
}
iniciar().catch(() => {
  const raiz = document.getElementById("app");
  raiz.textContent =
    "Não foi possível iniciar o portal. Confira a conexão e recarregue a página.";
});
