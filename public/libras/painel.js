// Este documento roda em iframe de origem opaca; o serviço não acessa o portal.
window.addEventListener('message',e=>{
  if(e.source!==parent || e.data?.tipo!=='seduc-texto-publico' || typeof e.data.texto!=='string')return;
  const texto=document.getElementById('texto');
  if(texto.dataset.recebido)return;
  texto.dataset.recebido='sim';texto.textContent=e.data.texto.slice(0,30000);
  const script=document.createElement('script');script.src='https://vlibras.gov.br/app/vlibras-plugin.js';
  let abriu=false,estado;
  const sincronizar=()=>{
    if(!abriu && window.VLibrasWidget?.initBtn){abriu=true;window.VLibrasWidget.open();}
    const widget=document.getElementById('vlibras-app-root');
    if(widget?.hasAttribute('data-active')){const aberto=widget.dataset.active==='true';if(aberto!==estado){estado=aberto;parent.postMessage({tipo:'vlibras-tamanho',aberto},'*');}}
  };
  const observer=new MutationObserver(sincronizar);
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-active']});
  script.onload=sincronizar;
  script.onerror=()=>{observer.disconnect();parent.postMessage({tipo:'vlibras-falha'},'*');};
  document.body.append(script);
});
