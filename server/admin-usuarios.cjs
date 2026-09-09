// Exclusivamente servidor. Nunca importe este módulo em src/.
const { randomUUID } = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
class Falha extends Error { constructor(status, mensagem) { super(mensagem); this.status=status; } }
const master=p=>p && p.ativo!==false && ['master','admin'].includes(p.papel);
function autorizar(token,perfil,agora,recente=false) {
  if(!master(perfil))throw new Falha(403,'Somente um Master ativo pode executar esta operação.');
  const idade=agora/1000-Number(token.auth_time||0);
  if(idade<0 || idade>=28800 || Number(token.auth_time||0)<Number(perfil.sessaoRevogadaEm||0))throw new Falha(401,'Entre novamente para continuar.');
  if(recente && idade>900)throw new Falha(401,'Confirme novamente sua senha antes desta operação.');
}
function corpoValido(body,uid) {
  if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(k=>!['acao','uid','operacaoId'].includes(k)))throw new Falha(400,'Pedido inválido.');
  if(!['desativar_auth','reativar_auth','revogar_sessoes'].includes(body.acao) || !/^[A-Za-z0-9:_-]{1,128}$/.test(body.uid||'') || !/^[0-9a-f-]{36}$/.test(body.operacaoId||''))throw new Falha(400,'Confira a ação e a identificação.');
  if(body.uid===uid)throw new Falha(400,'Use outro Master para alterar sua própria conta.');
  return body;
}
function criarHandler({db,auth,origens,agora=Date.now}) {
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    try {
      if(!origens.includes(req.headers.origin))throw new Falha(403,'Origem não autorizada.');
      if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');throw new Falha(405,'Método não permitido.');}
      const bearer=req.headers.authorization||'';
      if(!/^Bearer [^\s]{10,8192}$/.test(bearer))throw new Falha(401,'Autenticação necessária.');
      let token;
      try { token=await auth.verifyIdToken(bearer.slice(7),true); } catch { throw new Falha(401,'Sua sessão não pôde ser validada. Entre novamente.'); }
      const atorRef=db.doc('usuarios/'+token.uid);
      const perfil=(await atorRef.get()).data();autorizar(token,perfil,agora(),req.method==='POST');
      if(req.method==='GET')return res.status(200).json({disponivel:true});
      if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'') || Buffer.byteLength(JSON.stringify(req.body||{}))>8192)throw new Falha(400,'Use um pedido JSON de até 8 KB.');
      const b=corpoValido(req.body,token.uid), op=db.doc('operacoesAdmin/'+b.operacaoId), alvo=db.doc('usuarios/'+b.uid), equipe=db.doc('equipe/'+b.uid), limite=db.doc('limitesAdmin/'+token.uid);
      const authAntes=await auth.getUser(b.uid).catch(()=>{throw new Falha(404,'Conta não localizada no Authentication. Confira o UID.');});
      const auditRef=db.doc('auditoriaRegistros/'+randomUUID()), auditEquipe=db.doc('auditoriaRegistros/'+randomUUID());
      const repetir=await db.runTransaction(async tx=>{
        const [at,old,target,eq,man,lim]=await Promise.all([tx.get(atorRef),tx.get(op),tx.get(alvo),tx.get(equipe),tx.get(db.doc('operacao/estado')),tx.get(limite)]);
        autorizar(token,at.data(),agora(),true);
        if(old.exists){const o=old.data();if(o.atorUid!==token.uid || o.alvoUid!==b.uid || o.acao!==b.acao)throw new Falha(409,'Identificador já utilizado em outra operação.');return o;}
        if(man.data()?.bloqueado)throw new Falha(409,'Sistema em manutenção. Aguarde a liberação.');
        if(!target.exists || !eq.exists)throw new Falha(404,'Cadastre primeiro o perfil e o vínculo da equipe.');
        const janela=Math.floor(agora()/60000),n=lim.data()?.janela===janela?lim.data().quantidade:0;
        if(n>=10)throw new Falha(429,'Limite de dez operações por minuto. Aguarde antes de repetir.');
        tx.set(limite,{janela,quantidade:n+1});
        tx.create(op,{acao:b.acao,atorUid:token.uid,atorNome:at.data().nome,alvoUid:b.uid,estado:'em_execucao',criadoEm:FieldValue.serverTimestamp(),authDesativadoAntes:authAntes.disabled});
        // Primeiro bloqueia o acesso aos dados. Auth e Firestore não compartilham transação.
        if(b.acao!=='reativar_auth') {
          const revogada=Math.floor(agora()/1000)+1;
          const mudanca={sessaoRevogadaEm:revogada,atualizadoEm:FieldValue.serverTimestamp(),...(b.acao==='desativar_auth'?{ativo:false}:{})};
          registrar(tx,alvo,target.data(),mudanca,auditRef,token.uid,at.data());
          if(b.acao==='desativar_auth')registrar(tx,equipe,eq.data(),{ativo:false},auditEquipe,token.uid,at.data());
        }
        return null;
      });
      if(repetir) {
        if(repetir.estado!=='concluido')throw new Falha(409,'Operação já iniciada. Confira o histórico antes de tentar uma nova ação.');
        return res.status(200).json({estado:'concluido',operacaoId:op.id,repetida:true});
      }
      try {
        if(b.acao==='desativar_auth')await auth.updateUser(b.uid,{disabled:true});
        if(b.acao==='reativar_auth')await auth.updateUser(b.uid,{disabled:false});
        if(b.acao!=='reativar_auth')await auth.revokeRefreshTokens(b.uid);
        await op.update({estado:'concluido',concluidoEm:FieldValue.serverTimestamp()});
      } catch {
        await op.update({estado:'verificar',falhaEm:FieldValue.serverTimestamp()}).catch(()=>{});
        throw new Falha(502,'O Authentication não confirmou todas as etapas. Confira o histórico e o console Firebase. O bloqueio já registrado no perfil permanece válido.');
      }
      return res.status(200).json({estado:'concluido',operacaoId:op.id});
    } catch(e) { return res.status(e instanceof Falha?e.status:500).json({erro:e instanceof Falha?e.message:'Não foi possível confirmar a operação. Consulte o histórico antes de repetir.'}); }
  };
}
function registrar(tx,ref,antes,mudanca,audit,uid,perfil) {
  const depois={...antes,...mudanca,_auditoria:audit.id,_registradoEm:FieldValue.serverTimestamp()};
  tx.set(ref,depois);tx.create(audit,{versaoEsquema:1,caminho:ref.path,alvo:ref,colecao:ref.parent.id,documentoId:ref.id,escolaId:null,dominio:'portal',acao:'update',usuarioId:uid,usuarioNome:perfil.nome,papelUsuario:perfil.papel,dadosAntes:antes,dadosDepois:depois,timestamp:FieldValue.serverTimestamp()});
}
module.exports={criarHandler,autorizar,corpoValido};
