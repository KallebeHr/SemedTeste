const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {criarHandler,autorizar,corpoValido}=require('../../server/admin-usuarios.cjs');
let app,db,handler,chamadas=0,falhar=false;
const agora=()=>Date.now();
before(async()=>{
  if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Este teste exige o emulador Firestore.');
  app=initializeApp({projectId:'demo-seduc-api'},'teste-admin');db=getFirestore(app);
  await db.doc('usuarios/master').set({nome:'Master de teste',papel:'master',ativo:true});
  await db.doc('usuarios/alvo').set({nome:'Profissional',papel:'professor',ativo:true});
  await db.doc('equipe/alvo').set({nome:'Profissional',papel:'professor',ativo:true});
  handler=criarHandler({db,origens:['https://portal.example.test'],auth:{verifyIdToken:async()=>({uid:'master',auth_time:Math.floor(agora()/1000)}),getUser:async()=>({disabled:false}),updateUser:async()=>{chamadas++;if(falhar)throw new Error('rede');},revokeRefreshTokens:async()=>{chamadas++;}},agora});
});
after(async()=>{if(app)await deleteApp(app);});
async function pedir(body,extra={}){const res={status(n){this.codigo=n;return this;},setHeader(){},json(d){this.dados=d;return this;}};await handler({method:'POST',headers:{origin:'https://portal.example.test',authorization:'Bearer token-de-teste','content-type':'application/json'},body,...extra},res);return res;}
test('autoriza somente Master ativo, com autenticação recente e sessão não revogada',()=>{
  const t={auth_time:Math.floor(agora()/1000)-60},p={papel:'master',ativo:true};
  assert.doesNotThrow(()=>autorizar(t,p,agora(),true));
  for(const perfil of [{...p,papel:'professor'},{...p,ativo:false},{...p,sessaoRevogadaEm:t.auth_time+1}])assert.throws(()=>autorizar(t,perfil,agora(),true));
  assert.throws(()=>autorizar({...t,auth_time:t.auth_time-1000},p,agora(),true));
  assert.throws(()=>corpoValido({acao:'desativar_auth',uid:'master',operacaoId:randomUUID()},'master'));
});
test('recusa origem externa e corpo com campos extras',async()=>{
  const b={acao:'desativar_auth',uid:'alvo',operacaoId:randomUUID()};
  assert.equal((await pedir(b,{headers:{origin:'https://invasor.example.test'}})).codigo,403);
  assert.equal((await pedir({...b,papel:'master'})).codigo,400);
});
test('desativação bloqueia perfil e equipe, audita e repetição não duplica ação',async()=>{
  const b={acao:'desativar_auth',uid:'alvo',operacaoId:randomUUID()};
  assert.equal((await pedir(b)).codigo,200);const total=chamadas;
  assert.equal((await pedir(b)).dados.repetida,true);assert.equal(chamadas,total);
  const p=(await db.doc('usuarios/alvo').get()).data();assert.equal(p.ativo,false);assert.ok(p.sessaoRevogadaEm>agora()/1000);
  assert.equal((await db.doc('equipe/alvo').get()).data().ativo,false);
  const audit=(await db.doc('auditoriaRegistros/'+p._auditoria).get()).data();assert.equal(audit.dadosAntes.ativo,true);assert.equal(audit.dadosDepois.ativo,false);assert.equal(audit.usuarioId,'master');
});
test('falha parcial preserva bloqueio e exige conferência sem repetir automaticamente',async()=>{
  falhar=true;const b={acao:'desativar_auth',uid:'alvo',operacaoId:randomUUID()};
  assert.equal((await pedir(b)).codigo,502);
  assert.equal((await db.doc('operacoesAdmin/'+b.operacaoId).get()).data().estado,'verificar');
  assert.equal((await pedir(b)).codigo,409);falhar=false;
});
test('reativar Authentication mantém o perfil suspenso',async()=>{
  assert.equal((await pedir({acao:'reativar_auth',uid:'alvo',operacaoId:randomUUID()})).codigo,200);
  assert.equal((await db.doc('usuarios/alvo').get()).data().ativo,false);
});
