import { transacaoConfirmada } from "./transacao";
import { doc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
export const TIPOS_ATENDIMENTO = {
  matricula: "Matrícula",
  transporte: "Transporte escolar",
  ouvidoria: "Manifestação / atendimento",
  informacao: "Acesso à informação",
};
export const STATUS_ATENDIMENTO = {
  recebida: "Recebida",
  em_analise: "Em análise",
  deferida: "Deferida",
  indeferida: "Indeferida",
  respondida: "Respondida",
};
export async function enviarSolicitacao(d, id) {
  const u = auth.currentUser;
  if (!u || !u.emailVerified)
    throw new Error("Entre na sua conta e confirme seu e-mail para continuar.");
  if (
    !TIPOS_ATENDIMENTO[d.tipo] ||
    !d.nome.trim() ||
    !d.assunto.trim() ||
    !d.mensagem.trim()
  )
    throw new Error("Preencha os campos obrigatórios.");
  if (
    ["matricula", "transporte"].includes(d.tipo) &&
    (!d.escolaId || !d.alunoNome.trim() || !d.serie.trim())
  )
    throw new Error("Informe a escola, o aluno e a etapa/série.");
  const r = doc(db, "solicitacoes", id),
    limite = doc(db, "limitesAtendimento", u.uid);
  await transacaoConfirmada(async (t) => {
    const existente = await t.get(r);
    if (existente.exists()) return;
    const ultimo = await t.get(limite);
    if (
      ultimo.exists() &&
      Date.now() - (ultimo.data().ultimoEnvio?.toMillis?.() || 0) < 60000
    )
      throw new Error("Aguarde um minuto entre envios de solicitações.");
    const p = {
      tipo: d.tipo,
      nome: d.nome.trim(),
      email: u.email,
      assunto: d.assunto.trim(),
      mensagem: d.mensagem.trim(),
      escolaId: d.escolaId || "",
      alunoNome: d.alunoNome.trim(),
      serie: d.serie.trim(),
      donoUid: u.uid,
      status: "recebida",
      resposta: "",
      versao: 1,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    };
    t.set(r, p);
    t.set(limite, { ultimoEnvio: serverTimestamp(), ultimoProtocolo: id });
  });
  return id;
}
