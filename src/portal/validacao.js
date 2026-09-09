import { TIPOS_CONTEUDO } from "./catalogo";
export function texto(valor, max = 20000) {
  return String(valor ?? "")
    // eslint-disable-next-line no-control-regex -- Controles sem função textual são removidos intencionalmente.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}
export function normalizarBusca(valor) {
  return texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}
export function urlSegura(valor, permitirInterna = true) {
  const s = texto(valor, 2000);
  if (!s) return "";
  if (/[\\\s]/.test(s) || /%(?:00|0a|0d|5c)/i.test(s)) return '';
  if (permitirInterna && /^\/(?!\/)/.test(s) && !/[\\\s]/.test(s)) return s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : "";
  } catch {
    return "";
  }
}
export function dataValida(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return false;
  const d = new Date(s + "T12:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export function dataHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function dataTexto(v) {
  const d = v?.toDate
    ? v.toDate()
    : new Date(typeof v === "string" && v.length === 10 ? v + "T12:00:00" : v);
  return !v || !Number.isFinite(d.getTime())
    ? "Data não informada"
    : d.toLocaleDateString("pt-BR");
}
export const CAMPOS_PUBLICOS = [
  "tipo",
  "titulo",
  "resumo",
  "texto",
  "categoria",
  "slug",
  "url",
  "imagemUrl",
  "imagemAlt",
  "dataInicio",
  "dataFim",
  "local",
  "numero",
  "destaque",
  "ordem",
  "escolaId",
];
export function conteudoPublico(d) {
  const p = Object.fromEntries(
    CAMPOS_PUBLICOS.map((k) => [
      k,
      k === "destaque"
        ? d[k] === true
        : k === "ordem"
          ? Number(d[k]) || 0
          : texto(
              d[k],
              k === "texto"
                ? 30000
                : k.includes("Url") || k === "url"
                  ? 2000
                  : k === "resumo"
                    ? 800
                    : 200,
            ),
    ]),
  );
  if (!TIPOS_CONTEUDO[p.tipo] || p.titulo.length < 3)
    throw new Error("Informe o tipo e um título com pelo menos 3 caracteres.");
  for (const campo of ["url", "imagemUrl"]) {
    if (p[campo] && !urlSegura(p[campo], campo === "url"))
      throw new Error("Use um endereço HTTPS válido para os links e imagens.");
    p[campo] = urlSegura(p[campo], campo === "url");
  }
  if (p.imagemUrl && !p.imagemAlt)
    throw new Error("Descreva a imagem para quem usa leitor de tela.");
  if (
    (p.dataInicio && !dataValida(p.dataInicio)) ||
    (p.dataFim && !dataValida(p.dataFim))
  )
    throw new Error("Confira as datas da publicação.");
  if (p.dataFim && p.dataInicio && p.dataFim < p.dataInicio)
    throw new Error("A data final deve ser igual ou posterior à inicial.");
  if (p.tipo === "evento" && !p.dataInicio)
    throw new Error("Informe a data do evento.");
  if (
    p.tipo === "cardapio" &&
    (!p.escolaId || !/^\d{4}-\d{2}$/.test(p.numero) || !p.texto)
  )
    throw new Error(
      "Selecione a escola, informe o mês (AAAA-MM) e preencha o cardápio.",
    );
  if (p.tipo === "servico" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug))
    throw new Error(
      "Informe um identificador para o serviço, usando letras minúsculas, números e hífens.",
    );
  if (p.tipo === "pagina" && !p.slug)
    throw new Error("Selecione a página de destino.");
  return p;
}
export function resumoVistoria(v, escolaId) {
  if (!v.id || !v.data || !v.status || !v.responsavelNome)
    throw new Error(
      "Esta vistoria não tem todos os dados necessários para publicação.",
    );
  return {
    escolaId,
    tipo: v.tipo,
    status: v.status,
    nota: v.notaGeral ?? null,
    data: v.data,
    responsavelNome: v.responsavelNome,
  };
}
export function mensagemErro(e) {
  const c = String(e?.code || "").replace(/^firestore\//, "");
  return (
    {
      "permission-denied":
        "Seu perfil não tem permissão para esta operação. Confira os vínculos ou contate a administração.",
      unauthenticated: "Sua sessão expirou. Entre novamente.",
      unavailable:
        "Sem conexão com o serviço. Seus dados não foram confirmados; tente novamente.",
      "failed-precondition":
        "O banco precisa de um índice ou configuração. Consulte o guia de ativação.",
      "resource-exhausted":
        "O serviço atingiu uma cota de uso. Tente mais tarde.",
      "auth/email-already-in-use":
        "Este e-mail já tem uma conta. Entre ou redefina a senha.",
      "auth/weak-password": "Escolha uma senha com pelo menos 12 caracteres.",
      "auth/invalid-credential": "E-mail ou senha incorretos.",
      "auth/too-many-requests":
        "Aguarde alguns minutos antes de tentar novamente.",
    }[c] ||
    (e?.code
      ? "Não foi possível concluir. Tente novamente."
      : e?.message || "Não foi possível concluir.")
  );
}
