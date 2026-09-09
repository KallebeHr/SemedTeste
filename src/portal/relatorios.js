import { dataTexto } from './validacao';
import { useAuth } from '../composables/useAuth';
export function tabelaRelatorio(tipo, linhas) {
  if (tipo === 'estoque') return {cabecalho:['Escola','Item','Categoria','Unidade','Saldo atual','Mínimo','Validade'], linhas:linhas.map(i=>[i.escolaNome,i.nome,i.categoria,i.unidade,i.quantidadeAtual,i.quantidadeMinima,i.validade?dataTexto(i.validade):'Não informada'])};
  if (tipo === 'vistorias') return {cabecalho:['Escola','Data','Tipo','Resultado','Nota','Responsável'], linhas:linhas.map(v=>[v.escolaNome,dataTexto(v.data),v.tipo,v.status,v.notaGeral??'N/A',v.responsavelNome])};
  return {cabecalho:['Escola','Data','Item','Tipo','Quantidade','Unidade','Responsável'], linhas:linhas.map(m=>[m.escolaNome,dataTexto(m.data),m.itemNome,m.tipo,m.quantidade,m.unidade,m.responsavelNome])};
}
export async function exportarTabela({titulo, contexto, cabecalho, linhas, formato}) {
  const {usuario,exigirUsuario} = useAuth();
  const identidade=JSON.stringify(exigirUsuario());
  const conferir=()=>{if(!usuario.value || JSON.stringify(usuario.value)!==identidade)throw new Error('A sessão ou as permissões mudaram. Consulte novamente antes de exportar.');};
  if (!linhas.length || linhas.length > 10000) throw new Error('Exporte de 1 a 10.000 linhas por vez. Reduza os filtros.');
  const nome = titulo.normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,70);
  if (formato === 'xlsx') {
    const {default:writeXlsxFile} = await import('write-excel-file/browser');
    const cell = v => typeof v === 'number' && Number.isFinite(v) ? {type:Number,value:v} : {type:String,value:String(v??'')};
    // Células de texto explícitas: conteúdo iniciado por =, + ou @ não é fórmula.
    const blob = await writeXlsxFile([
      [{value:titulo,type:String,fontWeight:'bold'}], [{value:contexto,type:String}],
      cabecalho.map(v=>({value:v,type:String,fontWeight:'bold',backgroundColor:'#E7F3EF'})),
      ...linhas.map(l=>l.map(cell)),
    ],{columns:cabecalho.map(()=>({width:25})),stickyRowsCount:3}).toBlob();
    conferir();
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=nome+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  } else {
    const [{jsPDF},{default:autoTable}] = await Promise.all([import('jspdf'),import('jspdf-autotable')]);
    const pdf = new jsPDF({orientation:'landscape'});
    pdf.setFontSize(16); pdf.text(titulo,14,18);
    pdf.setFontSize(9); pdf.text(pdf.splitTextToSize(contexto,265),14,26);
    autoTable(pdf,{startY:39,head:[cabecalho],body:linhas,styles:{fontSize:9},headStyles:{fillColor:[0,122,114]},didDrawPage:()=>{pdf.setFontSize(8);pdf.text('SEDUC · Pedro II — Relatório interno · Página '+pdf.internal.getNumberOfPages(),14,202);}});
    conferir();pdf.save(nome+'.pdf');
  }
}
