import {
  doc,
  getDocFromServer,
  getDocs,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { runTransactionAuditada } from "../portal/auditoria";
import { validarCalendario } from "../../shared/calendario.mjs";
export async function anosPublicados() {
  return (await getDocs(collection(db, "calendariosPublicos"))).docs
    .map((s) => Number(s.id))
    .sort((a, b) => b - a);
}
export async function lerCalendario(ano, rascunho = false) {
  const s = await getDocFromServer(
    doc(
      db,
      rascunho ? "calendariosEscolares" : "calendariosPublicos",
      String(ano),
    ),
  );
  return s.exists()
    ? {
        dados: validarCalendario(JSON.parse(s.data().dadosJson)),
        versao: s.data().versao,
      }
    : null;
}
export async function salvarCalendario(dados, versao) {
  const c = validarCalendario(dados);
  await runTransactionAuditada(db, async (tx) => {
    const r = doc(db, "calendariosEscolares", String(c.ano)),
      s = await tx.get(r);
    if ((s.data()?.versao || 0) !== versao)
      throw Error(
        "Outro administrador alterou este ano. Reabra antes de salvar.",
      );
    tx.set(r, {
      ano: c.ano,
      dadosJson: JSON.stringify(c),
      versao: versao + 1,
      atualizadoEm: serverTimestamp(),
    });
  });
  return versao + 1;
}
export async function publicarCalendario(ano, versao) {
  await runTransactionAuditada(db, async (tx) => {
    const r = doc(db, "calendariosEscolares", String(ano)),
      s = await tx.get(r);
    if (!s.exists() || s.data().versao !== versao)
      throw Error("Salve e confira a versão atual antes de publicar.");
    validarCalendario(JSON.parse(s.data().dadosJson));
    tx.set(doc(db, "calendariosPublicos", String(ano)), {
      ...s.data(),
      publicadoEm: serverTimestamp(),
    });
  });
}
