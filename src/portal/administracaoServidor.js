import { auth } from '../firebase';
import { useAuth } from '../composables/useAuth';
export async function administrarConta(acao,uid,operacaoId=crypto.randomUUID()) {
  const {exigirUsuario,pode}=useAuth();exigirUsuario();
  if(!pode('usuarios') || !auth.currentUser)throw new Error('Somente o Master gerencia contas.');
  const token=await auth.currentUser.getIdToken();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try {
    const r=await fetch('/api/admin/usuarios',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({acao,uid,operacaoId}),signal:controller.signal});
    if(!r.headers.get('content-type')?.includes('application/json'))throw new Error('O endpoint administrativo não está disponível neste ambiente.');
    const d=await r.json();if(!r.ok)throw new Error(d.erro||'Operação não confirmada.');return d;
  } catch(e){if(e.name==='AbortError')throw new Error('O servidor não respondeu no prazo. Confira o histórico antes de repetir.');throw e;} finally{clearTimeout(timer);}
}
