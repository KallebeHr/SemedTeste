const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../../public/libras/painel.js'), 'utf8');
function ambiente() {
  const handlers = {}, mensagens = [], traducoes = [], scripts = [], intervalos = [];
  const parent = {postMessage: (dados, origem) => mensagens.push({dados, origem})};
  const root = {dataset:{active:'true'}, hasAttribute: () => true};
  const window = {addEventListener:(tipo, fn)=>{handlers[tipo]=fn;}, VLibrasWidget:{initBtn:{},open:()=>{}}, vlibras:{isLoaded:true,stop:()=>{}, translateAndPlay:async t=>traducoes.push(t)}};
  const ctx = {window,parent,document:{getElementById:()=>root,createElement:()=>({}),body:{append:s=>scripts.push(s)}},setInterval:fn=>{intervalos.push(fn);return 1;},clearInterval:()=>{},setTimeout:()=>1,clearTimeout:()=>{},console};
  vm.runInNewContext(script,ctx);
  const evento=(data,source=parent,origin='https://portal.example')=>handlers.message({data,source,origin});
  const iniciar=()=>{evento({tipo:'seduc-libras-iniciar',versao:2});scripts[0].onload();};
  return {evento,iniciar,traducoes,mensagens,scripts,window,root,intervalos};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('não carrega serviço antes da ativação nem aceita outra janela',()=>{const a=ambiente();a.evento({tipo:'seduc-libras-iniciar',versao:2},{});assert.equal(a.scripts.length,0);a.iniciar();a.evento({tipo:'seduc-libras-iniciar',versao:2});assert.equal(a.scripts.length,1);});
test('encaminha texto para a API de tradução e reprodução',async()=>{const a=ambiente();a.iniciar();a.evento({tipo:'seduc-libras-traduzir',texto:' Educação   para todos ',id:1});await flush();assert.deepEqual(a.traducoes,['Educação para todos']);assert.ok(a.mensagens.some(m=>m.dados.tipo==='vlibras-pronto'));assert.ok(a.mensagens.every(m=>m.origem==='https://portal.example'));});
test('rejeita origem diferente, identificadores inválidos e texto muito longo',async()=>{const a=ambiente();a.iniciar();a.evento({tipo:'seduc-libras-traduzir',texto:'X',id:1},undefined,'https://outro.example');a.evento({tipo:'seduc-libras-traduzir',texto:'a'.repeat(1501),id:1});a.evento({tipo:'seduc-libras-traduzir',texto:'X',id:'1'});a.evento({tipo:'seduc-libras-traduzir',texto:'X',id:2},{});await flush();assert.equal(a.traducoes.length,0);});
test('cliques rápidos são serializados e priorizam o último trecho',async()=>{const a=ambiente();let liberar;a.window.vlibras.translateAndPlay=t=>{a.traducoes.push(t);return new Promise(r=>{liberar=r;});};a.iniciar();a.evento({tipo:'seduc-libras-traduzir',texto:'Primeiro',id:1});a.evento({tipo:'seduc-libras-traduzir',texto:'Segundo',id:2});a.evento({tipo:'seduc-libras-traduzir',texto:'Último',id:3});assert.deepEqual(a.traducoes,['Primeiro']);liberar();await flush();assert.deepEqual(a.traducoes,['Primeiro','Último']);liberar();await flush();});
test('falha de tradução é comunicada sem vazar erro ou texto',async()=>{const a=ambiente();a.window.vlibras.translateAndPlay=async()=>{throw Error('mensagem externa');};a.iniciar();a.evento({tipo:'seduc-libras-traduzir',texto:'Teste',id:4});await flush();assert.ok(a.mensagens.some(m=>m.dados.tipo==='vlibras-traducao-erro'&&m.dados.id===4));assert.ok(!JSON.stringify(a.mensagens).includes('mensagem externa'));});
test('fechamento do widget comunica redução de tamanho',()=>{const a=ambiente();a.iniciar();a.root.dataset.active='false';a.intervalos[0]();assert.ok(a.mensagens.some(m=>m.dados.tipo==='vlibras-tamanho'&&m.dados.aberto===false));});
test('mantém compatibilidade com API plugin.translate',async()=>{const a=ambiente();delete a.window.vlibras;a.window.plugin={translate:async t=>a.traducoes.push(t)};a.iniciar();a.evento({tipo:'seduc-libras-traduzir',texto:'Legado',id:1});await flush();assert.deepEqual(a.traducoes,['Legado']);});
