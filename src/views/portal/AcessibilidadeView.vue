<template>
  <div class="p-container p-page">
    <header class="p-page-head">
      <p class="p-eyebrow">UM PORTAL PARA TODOS</p>
      <h1>Acessibilidade</h1>
      <p>Recursos para facilitar a leitura e a navegação.</p>
    </header>
    <div class="p-grid">
      <section class="p-card"><h2>Voz e Libras</h2><p>“Ouvir página” lê o conteúdo com uma voz de português instalada no dispositivo. É possível pausar, retomar e parar. Valores preenchidos em formulários ficam excluídos.</p><p>Nas páginas públicas, “Libras” permite ativar o VLibras em um painel separado. A tradução automática usa o serviço do Governo Federal e não substitui um intérprete humano. Áreas privadas não são enviadas para tradução.</p></section>
      <section class="p-card">
        <h2>Leitura</h2>
        <p>
          Abra o ícone de acessibilidade no canto inferior esquerdo e use A−, A e A+ para ajustar a fonte entre 90% e
          200%. O botão Alto contraste muda as cores. As preferências ficam
          salvas neste navegador.
        </p>
      </section>
      <section class="p-card">
        <h2>Teclado</h2>
        <p>
          Use Tab e Shift+Tab para percorrer os controles. Enter abre links e
          envia formulários. Espaço aciona botões. Escape fecha os menus. O
          primeiro link da página permite ir diretamente ao conteúdo.
        </p>
      </section>
      <section class="p-card">
        <h2>Movimento e ampliação</h2>
        <p>
          O portal respeita a preferência de redução de movimento do sistema.
          Você também pode ampliar a página com os controles do navegador.
          Tabelas extensas permitem rolagem horizontal.
        </p>
      </section>
      <section class="p-card">
        <h2>Encontrou uma barreira?</h2>
        <p>
          Informe a página, o recurso utilizado e a dificuldade encontrada para
          que a equipe possa corrigir.
        </p>
        <router-link class="p-button" to="/atendimento?tipo=ouvidoria"
          >Comunicar dificuldade</router-link
        >
      </section>
    </div>
  </div>
</template>
