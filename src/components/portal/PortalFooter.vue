<template>
  <footer class="portal-footer">
    <div class="p-container footer-grid">
      <div>
        <img
          src="/IMG/semedBranco.svg"
          alt="Secretaria de Educação de Pedro II"
          width="240"
        />
        <p>
          Educação pública, informação e serviços<br />para a comunidade de
          Pedro II.
        </p>
      </div>
      <div>
        <h2>Explore o portal</h2>
        <router-link to="/carta-de-servicos">Carta de serviços</router-link
        ><router-link to="/escolas">Escolas da rede</router-link
        ><router-link to="/mapa-do-site">Mapa do site</router-link>
      </div>
      <div>
        <h2>Informação e atendimento</h2>
        <router-link to="/acesso-a-informacao">Acesso à informação</router-link
        ><router-link to="/fale-conosco">Fale conosco</router-link
        ><router-link to="/privacidade">Privacidade</router-link
        ><router-link to="/acessibilidade">Acessibilidade</router-link>
      </div>
      <div
        v-if="
          configuracao.endereco || configuracao.email || configuracao.telefone
        "
      >
        <h2>Contato</h2>
        <p>{{ configuracao.endereco }}</p>
        <p>{{ configuracao.telefone }}</p>
        <p>{{ configuracao.email }}</p>
        <p>{{ configuracao.horario }}</p>
      </div>
    </div>
    <div class="p-container footer-bottom">
      Secretaria Municipal de Educação · Pedro II ·
      {{ new Date().getFullYear() }}
    </div>
  </footer>
</template>
<script setup>
import { usePortal } from "../../composables/usePortal";
const { configuracao } = usePortal();
</script>
<style scoped>
.portal-footer {
  background: #083c4a;
  color: #e0eeef;
  padding-top: 3rem;
  font-size: 0.87rem;
}
.footer-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr;
  gap: 2rem;
  padding-bottom: 2rem;
}
.footer-grid h2 {
  color: #fff;
  font-size: 1rem;
  margin-bottom: 1rem;
}
.footer-grid a {
  display: block;
  color: inherit;
  text-decoration: none;
  margin: 0.45rem 0;
}
.footer-grid a:hover {
  text-decoration: underline;
}
.footer-grid img {
  margin-bottom: 1rem;
}
.footer-bottom {
  padding-block: 1.3rem;
  border-top: 1px solid #ffffff30;
  font-size: 0.8rem;
}
@media (max-width: 720px) {
  .footer-grid {
    grid-template-columns: 1fr 1fr;
  }
  .footer-grid > div:first-child {
    grid-column: 1/-1;
  }
}
</style>
