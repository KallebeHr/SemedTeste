// Serviço externo confinado a este documento sem acesso ao DOM, Auth ou storage do portal.
(() => {
  let iniciado = false, abriu = false, pai, anterior, timer, prazo, pronto = false, executando = false, pendente = null;
  function enviar(mensagem) { if (pai) parent.postMessage(mensagem, pai); }
  function api() {
    if (window.vlibras?.isLoaded === false) return null;
    if (typeof window.vlibras?.translateAndPlay === 'function') return texto => window.vlibras.translateAndPlay(texto);
    if (typeof window.plugin?.translate === 'function') return texto => window.plugin.translate(texto);
    return null;
  }
  function falhar() { clearInterval(timer); clearTimeout(prazo); enviar({ tipo: 'vlibras-falha' }); }
  async function traduzir() {
    const executar = api();
    if (executando || !pendente || !executar) return;
    const item = pendente; pendente = null; executando = true;
    const limite = setTimeout(() => enviar({ tipo: 'vlibras-traducao-tempo' }), 30000);
    try {
      window.VLibrasWidget?.open?.();
      if (typeof window.vlibras?.stop === 'function') window.vlibras.stop();
      await executar(item.texto);
    } catch { enviar({ tipo: 'vlibras-traducao-erro', id: item.id }); }
    finally { clearTimeout(limite); executando = false; if (pendente) void traduzir(); }
  }
  function sincronizar() {
    if (!abriu && window.VLibrasWidget?.initBtn) { abriu = true; window.VLibrasWidget.open(); }
    const root = document.getElementById('vlibras-app-root');
    if (root?.hasAttribute('data-active')) {
      const aberto = root.dataset.active === 'true';
      if (aberto !== anterior) { anterior = aberto; enviar({ tipo: 'vlibras-tamanho', aberto }); }
    }
    if (api() && !pronto) { pronto = true; clearTimeout(prazo); enviar({ tipo: 'vlibras-pronto' }); }
    if (pronto && pendente) void traduzir();
  }
  window.addEventListener('message', e => {
    if (e.source !== parent || !e.data || typeof e.data !== 'object') return;
    if (e.data.tipo === 'seduc-libras-iniciar' && e.data.versao === 2 && !iniciado) {
      if (!/^https?:\/\//.test(e.origin)) return;
      pai = e.origin; iniciado = true;
      const script = document.createElement('script');
      script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js'; script.async = true;
      script.onerror = falhar; script.onload = sincronizar;
      timer = setInterval(sincronizar, 400);
      prazo = setTimeout(falhar, 85000);
      document.body.append(script);
    }
    if (e.origin !== pai || !iniciado || e.data.tipo !== 'seduc-libras-traduzir') return;
    if (typeof e.data.texto !== 'string' || e.data.texto.length > 1500 || !Number.isSafeInteger(e.data.id) || e.data.id < 1) return;
    const texto = e.data.texto.replace(/\s+/g, ' ').trim(); if (!texto) return;
    // Uma tradução por vez; se houver novos cliques, mantém apenas o mais recente.
    pendente = { texto, id: e.data.id }; void traduzir();
  });
  window.addEventListener('pagehide', () => { clearInterval(timer); clearTimeout(prazo); pendente = null; });
})();
