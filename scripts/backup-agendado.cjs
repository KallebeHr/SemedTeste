// Executar em máquina administrativa. Nunca importar este arquivo no frontend.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { deleteApp } = require('firebase-admin/app');
const { FieldValue } = require('firebase-admin/firestore');
const { argumentos, carregarCliente, raiz } = require('./cliente.cjs');
const { ambiente, gerar, verificarArquivo } = require('./recuperacao.cjs');
const { abrir } = require('./arquivo-backup.cjs');
function validarAgenda(a) {
  const intervalo = Number(a.horas || 24);
  if (!Number.isInteger(intervalo) || intervalo < 1 || intervalo > 168) throw new Error('Use um intervalo de 1 a 168 horas.');
  if (typeof a.destino !== 'string' || !path.isAbsolute(a.destino)) throw new Error('Informe --destino com caminho absoluto, fora do projeto.');
  const destino = path.resolve(a.destino), rel = path.relative(raiz,destino);
  const dentro=rel==='' || (!path.isAbsolute(rel) && rel!=='..' && !rel.startsWith('..'+path.sep));
  if (destino === path.parse(destino).root || dentro) throw new Error('A pasta de backups deve ficar fora do projeto, sem usar a raiz do disco.');
  return { intervalo, destino };
}
async function executarBackup(ctx, cliente, {destino, senha, hashConfig}) {
  if (!senha || senha.length < 16) throw new Error('Configure SEDUC_BACKUP_SENHA com pelo menos 16 caracteres no ambiente protegido.');
  fs.mkdirSync(destino,{recursive:true,mode:0o700});
  const status = ctx.db.doc('operacao/backupAgendado');
  await status.set({estado:'em_execucao',tentativaEm:FieldValue.serverTimestamp()},{merge:true});
  try {
    const r = await gerar(ctx,{cliente,senha,hashConfig});
    const nome = 'seduc-'+cliente.id+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.seducbak';
    const arquivo = path.join(destino,nome);
    fs.writeFileSync(arquivo,r.arquivo,{flag:'wx',mode:0o600});
    const fd = fs.openSync(arquivo,'r');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    const d = abrir(fs.readFileSync(arquivo),senha);
    verificarArquivo(d);
    await status.set({estado:'concluido',ultimaConclusao:FieldValue.serverTimestamp(),documentos:r.manifesto.documentos,contas:r.manifesto.contas,arquivo:nome},{merge:true});
    return {arquivo,manifesto:r.manifesto};
  } catch(e) {
    await status.set({estado:'falhou',ultimaFalha:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});
    throw e;
  }
}
async function main() {
  const a=argumentos(),c=carregarCliente(a.cliente),cfg=validarAgenda(a);
  if(a['confirmar-projeto']!==c.firebase.projectId)throw new Error('Confirme explicitamente --confirmar-projeto '+c.firebase.projectId);
  if(!process.env.SEDUC_BACKUP_SENHA)throw new Error('A senha do backup deve ser configurada no ambiente protegido.');
  fs.mkdirSync(cfg.destino,{recursive:true,mode:0o700});
  cfg.destino=fs.realpathSync(cfg.destino);
  validarAgenda({...a,destino:cfg.destino});
  const lock=path.join(cfg.destino,'agendador-'+c.id+'.lock');
  const fd=fs.openSync(lock,'wx',0o600);
  let ctx;
  let parar=false, liberarEspera;
  const sinal=()=>{parar=true;liberarEspera?.();};
  process.once('SIGINT',sinal);process.once('SIGTERM',sinal);
  try {
    ctx=ambiente(c.firebase.projectId);
    const hashConfig=a['hash-config']?JSON.parse(fs.readFileSync(a['hash-config'],'utf8')):null;
    do {
      try {
        const r=await executarBackup(ctx,c,{...cfg,senha:process.env.SEDUC_BACKUP_SENHA,hashConfig});
        console.log(JSON.stringify({evento:'backup_concluido',em:new Date().toISOString(),documentos:r.manifesto.documentos,contas:r.manifesto.contas}));
      } catch(e) {
        console.error('Backup não concluído:',e.code || e.message);
        if(a['uma-vez']) {process.exitCode=1;break;}
      }
      if(a['uma-vez']||parar)break;
      // Espera assíncrona no processo de serviço. O operador pode pará-lo por sinal.
      await new Promise(resolve=>{const timer=setTimeout(resolve,cfg.intervalo*3600000);liberarEspera=()=>{clearTimeout(timer);resolve();};});
    } while(!parar);
  } finally {
    try { if(ctx) await deleteApp(ctx.app); } finally { fs.closeSync(fd);fs.unlinkSync(lock); }
    process.removeListener('SIGINT',sinal);process.removeListener('SIGTERM',sinal);
  }
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={validarAgenda,executarBackup};
