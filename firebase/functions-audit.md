# Auditoria nesta versão

Não existe implantação de Cloud Functions neste pacote. A auditoria do aplicativo é escrita junto às operações por transações no Firestore. `auditoria` registra alimentação; `auditoriaPortal` registra publicações, acessos e serviços escolares. As regras impedem edição e exclusão desses eventos pelo aplicativo.

A trilha registra as operações implementadas no cliente e não substitui logs independentes do provedor. Acesso pelo Console/Admin SDK segue as permissões IAM, não as regras do aplicativo. Consulte `../GUIA-PORTAL.md` antes de implantar qualquer infraestrutura adicional.
