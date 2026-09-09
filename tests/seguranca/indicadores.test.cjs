const {test}=require('node:test'),assert=require('node:assert/strict');
test('consumo separa unidades e meses, e exclui perdas e entradas',async()=>{
  const {consolidarRede}=await import('../../src/portal/indicadores.js');
  const escola={id:'a',nome:'Escola teste',estoque:[{id:'arroz',unidade:'kg',quantidadeAtual:2,quantidadeMinima:3,precoUnitario:5},{id:'suco',unidade:'l',quantidadeAtual:4,quantidadeMinima:1,precoUnitario:2}],vistorias:[],movimentos:[{itemId:'arroz',tipo:'saida',quantidade:3,data:'2026-08-01T12:00:00Z'},{itemId:'arroz',tipo:'saida',quantidade:7,data:'2026-09-01T12:00:00Z'},{itemId:'suco',tipo:'saida',quantidade:2,data:'2026-09-01T12:00:00Z'},{itemId:'arroz',tipo:'perda',quantidade:20,data:'2026-09-01T12:00:00Z'},{itemId:'arroz',tipo:'entrada',quantidade:200,data:'2026-09-01T12:00:00Z'}]};
  const r=consolidarRede([escola]);assert.deepEqual(r.consumo,[{unidade:'kg',quantidade:10},{unidade:'l',quantidade:2}]);assert.equal(r.series[0].maximo,7);assert.equal(r.series[0].pontos.length,2);assert.equal(r.criticos.length,1);assert.equal(r.valor,18);
});
test('vencidos sem saldo e itens inativos não inflam os indicadores',async()=>{
  const {consolidarRede}=await import('../../src/portal/indicadores.js');
  const r=consolidarRede([{id:'a',estoque:[{id:'zero',validade:'2020-01-01',quantidadeAtual:0,quantidadeMinima:0,precoUnitario:1},{id:'antigo',ativo:false,validade:'2020-01-01',quantidadeAtual:4,quantidadeMinima:8,precoUnitario:1}],movimentos:[],vistorias:[],ultimaVistoria:{data:'2026-09-01T12:00:00Z'}}],30,Date.parse('2026-09-08T12:00:00Z'));assert.equal(r.vencidos.length,0);assert.equal(r.criticos.length,1);assert.equal(r.valor,0);assert.equal(r.pendentes.length,0);
});
test('leitura divide textos extensos sem perder palavras nem exceder o trecho',async()=>{
  const {trechosDeVoz}=await import('../../src/portal/textoAcessivel.js');const texto='Alimentação escolar. '.repeat(150);const partes=trechosDeVoz(texto);assert.ok(partes.length>1);assert.ok(partes.every(p=>p.length<=201));assert.equal(partes.join(' ').replace(/\s/g,''),texto.replace(/\s/g,''));
});
