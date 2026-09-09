<template>
  <section>
    <header class="p-page-head">
      <h1>Recuperação e ambiente</h1>
      <p>
        Backup completo do banco, contas de acesso e arquivos de configuração,
        protegido por senha.
      </p>
    </header>
    <div class="p-card">
      <h2>{{ cliente.nome }} · {{ cliente.municipio }}</h2>
      <p>
        Cliente: <strong>{{ cliente.id }}</strong
        ><br />Projeto Firebase:
        <strong>{{ cliente.firebase.projectId }}</strong>
      </p>
      <p>
        Um projeto atende uma instituição. Confirme estes identificadores antes
        de qualquer recuperação.
      </p>
    </div>
    <div class="p-card p-section">
      <h2>Backup completo</h2>
      <EstadoConsulta :consulta="agenda" />
      <p v-if="agenda.dados.value[0]" role="status">Rotina agendada: {{agenda.dados.value[0].estado}}. Última conclusão: {{dataTexto(agenda.dados.value[0].ultimaConclusao)}}.</p>
      <p v-else class="p-alert">Nenhuma execução agendada registrada. Isso não significa que já exista um backup automático ativo.</p>
      <p>
        Execute no computador do administrador, dentro da pasta do projeto, com
        acesso autorizado ao Firebase. A senha é solicitada no terminal sem
        aparecer na tela.
      </p>
      <p>
        Os parâmetros de senha do Firebase devem ficar em um arquivo protegido
        fora do projeto. Consulte
        <strong>OPERACAO-E-RECUPERACAO.md</strong> antes da primeira execução.
      </p>
      <pre>{{ backup }}</pre>
      <button class="p-button" @click="copiar(backup)">
        Copiar comando de backup
      </button>
      <p>
        Durante a coleta, os lançamentos ficam em manutenção. O arquivo inclui
        todas as coleções e subcoleções, inclusive alunos, notas, novos
        cardápios e histórico.
      </p>
    </div>
    <div class="p-card p-section">
      <h2>Conferir uma restauração</h2>
      <p>
        A primeira execução apenas verifica o arquivo e o destino. A restauração
        completa exige um projeto vazio; não mistura dados de instituições nem
        apaga uma base existente.
      </p>
      <pre>{{ restauracao }}</pre>
      <button class="p-button" @click="copiar(restauracao)">
        Copiar comando de conferência
      </button>
      <p>
        Após a restauração, a manutenção permanece ativa até conferir regras,
        índices, domínio e acesso. Arquivos externos e imagens legadas devem ser
        preservados na origem.
      </p>
    </div>
    <p class="p-alert">
      A exportação JSON da área de alimentação continua disponível à nutrição.
      Ela é uma exportação parcial, não substitui esta rotina de recuperação
      completa.
    </p>
    <details class="p-card"><summary>Ativar agendamento em máquina administrativa</summary><p>Use uma máquina protegida, ligada no horário planejado. Configure as credenciais e a senha fora do projeto; siga REVISAO-TECNICA.md. O comando abaixo mantém uma rotina a cada 24 horas enquanto o processo estiver ativo. Para o Agendador de Tarefas ou systemd, acrescente --uma-vez e configure a frequência no sistema operacional.</p><pre>{{agendado}}</pre><button class="p-button" @click="copiar(agendado)">Copiar comando de agendamento</button><p>A restauração continua sendo uma operação deliberada, inicialmente em modo de conferência e em ambiente vazio. Não é executada automaticamente sobre a produção.</p></details>
    <p v-if="mensagem" role="status">{{ mensagem }}</p>
  </section>
</template>
<script setup>
import { ref } from "vue";
import { cliente } from "../../firebase";
import { db } from '../../firebase';
import {doc} from 'firebase/firestore';
import {useColecao} from '../../composables/useColecao';
import {dataTexto} from '../../portal/validacao';
import EstadoConsulta from '../../components/portal/EstadoConsulta.vue';
const agenda=useColecao(()=>doc(db,'operacao','backupAgendado'));
const mensagem = ref("");
const comum = `--cliente ${cliente.id} --confirmar-projeto ${cliente.firebase.projectId}`;
const backup = `npm run recuperacao -- --acao backup ${comum} --arquivo backup.seducbak --hash-config /caminho-protegido/parametros-senha.json`;
const agendado = `npm run backup:agendado -- ${comum} --destino /caminho-protegido/backups --hash-config /caminho-protegido/parametros-senha.json --horas 24`;
const restauracao = `npm run recuperacao -- --acao restaurar ${comum} --arquivo backup.seducbak`;
async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    mensagem.value = "Comando copiado.";
  } catch {
    mensagem.value = "Selecione o comando acima e copie pelo teclado.";
  }
}
</script>
<style scoped>
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  padding: 1rem;
  background: var(--p-bg);
}
.p-card {
  padding: 1.5rem;
}
</style>
