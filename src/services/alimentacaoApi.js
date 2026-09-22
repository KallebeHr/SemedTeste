import { auth } from "../firebase";
export async function alimentacaoApi(body, arquivo = false) {
  if (!auth.currentUser) throw new Error("Entre novamente para continuar.");
  const token = await auth.currentUser.getIdToken();
  let r;
  try {
    r = await fetch("/api/alimentacao/documentos", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });
  } catch {
    throw new Error(
      "O servidor não confirmou a operação. Confira a lista antes de tentar novamente.",
    );
  }
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(
      d.erro || "Serviço indisponível. Confira a configuração do servidor.",
    );
  }
  return arquivo ? r.blob() : r.json();
}
export async function baixarDocumento(escolaId, d) {
  const blob = await alimentacaoApi(
      { acao: "baixar", escolaId, id: d.id },
      true,
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = d.nome || "documento";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
