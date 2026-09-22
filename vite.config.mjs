// Plugins
import Components from "unplugin-vue-components/vite";

import Vue from "@vitejs/plugin-vue";

import Vuetify, { transformAssetUrls } from "vite-plugin-vuetify";

// Utilities
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { carregarCliente } = require("./scripts/cliente.cjs");
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  if (command === "build" && !process.env.SEDUC_CLIENTE)
    throw new Error("Selecione o cliente: npm run build -- --cliente pedro-ii");
  const cliente = carregarCliente(process.env.SEDUC_CLIENTE || "pedro-ii");
  return {
    plugins: [
      Vue({
        template: { transformAssetUrls },
      }),
      // https://github.com/vuetifyjs/vuetify-loader/tree/master/packages/vite-plugin#readme
      Vuetify({
        autoImport: true,
        styles: {
          configFile: "src/styles/settings.scss",
        },
      }),
      Components(),
    ],
    define: { "process.env": {}, __SEDUC_CLIENTE__: JSON.stringify(cliente) },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
      extensions: [".js", ".json", ".jsx", ".mjs", ".ts", ".tsx", ".vue"],
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      port: 3000,
      proxy: { "/api/alimentacao": {target:"http://127.0.0.1:3001"} },
    },
  };
});
