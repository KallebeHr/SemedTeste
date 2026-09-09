// Lê somente texto renderizado. Não consulta valores de campos ou atributos privados.
export function textoAcessivel(raiz,limite=30000) {
  if(!raiz)return '';
  const walker=document.createTreeWalker(raiz,NodeFilter.SHOW_TEXT),partes=[];let node,total=0;
  while((node=walker.nextNode()) && total<limite){
    const pai=node.parentElement;
    if(!pai || pai.closest('form,input,textarea,select,button,nav,script,style,[aria-hidden="true"],[hidden],[data-nao-ler],.sr-only') || !pai.getClientRects().length)continue;
    if(getComputedStyle(pai).visibility==='hidden')continue;
    const texto=node.textContent.replace(/\s+/g,' ').trim();if(texto){partes.push(texto);total+=texto.length+1;}
  }
  return partes.join(' ').slice(0,limite);
}
export function trechosDeVoz(texto){return texto.match(/.{1,200}(?:\s|$)|.{1,200}/g)?.map(t=>t.trim()).filter(Boolean)||[];}
