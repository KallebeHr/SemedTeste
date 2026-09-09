export function instante(v) { return v?.toMillis?.() ?? new Date(v).getTime(); }
export function consolidarRede(escolas, diasVistoria = 30, agora = Date.now()) {
  const estoque = escolas.flatMap(e => e.estoque.map(i => ({ ...i, escolaId:e.id, escolaNome:e.nome })));
  const movimentos = escolas.flatMap(e => e.movimentos.map(m => {
    const item = e.estoque.find(i => i.id === m.itemId);
    return { ...m, escolaId:e.id, escolaNome:e.nome, unidade:item?.unidade || 'não informada', categoria:item?.categoria || 'não informada' };
  }));
  const vistorias = escolas.flatMap(e => e.vistorias.map(v => ({ ...v, escolaId:e.id, escolaNome:e.nome })));
  const criticos = estoque.filter(i => i.ativo !== false && i.quantidadeAtual <= i.quantidadeMinima);
  const vencidos = estoque.filter(i => i.ativo !== false && i.quantidadeAtual > 0 && i.validade && instante(i.validade) < agora);
  const pendentes = escolas.filter(e => !e.ultimaVistoria || instante(e.ultimaVistoria.data) < agora - diasVistoria * 86400000);
  const consumo = new Map();
  const meses = new Map();
  for (const m of movimentos.filter(m => m.tipo === 'saida')) {
    const key = m.unidade;
    consumo.set(key, (consumo.get(key) || 0) + Number(m.quantidade || 0));
    const mes = new Date(instante(m.data)).toLocaleDateString('sv-SE',{timeZone:'America/Fortaleza'}).slice(0,7);
    if (!meses.has(key)) meses.set(key,new Map());
    meses.get(key).set(mes,(meses.get(key).get(mes)||0)+Number(m.quantidade||0));
  }
  return { estoque, movimentos, vistorias, criticos, vencidos, pendentes,
    series: [...meses].map(([unidade, pontos])=>({unidade,pontos:[...pontos].sort(([a],[b])=>a.localeCompare(b)).map(([mes,quantidade])=>({mes,quantidade})),maximo:Math.max(1,...pontos.values())})),
    consumo: [...consumo].map(([unidade, quantidade]) => ({ unidade, quantidade: Math.round(quantidade*1e6)/1e6 })),
    valor: estoque.filter(i => i.ativo !== false).reduce((s,i) => s + i.quantidadeAtual * i.precoUnitario, 0) };
}
