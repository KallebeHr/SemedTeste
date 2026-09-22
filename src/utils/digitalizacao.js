export async function prepararImagem(file, rotacao = 0, cortar = false) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(
      "Use JPEG, PNG ou WebP. Se o celular gerar HEIC, selecione o modo Mais compatível.",
    );
  if (file.size > 15 * 1024 * 1024)
    throw new Error("Escolha uma foto de até 15 MB.");
  const imagem = await createImageBitmap(file);
  try {
    if (imagem.width * imagem.height > 24000000)
      throw new Error("Use uma foto de até 24 megapixels.");
    const margem = cortar ? 0.04 : 0,
      w = imagem.width * (1 - 2 * margem),
      h = imagem.height * (1 - 2 * margem),
      escala = Math.min(1, 2400 / Math.max(w, h));
    const canvas = document.createElement("canvas"),
      troca = rotacao % 180 !== 0;
    canvas.width = Math.round((troca ? h : w) * escala);
    canvas.height = Math.round((troca ? w : h) * escala);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotacao * Math.PI) / 180);
    ctx.drawImage(
      imagem,
      imagem.width * margem,
      imagem.height * margem,
      w,
      h,
      (-w * escala) / 2,
      (-h * escala) / 2,
      w * escala,
      h * escala,
    );
    const avisos = [];
    if (Math.min(canvas.width, canvas.height) < 900)
      avisos.push("Resolução baixa: aproxime o documento ou tire outra foto.");
    const mini = document.createElement("canvas");
    mini.width = 200;
    mini.height = Math.max(1, Math.round((200 * canvas.height) / canvas.width));
    const m = mini.getContext("2d");
    m.drawImage(canvas, 0, 0, mini.width, mini.height);
    const px = m.getImageData(0, 0, mini.width, mini.height).data;
    let soma = 0;
    for (let i = 0; i < px.length; i += 4)
      soma += (px[i] + px[i + 1] + px[i + 2]) / 3;
    if (soma / (px.length / 4) < 70)
      avisos.push("Imagem escura: procure iluminação uniforme, sem sombras.");
    let blob;
    for (const q of [0.9, 0.8, 0.65, 0.5]) {
      blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", q));
      if (blob?.size <= 2 * 1024 * 1024) break;
    }
    if (!blob || blob.size > 2 * 1024 * 1024)
      throw new Error(
        "A imagem ainda está grande. Tire uma foto mais próxima e tente novamente.",
      );
    return {
      file: new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
        type: "image/jpeg",
      }),
      avisos,
    };
  } finally {
    imagem.close();
  }
}
export function base64Arquivo(file) {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1]);
    r.onerror = () => erro(new Error("Não foi possível ler o arquivo."));
    r.readAsDataURL(file);
  });
}
export function criarLeitor() {
  let worker,
    cancelado = false;
  return {
    async ler(file, progresso) {
      cancelado = false;
      const { createWorker } = await import("tesseract.js");
      if (cancelado) throw new Error("Leitura cancelada.");
      worker = await createWorker("por", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/core",
        langPath: "/ocr/lang",
        workerBlobURL: false,
        cacheMethod: "none",
        logger: (m) => progresso(Math.round((m.progress || 0) * 100)),
      });
      if (cancelado) {
        await worker.terminate();
        worker = null;
        throw new Error("Leitura cancelada.");
      }
      try {
        const { data } = await worker.recognize(file);
        return { texto: data.text.slice(0, 30000), confianca: data.confidence };
      } finally {
        await worker?.terminate();
        worker = null;
      }
    },
    async cancelar() {
      cancelado = true;
      await worker?.terminate();
      worker = null;
    },
  };
}
