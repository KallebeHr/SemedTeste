const fs = require("node:fs"),
  path = require("node:path");
const raiz = path.resolve(__dirname, ".."),
  dest = path.join(raiz, "public/ocr");
fs.mkdirSync(path.join(dest, "core"), { recursive: true });
fs.mkdirSync(path.join(dest, "lang"), { recursive: true });
const core = path.dirname(require.resolve("tesseract.js-core/package.json"));
for (const n of fs.readdirSync(core))
  if (n.endsWith(".wasm") || n.endsWith(".wasm.js"))
    fs.copyFileSync(path.join(core, n), path.join(dest, "core", n));
fs.copyFileSync(
  path.join(
    path.dirname(require.resolve("tesseract.js/package.json")),
    "dist/worker.min.js",
  ),
  path.join(dest, "worker.min.js"),
);
fs.copyFileSync(
  path.join(
    path.dirname(require.resolve("@tesseract.js-data/por/package.json")),
    "4.0.0_best_int/por.traineddata.gz",
  ),
  path.join(dest, "lang/por.traineddata.gz"),
);
console.log("OCR em português preparado no próprio site.");
