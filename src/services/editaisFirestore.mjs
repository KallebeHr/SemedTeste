import {
  doc,
  collection,
  collectionGroup,
  getDocFromServer,
  getDocs,
  query,
  where,
  orderBy,
  documentId,
  limit,
  startAfter,
  getCountFromServer,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { validarFicha, abertura, DECLARACAO } from "../../shared/editais.mjs";

export const colecaoFichas = (db, id) =>
  collection(db, "editaisRespostas", id, "inscricoesTexto");
export const refFicha = (db, id, uid) => doc(colecaoFichas(db, id), uid);
export const declaracaoFicha = (c) =>
  c.modelo === "anexo-ii-2026"
    ? DECLARACAO
    : "Declaro que as informações prestadas são verdadeiras e que li o regulamento e o aviso de privacidade.";
export const resumoConfig = (c) => ({
  modelo: c.modelo,
  nome: c.nome,
  camposExtras: c.camposExtras,
});
export function apresentar(snap) {
  const d = snap.data();
  return {
    ...d,
    id: snap.id,
    arquivos: [],
    criadoEm: d.criadoEm?.toMillis(),
    aceiteEm: d.aceiteEm?.toMillis(),
    confirmadoEm: d.confirmadoEm?.toMillis() || null,
  };
}
export async function protocoloFicha(editalId, uid) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(editalId + ":" + uid),
  );
  return (
    "SEMED-" +
    Array.from(new Uint8Array(hash), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("")
  );
}
export async function enviarFicha(db, uid, editalId, dados, versao) {
  const ref = refFicha(db, editalId, uid);
  const protocolo = await protocoloFicha(editalId, uid);
  await runTransaction(db, async (tx) => {
    const anterior = await tx.get(ref);
    if (anterior.exists()) {
      // Recupera a confirmação após falha de rede, inclusive depois do encerramento.
      const old = anterior.data();
      const recebido = validarFicha(dados, {
        ...old.config,
        categorias: [],
        obrigatorios: [],
      });
      if (Object.keys(recebido).some((k) => recebido[k] !== old.dados[k]))
        throw Error(
          "Esta sessão já enviou uma inscrição neste edital com outros dados. Guarde o comprovante.",
        );
      return;
    }
    const c = (await tx.get(doc(db, "editaisConfiguracao", editalId))).data();
    if (!c || c.versao !== versao)
      throw Error(
        "Configuração alterada. Reabra o formulário para conferir as novas orientações.",
      );
    const aviso = abertura(c);
    if (aviso) throw Error(aviso);
    const ficha = validarFicha(dados, { ...c, obrigatorios: [] });
    tx.set(ref, {
      uid,
      editalId,
      protocolo,
      dados: ficha,
      config: resumoConfig(c),
      versaoConfig: c.versao,
      declaracao: declaracaoFicha(c),
      status: "recebida",
      criadoEm: serverTimestamp(),
      aceiteEm: serverTimestamp(),
    });
  });
  // Nunca apresenta sucesso com uma gravação apenas local ou pendente.
  return apresentar(await getDocFromServer(ref));
}
export async function lerFormulario(db, id) {
  const p = await getDocFromServer(doc(db, "publicacoes", id));
  if (!p.exists() || p.data().tipo !== "edital")
    throw Error("Edital não disponível.");
  const s = await getDocFromServer(doc(db, "editaisConfiguracao", id));
  if (!s.exists()) throw Error("Inscrições não disponíveis.");
  const c = { ...s.data(), obrigatorios: [], temPdf: !!s.data().pdf };
  return { config: c, agora: Date.now(), aviso: abertura(c) };
}
async function quantidade(q) {
  return (await getCountFromServer(q)).data().count;
}
export async function catalogoFormularios(db, cursor) {
  const base = collection(db, "editaisConfiguracao");
  const all = collectionGroup(db, "inscricoesTexto");
  const [lista, editais, recebidas, confirmadas] = await Promise.all([
    getDocs(
      query(
        base,
        orderBy(documentId()),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(51),
      ),
    ),
    quantidade(base),
    quantidade(all),
    quantidade(query(all, where("status", "==", "confirmada"))),
  ]);
  return {
    editais: lista.docs
      .slice(0, 50)
      .map((s) => ({ id: s.id, nome: s.data().nome })),
    cursor: lista.size > 50 ? lista.docs[49].id : null,
    totais: { editais, recebidas, confirmadas },
  };
}
export async function listarFichas(
  db,
  id,
  { busca = "", campoBusca = "dados.responsavel", status, cursor } = {},
) {
  const base = colecaoFichas(db, id);
  const filtros = [];
  if (status) filtros.push(where("status", "==", status));
  if (busca) {
    if (
      ![
        "dados.responsavel",
        "dados.escola",
        "dados.titulo",
        "protocolo",
      ].includes(campoBusca)
    )
      throw Error("Campo de busca inválido.");
    if (campoBusca === "protocolo")
      filtros.push(where("protocolo", "==", busca));
    else
      filtros.push(
        where(campoBusca, ">=", busca),
        where(campoBusca, "<=", busca + "\uf8ff"),
        orderBy(campoBusca),
      );
  }
  filtros.push(orderBy(documentId()));
  if (cursor) filtros.push(startAfter(...cursor));
  const [lista, recebidas, confirmadas] = await Promise.all([
    getDocs(query(base, ...filtros, limit(26))),
    quantidade(base),
    quantidade(query(base, where("status", "==", "confirmada"))),
  ]);
  return {
    linhas: lista.docs.slice(0, 25).map(apresentar),
    cursor:
      lista.size > 25
        ? busca && campoBusca !== "protocolo"
          ? [lista.docs[24].get(campoBusca), lista.docs[24].id]
          : [lista.docs[24].id]
        : null,
    totais: { recebidas, confirmadas },
  };
}
