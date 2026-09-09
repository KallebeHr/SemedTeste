const {getApps,initializeApp,cert}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore}=require('firebase-admin/firestore');
const {carregarCliente}=require('../../scripts/cliente.cjs');
const {criarHandler}=require('../../server/admin-usuarios.cjs');
let handler;
module.exports=async(req,res)=>{
  if(!handler)try {
    const cliente=carregarCliente(process.env.SEDUC_CLIENTE);
    const credencial=JSON.parse(process.env.SEDUC_ADMIN_CREDENTIALS_JSON||'null');
    const origens=(process.env.SEDUC_ADMIN_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
    if(!credencial || credencial.project_id!==cliente.firebase.projectId || !origens.length || origens.some(s=>new URL(s).origin!==s || !s.startsWith('https://')))throw new Error('config');
    const app=getApps().find(a=>a.name==='administracao-segura')||initializeApp({credential:cert(credencial),projectId:cliente.firebase.projectId},'administracao-segura');
    handler=criarHandler({db:getFirestore(app),auth:getAuth(app),origens});
  } catch { res.setHeader('Cache-Control','no-store');return res.status(503).json({erro:'Administração do Authentication ainda não configurada no servidor.'}); }
  return handler(req,res);
};
