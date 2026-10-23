import { auth } from "../firebase";
export async function editaisApi(body, admin = false, arquivo = false) {
  const headers = { "Content-Type": "application/json" };
  if (admin) {
    if (!auth.currentUser) throw Error("Entre como Master.");
    headers.Authorization = "Bearer " + (await auth.currentUser.getIdToken());
  }
  let r;
  try {
    r = await fetch("/api/editais", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(65000),
    });
  } catch {
    throw Error(
      "Sem confirmação do servidor. Mantenha esta tela aberta e tente novamente com os mesmos dados.",
    );
  }
  if (!r.ok)
    throw Error(
      (await r.json().catch(() => ({}))).erro || "Serviço indisponível.",
    );
  return arquivo ? r.blob() : r.json();
}
export async function lerEdital(id) {
  const r = await fetch("/api/editais?editalId=" + encodeURIComponent(id));
  if (!r.ok)
    throw Error(
      (await r.json().catch(() => ({}))).erro || "Edital indisponível.",
    );
  return r.json();
}
export function arquivoBase64(f) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(Error("Não foi possível ler o arquivo."));
    r.readAsDataURL(f);
  });
}
export function salvarBlob(blob, nome) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
