<template>
  <section>
    <header class="p-page-head">
      <h1>Publicar vistorias</h1>
      <p>
        O portal exibirá somente data, tipo, resultado e nome do responsável.
        CPFs, assinaturas e observações internas não são publicados.
      </p>
    </header>
    <EstadoConsulta :consulta="escolas" /><label class="p-field"
      >Escola<select aria-label="Escola" v-model="escolaId">
        <option value="">Selecione uma escola</option>
        <option v-for="e in escolas.dados.value" :key="e.id" :value="e.id">
          {{ e.nome }}
        </option>
      </select></label
    >
    <p v-if="escolaId && !escolaPublicada" class="p-alert">
      A ficha da escola precisa ser publicada em Escolas antes de publicar suas
      vistorias.
    </p>
    <EstadoConsulta :consulta="vistorias" />
    <p v-if="erro" role="alert" class="p-alert error">{{ erro }}</p>
    <p v-if="mensagem" role="status" class="p-alert success">{{ mensagem }}</p>
    <div class="p-stack">
      <article v-for="v in vistorias.dados.value" :key="v.id" class="p-card">
        <span class="p-badge">{{
          publicadas.has(v.id) ? "Publicada" : "Restrita à administração"
        }}</span>
        <h2>{{ dataTexto(v.data) }} · {{ v.tipo }}</h2>
        <p>Resultado: {{ v.status?.replaceAll("_", " ") }}</p>
        <p>Responsável: {{ v.responsavelNome }}</p>
        <div class="p-actions">
          <button
            class="p-button primary"
            :disabled="ocupado || !escolaPublicada"
            @click="publicar(v)"
          >
            Publicar resumo</button
          ><button
            v-if="publicadas.has(v.id)"
            class="p-button danger"
            :disabled="ocupado"
            @click="retirar(v)"
          >
            Retirar publicação
          </button>
        </div>
      </article>
      <p
        v-if="
          escolaId &&
          !vistorias.dados.value.length &&
          !vistorias.carregando.value
        "
        class="p-empty"
      >
        Nenhuma vistoria cadastrada para esta escola.
      </p>
    </div>
  </section>
</template>
<script setup>
import { transacaoConfirmada } from "../../portal/transacao";
import { ref, computed } from "vue";
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useColecao } from "../../composables/useColecao";
import { usePortal } from "../../composables/usePortal";
import { useAuth } from "../../composables/useAuth";
import {
  resumoVistoria,
  dataTexto,
  mensagemErro,
} from "../../portal/validacao";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const escolas = useColecao(() =>
    query(collection(db, "escolas"), where("ativo", "==", true)),
  ),
  portal = usePortal(),
  escolaId = ref(""),
  ocupado = ref(false),
  erro = ref(""),
  mensagem = ref(""),
  escolaPublicada = computed(() =>
    portal.escolas.dados.value.some((e) => e.id === escolaId.value),
  ),
  vistorias = useColecao(
    () =>
      escolaId.value
        ? query(
            collection(db, "escolas", escolaId.value, "vistorias"),
            orderBy("data", "desc"),
            limit(100),
          )
        : null,
    escolaId,
  ),
  publicas = useColecao(
    () =>
      escolaId.value && escolaPublicada.value
        ? collection(db, "escolasPublicas", escolaId.value, "vistorias")
        : null,
    () => [escolaId.value, escolaPublicada.value],
  ),
  publicadas = computed(() => new Set(publicas.dados.value.map((v) => v.id)));
async function operacao(v, publicar) {
  ocupado.value = true;
  erro.value = "";
  mensagem.value = "";
  try {
    useAuth().exigirUsuario();
    await transacaoConfirmada(async (t) => {
      const r = doc(db, "escolasPublicas", escolaId.value, "vistorias", v.id);
      if (publicar) {
        const s = await t.get(
          doc(db, "escolas", escolaId.value, "vistorias", v.id),
        );
        if (!s.exists()) throw new Error("A vistoria não está disponível.");
        const registro = s.data();
        if (
          !registro.assinaturaResponsavelId ||
          registro.metodoConfirmacao !== "identificacao_cpf"
        )
          throw new Error(
            "Este registro antigo precisa ter sua identificação conferida antes de ser publicado.",
          );
        const identidade = await t.get(
          doc(
            db,
            "escolas",
            escolaId.value,
            "assinaturas",
            registro.assinaturaResponsavelId,
          ),
        );
        if (
          !identidade.exists() ||
          identidade.data().nomeSignatario !== registro.responsavelNome
        )
          throw new Error(
            "O nome da vistoria diverge da identificação. Solicite a revisão do registro ao Master.",
          );
        t.set(r, {
          ...resumoVistoria({ ...s.data(), id: s.id }, escolaId.value),
          publicadoEm: serverTimestamp(),
        });
      } else t.delete(r);
    });
    mensagem.value = publicar
      ? "Resumo publicado na Merenda pública."
      : "Publicação retirada.";
  } catch (e) {
    erro.value = mensagemErro(e);
  } finally {
    ocupado.value = false;
  }
}
function publicar(v) {
  operacao(v, true);
}
function retirar(v) {
  operacao(v, false);
}
</script>
