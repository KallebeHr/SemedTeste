import { alimentacaoApi } from "./alimentacaoApi";
export async function prepararFoto(file) {
  if (
    !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
      file.type,
    )
  )
    throw new Error("Use JPEG, PNG, WEBP ou PDF.");
  if (!file.size || file.size > 20 * 1024 * 1024)
    throw new Error("Selecione um arquivo de até 20 MB.");
  let blob = file,
    nome = file.name;
  if (file.type.startsWith("image/")) {
    const bitmap = await createImageBitmap(file);
    try {
      const escala = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * escala));
      canvas.height = Math.max(1, Math.round(bitmap.height * escala));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.82),
      );
      nome = "foto.jpg";
    } finally {
      bitmap.close();
    }
  }
  if (!blob || blob.size > 2 * 1024 * 1024)
    throw new Error(
      "O arquivo precisa ter até 2 MB após a preparação. Reduza o PDF ou a imagem.",
    );
  const base64 = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  return {
    id: crypto.randomUUID(),
    blob,
    nome,
    mime: blob.type,
    base64,
    estado: "Pronto para enviar",
    enviado: false,
  };
}
export async function enviarFotos(escolaId, fotos) {
  for (const f of fotos) {
    if (f.enviado) continue;
    f.estado = "Enviando…";
    try {
      await alimentacaoApi({
        acao: "enviar",
        escolaId,
        id: f.id,
        nome: f.nome,
        mime: f.mime,
        base64: f.base64,
        titulo: "Comprovante de movimentação",
        texto: "",
        revisado: true,
      });
      f.enviado = true;
      f.estado = "Upload concluído";
    } catch (e) {
      f.estado = "Erro no envio — tente novamente";
      throw e;
    }
  }
  return fotos.map((f) => f.id);
}
