const { PDFDocument, PDFName } = require("pdf-lib");
const sharp = require("sharp");
async function validarArquivo(b, maxMB = 2, soPdf = false) {
  if (
    typeof b.base64 !== "string" ||
    b.base64.length > 2800000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(b.base64)
  )
    throw Error("Arquivo inválido ou maior que 2 MB.");
  let bytes = Buffer.from(b.base64, "base64");
  if (!bytes.length || bytes.length > maxMB * 1024 * 1024)
    throw Error("Arquivo excede o limite configurado.");
  let mime = b.mime;
  if (mime === "application/pdf") {
    if (bytes.subarray(0, 5).toString() !== "%PDF-")
      throw Error("PDF inválido.");
    const pdf = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      throwOnInvalidObject: true,
    });
    if (!pdf.getPageCount() || pdf.getPageCount() > 200)
      throw Error("PDF deve ter entre 1 e 200 páginas.");
    // Mantém os bytes e eventuais assinaturas; rejeita conteúdo ativo, não reescreve o PDF.
    const forbidden = new Set([
      "JavaScript",
      "JS",
      "Launch",
      "EmbeddedFiles",
      "RichMedia",
      "XFA",
      "OpenAction",
      "AA",
    ]);
    for (const [, obj] of pdf.context.enumerateIndirectObjects())
      if (typeof obj.keys === "function")
        for (const k of obj.keys())
          if (k instanceof PDFName && forbidden.has(k.decodeText()))
            throw Error(
              "Envie um PDF sem scripts, anexos embutidos ou ações automáticas.",
            );
  } else {
    if (soPdf || !["image/jpeg", "image/png", "image/webp"].includes(mime))
      throw Error("Envie PDF, JPEG, PNG ou WEBP.");
    const img = sharp(bytes, { limitInputPixels: 24000000, animated: false }),
      meta = await img.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format) || meta.pages > 1)
      throw Error("Imagem inválida.");
    bytes = await img
      .rotate()
      .resize({
        width: 1800,
        height: 1800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    mime = "image/jpeg";
  }
  if (bytes.length > maxMB * 1024 * 1024)
    throw Error("Imagem processada excede o limite configurado.");
  return {
    bytes,
    mime,
    nome:
      String(b.nome || "documento")
        .replace(/\.(pdf|jpe?g|png|webp)$/i, "")
        .replace(/[^\p{L}\p{N} ._-]/gu, "")
        .slice(0, 100) + (mime === "application/pdf" ? ".pdf" : ".jpg"),
  };
}
module.exports = { validarArquivo };
