import { auth } from "../firebase";
export async function cardapiosApi(body, arquivo = false) {
  if (!auth.currentUser) throw Error("Entre para gerenciar cardápios.");
  let r;
  try {
    r = await fetch("/api/cardapios", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (await auth.currentUser.getIdToken()),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(65000),
    });
  } catch {
    throw Error(
      "O servidor não confirmou a operação. Confira a lista antes de repetir.",
    );
  }
  if (r.ok && arquivo) return r.blob();
  const dados = await r.json();
  if (!r.ok) {
    const e = Error(dados.erro || "Serviço indisponível.");
    e.conflitos = dados.conflitos;
    throw e;
  }
  return dados;
}
