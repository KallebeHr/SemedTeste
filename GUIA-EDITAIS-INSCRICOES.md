# Editais e inscrições — envio direto ao Firebase

## O que mudou

O participante preenche somente os dados e aceita a declaração. Não há upload de arquivos, assinatura anexada ou conexão do participante com B2/API Vercel.

Inscrições, consultas do Master, contagens, pesquisa e confirmação usam diretamente o Firestore. A ficha PDF é gerada no navegador com o brasão e cabeçalho original. O administrador continua enviando o PDF oficial pelo editor de conteúdo; somente esse arquivo utiliza a API Vercel/B2 existente.

A atualização está na branch `feat/editais-inscricoes-online`, PR #3. Não publica regras nem altera produção automaticamente.

## Ativação necessária (uma vez)

1. No Firebase do projeto correspondente ao build, habilite **Authentication → Sign-in method → Anonymous (Anônimo)**. O participante não precisa criar conta, digitar senha ou fazer login: a sessão técnica é criada automaticamente, em instância separada que não desconecta o Master.
2. Publique as regras e índices deste repositório. Em terminal já autenticado no projeto correto:

```sh
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project recallapp-14074
```

O comando modifica o projeto real; execute após revisar o PR. Aguarde a criação dos índices. Não substitua as regras por acesso público irrestrito.

3. Abra o deploy atualizado. Como Master, salve um conteúdo do tipo Edital como rascunho, reabra e salve as configurações de inscrições. Configurações antigas precisam ser salvas novamente para adotar o modo de texto e os horários usados pelas regras.
4. Publique o edital e ative as inscrições quando as orientações institucionais estiverem conferidas. Não foram inventados categorias ou prazos a partir do Anexo II incompleto.

Não é necessário configurar variáveis B2 ou Firebase Admin na Vercel para preencher, enviar, consultar ou confirmar inscrições. O aviso antigo de armazenamento não bloqueia mais essas operações.

## PDF oficial enviado pelo Master

Em Administração → Conteúdos → Edital, salve a configuração e use **Enviar ou substituir PDF oficial (até 2 MB)**. O botão **Baixar Edital PDF Completo** aparece na publicação quando o upload foi confirmado.

Este recurso mantém a API `/api/editais` e as variáveis de servidor existentes: `SEDUC_CLIENTE`, `SEDUC_ADMIN_ORIGINS`, `SEDUC_ADMIN_CREDENTIALS_JSON`, `B2_ENDPOINT`, `B2_REGION`, `B2_BUCKET`, `B2_KEY_ID`, `B2_APPLICATION_KEY`. A origem exata da prévia/produção deve estar na lista HTTPS; não use localhost na configuração desse deploy. Após alterar variáveis, gere novo deploy.

Se o PDF falhar, a tela informa separadamente; as inscrições continuam independentes. Não coloque PDF/base64 em documentos Firestore. O B2 continua privado, e o PDF só é servido para edital publicado. Envie o regulamento completo: o documento de referência recebido contém apenas o Anexo II.

## Participante

Quatro etapas: identificação, síntese, declaração e revisão. Após confirmação do Firestore, apresenta protocolo, data e download da ficha. O sucesso não depende de escrita local pendente.

Cada sessão anônima pode registrar uma ficha por edital. Repetir o mesmo envio recupera o comprovante; dados diferentes após o envio são recusados. Isso evita duplicação por falha de rede, mas não verifica identidade pessoal.

Dados ainda não enviados ficam na memória da página. Não feche/recarregue durante o preenchimento. Em falha de rede, repita na mesma página. Guarde o comprovante antes de clicar **Encerrar sessão / nova inscrição**, especialmente em computador compartilhado. Esse botão encerra a sessão anônima e permite outro participante sem afetar o login administrativo.

Assinaturas/ciências em branco continuam na ficha para impressão. O aceite eletrônico não é apresentado como assinatura digital.

## Master

O menu **Editais e Inscrições** lê o Firestore diretamente, com totais agregados, editais em grupos de 50 e inscrições em grupos de 25. A busca usa início do nome/escola/título, respeitando maiúsculas e acentos, ou protocolo completo exato. Não baixa todas as fichas para filtrar.

O Master abre detalhes, imprime/baixa a ficha e confirma recebimento. A confirmação não classifica a prática nem aprova prêmio. Os dados originais permanecem imutáveis; a confirmação exige auditoria atômica com estados anterior/posterior.

## Regras e estrutura

- `editaisConfiguracao/{editalId}`: leitura pública somente para edital publicado; edição exclusiva do Master com auditoria. Datas `inicioEm`/`fimEm` são timestamps comparados ao horário do servidor.
- `editaisRespostas/{editalId}/inscricoesTexto/{uid}`: ficha privada, protocolo, versão da configuração, declaração e horários do servidor.
- A sessão proprietária obtém apenas a própria ficha por ID; não lista, altera ou exclui inscrições.
- O Master lista e confirma; demais perfis não recebem acesso.
- Regras validam campos obrigatórios, tamanhos, tipos, categoria, aceite, protocolo, prazo, publicação e manutenção; rejeitam campos inesperados.
- Configuração e confirmação usam a infraestrutura existente de `auditoriaRegistros`.
- A API antiga rejeita ações de inscrições: aceita apenas upload autenticado do PDF oficial e download desse PDF para edital publicado. Registros antigos de `editaisInscricoes` permanecem fechados ao cliente e não são migrados automaticamente.

Modelo personalizado: até 15 campos de até 2.000 caracteres. Anexo II: até 20.000 caracteres por campo de síntese. Não há truncamento silencioso.

O fluxo direto não tem os antigos limites por IP do servidor. Autenticação anônima e regras restringem acesso, mas não impedem várias sessões. Se App Check já estiver configurado, a instância de inscrições também o inicializa. Validar a configuração antes de exigir enforcement; monitorar quotas do Firebase.

Incluir `editaisRespostas` com subcoleções no plano de backup/restauração e definir retenção institucional. O script legado `backup:b2` não cobre o PDF deste módulo; manter cópia do edital oficial. Nenhum dado real foi criado pelos testes.

## Validação

```sh
npm ci
npm run test:editais
npm run test:editais:direto
npm run build -- --cliente pedro-ii
```

O emulador atual exige Java 21. Os testes diretos usam exclusivamente `demo-seduc-direto`, o mesmo código de envio do navegador e as regras reais do Firestore Emulator. Cobrem envio, repetição, acesso cruzado, adulteração de campos/protocolo/data, prazos, manutenção, configuração, consulta, confirmação auditada e modelo personalizado.

Para desenvolver sem B2: iniciar emuladores Auth/Firestore no projeto `demo-seduc` e Vite com `VITE_FIREBASE_EMULATORS=true`. No PowerShell: `$env:VITE_FIREBASE_EMULATORS='true'; npm run dev`. A API local só é necessária para testar PDF oficial.

Antes de publicar no domínio oficial: verificar formulário em celular/desktop, autenticação anônima, índices e upload/download do PDF oficial. Verificação visual completa e B2 real continuam pendentes: o navegador remoto não alcançou o servidor local na verificação anterior. Testes automatizados não equivalem a validação visual completa.
