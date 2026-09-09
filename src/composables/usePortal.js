import { computed, inject, provide } from "vue";
import { collection, doc } from "firebase/firestore";
import { db } from "../firebase";
import { useColecao } from "./useColecao";
import { SERVICOS } from "../portal/catalogo";
const CHAVE = Symbol("portal-publico");
export function fornecerPortal() {
  const publicacoes = useColecao(() => collection(db, "publicacoes"));
  const escolas = useColecao(() => collection(db, "escolasPublicas"));
  const config = useColecao(() => doc(db, "portalPublico", "configuracao"));
  const configuracao = computed(() => config.dados.value[0] || {});
  const conteudos = computed(() =>
    [...publicacoes.dados.value].sort(
      (a, b) =>
        a.ordem - b.ordem ||
        String(b.dataInicio).localeCompare(String(a.dataInicio)),
    ),
  );
  const servicos = computed(() => {
    const publicados = conteudos.value.filter((c) => c.tipo === "servico");
    const fixos = SERVICOS.map((s) => {
      const c = publicados.find((c) => c.slug === s.id);
      return c
        ? {
            ...s,
            titulo: c.titulo,
            resumo: c.resumo || s.resumo,
            texto: c.texto,
            url: c.url,
          }
        : s;
    });
    const adicionais = publicados
      .filter((c) => !SERVICOS.some((s) => s.id === c.slug))
      .map((c) => ({
        id: c.slug,
        titulo: c.titulo,
        resumo: c.resumo,
        texto: c.texto,
        url: c.url,
        caminho: "/servico/" + c.slug,
        icone: "clipboard-text-outline",
        grupo: "Comunidade",
      }));
    return [...fixos, ...adicionais];
  });
  const valor = {
    publicacoes,
    escolas,
    config,
    configuracao,
    conteudos,
    servicos,
  };
  provide(CHAVE, valor);
  return valor;
}
export function usePortal() {
  return inject(CHAVE);
}
