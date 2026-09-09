import { runTransactionAuditada as runTransaction } from "./auditoria";

import { db } from "../firebase";
import { executarComPrazo } from "../utils/operacaoComPrazo";
export function transacaoConfirmada(executar) {
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return Promise.reject(
      new Error("Você está sem conexão. Reconecte-se antes de salvar."),
    );
  return executarComPrazo(
    (ativa) =>
      runTransaction(db, async (tx) => {
        tx.definirVerificacao(ativa);
        ativa();
        const segura = {
          get: async (r) => {
            ativa();
            const s = await tx.get(r);
            ativa();
            return s;
          },
          set: (...p) => {
            ativa();
            tx.set(...p);
          },
          update: (...p) => {
            ativa();
            tx.update(...p);
          },
          delete: (...p) => {
            ativa();
            tx.delete(...p);
          },
        };
        return executar(segura);
      }),
    {
      codigo: "portal/timeout",
      mensagem:
        "O servidor não confirmou em 45 segundos. Confira a lista de registros antes de repetir. Os campos preenchidos foram preservados.",
    },
  );
}
