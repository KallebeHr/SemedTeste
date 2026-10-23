# Alimentação Escolar — publicação e operação

Atualização da base enviada em Seduc(4).zip, em 28/09/2026.

## O que foi entregue

O sistema existente foi mantido. As duas ações principais estão no início do painel de Alimentação Escolar. O fluxo Depósito → Escola usa a mesma coleção de estoque já utilizada pelas demais telas. Vistorias, cardápios, OCR, documentos, catálogo, auditoria e relatórios permanecem disponíveis.

**A publicação ainda precisa ser realizada na sua Vercel, com as variáveis privadas e as regras/índices do Firebase. Não foi feito deploy nem upload em seu bucket real nesta execução.** Os testes descritos adiante usam ambiente isolado. Um build aprovado não comprova que credenciais, domínio ou bucket de produção estejam configurados.

## 1. Diagnóstico da base recebida

- `src/services/alimentacaoApi.js` já chamava `/api/alimentacao/documentos`, no próprio domínio.
- `vite.config.mjs` encaminha essa rota a `127.0.0.1:3001` **somente no servidor de desenvolvimento**. Não existe URL localhost embutida como destino dos uploads de produção.
- `api/alimentacao/documentos.js` já era uma Vercel Function, usando `server/alimentacao/handler.cjs` e `b2.cjs`. Não era necessário criar uma API paralela. É necessário publicar o projeto completo, não apenas a pasta `dist`, e configurar o ambiente do servidor.
- Não é possível atribuir o problema da implantação real a uma única causa sem inspecionar as configurações e os logs dessa implantação. As variáveis, os arquivos empacotados e o domínio autorizado são os primeiros pontos a conferir.
- `vercel.json` bloqueava `camera` pela Permissions-Policy. Agora permite `camera=(self)`. A captura via seletor nativo de arquivo e `capture=environment` depende também do navegador/dispositivo.
- A antiga retirada apenas anotava o destino no texto da movimentação. Não havia uma transação de transferência com confirmação pela escola.
- As regras existentes só permitem gestão no estoque do depósito. Diretor atua nas escolas vinculadas. O papel `alimentador` é editorial; não ganhou acesso financeiro/de estoque automaticamente.
- O depósito já existe em `escolas/deposito-municipal`, diferenciado por `tipoUnidade: deposito`. Esse identificador foi preservado para evitar migração destrutiva; não foi criado outro cadastro de depósito ou escola fictícia.

## 2. Arquitetura

Navegador → Firebase Auth → endpoint HTTPS no mesmo domínio → validação do token e perfil Firestore → B2 privado / transação Firestore.

- **B2:** bytes, objeto privado e versão do arquivo.
- **Firestore:** metadados, estado do upload, referências, entrega, quantidades, responsáveis e auditoria.
- **Servidor:** valida o token Firebase com verificação de revogação, consulta o perfil real e revalida permissões dentro das transações.
- **Frontend:** nunca recebe Application Key, credencial administrativa ou URL pública do bucket.
- **Upload:** um arquivo por requisição, máximo 2 MiB depois da preparação; evita ultrapassar o limite de payload das Functions com base64. Até seis anexos por confirmação, até vinte produtos por entrega.
- Imagens JPEG/PNG/WEBP são reencodificadas no navegador em JPEG de até 1800 pixels no maior lado, qualidade 82%. PDF não é comprimido e precisa ter até 2 MiB. O servidor verifica conteúdo, MIME, extensão e tamanho; não confia somente no nome.
- OCR é independente e continua na área de documentos. Não bloqueia envio de comprovantes.

## 3. Preparar o projeto

1. Faça uma cópia do seu projeto atual e um backup dos dados antes de publicar.
2. Extraia este ZIP. Ele contém o código completo, mas não `node_modules`, `.git`, `dist` ou `.env.server`.
3. Use Node.js 22.12 ou superior compatível com as dependências.
4. Na pasta que contém `package.json`, execute:

```powershell
npm ci
npm run build -- --cliente pedro-ii
```

A configuração pública do Firebase continua em `clientes/pedro-ii.json`. Confira se é o mesmo projeto das credenciais privadas. Não coloque conta de serviço nesse JSON público.

## 4. Configurar Backblaze B2

Use o bucket privado existente. Se precisar criar outro, crie um bucket privado, na região escolhida, e uma Application Key restrita a esse bucket com leitura de arquivos, escrita e leitura da configuração/ACL do bucket. O servidor consulta `GetBucketAcl`, `PutObject` e `GetObject`.

Não configure uma política de exclusão automática que remova as versões referenciadas pelos documentos oficiais. A versão do objeto é usada no download e na verificação de integridade.

Copie para a Vercel os valores indicados abaixo. O endpoint deve ser o endpoint S3 da região do seu bucket, por exemplo no formato `https://s3.REGIAO.backblazeb2.com`; não use a URL de download ou a URL do painel.

Como todo tráfego do B2 acontece no servidor, este fluxo não depende de CORS de upload direto do navegador para o bucket.

## 5. Variáveis na Vercel

Abra seu projeto → Settings → Environment Variables. Use os nomes exatos:

| Variável | Conteúdo |
| --- | --- |
| `SEDUC_CLIENTE` | `pedro-ii` |
| `SEDUC_ADMIN_CREDENTIALS_JSON` | JSON completo da conta de serviço Firebase, em uma variável privada. O `project_id` deve corresponder a `clientes/pedro-ii.json`. |
| `SEDUC_ADMIN_ORIGINS` | Origens HTTPS exatas, separadas por vírgula, sem barra final: domínio principal e eventuais domínios autorizados. |
| `B2_ENDPOINT` | Endpoint S3 regional do bucket. |
| `B2_REGION` | Região que aparece nesse endpoint. |
| `B2_BUCKET` | Nome do bucket privado. |
| `B2_KEY_ID` | ID da Application Key. |
| `B2_APPLICATION_KEY` | Segredo da Application Key. |

Esta implementação usa a API S3: **não exige `B2_BUCKET_ID`** e usa `B2_BUCKET`, não `B2_BUCKET_NAME`.

O modelo sem segredos está em `.env.alimentacao.example`.

Selecione Production para a implantação real. Preview deve ter configuração própria e domínio de Preview autorizado explicitamente. Preferencialmente use projeto Firebase e bucket separados para homologação. Não autorize `*` e não copie segredos para variáveis `VITE_`.

Após mudar variáveis, faça um novo deployment. A configuração é inicializada na instância da Function, não atualizada pelo navegador.

## 6. Publicar regras e índices Firestore

No Firebase CLI autenticado com sua conta administrativa, publique as regras e os índices. Substitua `SEU_PROJECT_ID` pelo ID já conferido em `clientes/pedro-ii.json`:

```powershell
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project SEU_PROJECT_ID
```

Aguarde os índices ficarem prontos no Firebase Console. Os índices de grupo `entregas` permitem o histórico de todas as escolas e os indicadores do depósito. O emulador não comprova disponibilidade de índices na nuvem.

Não altere regras para `allow read, write: if true`. As entregas e as identificações são escritas exclusivamente pela API. CPF completo fica na subcoleção de identificação, com leitura restrita à gestão e ao autor dentro da escola autorizada.

## 7. Publicar na Vercel

1. Atualize o repositório conectado ao projeto Vercel ou use o fluxo de publicação que você já utiliza.
2. A raiz selecionada precisa conter `package.json`, `api`, `server`, `scripts`, `shared`, `clientes` e `vercel.json`.
3. Build: `npm run build -- --cliente pedro-ii`.
4. Diretório de saída: `dist`.
5. Mantenha a Function em runtime Node, não Edge. As dependências Firebase Admin, AWS SDK e Sharp são usadas no servidor.
6. Confira se o deployment inclui `/api/alimentacao/documentos`.
7. A regra de SPA já exclui `/api/`; não redirecione respostas da API para `index.html`.
8. Em Firebase Authentication, confira os domínios autorizados para o domínio do site.

**Não publique apenas os arquivos de `dist` em uma hospedagem estática. Isso omite a Function.** A produção não usa `npm run api:alimentacao` nem depende do seu computador ligado.

## 8. Primeiro teste em produção

Faça primeiro em homologação, com uma escola e produtos de teste autorizados.

1. Entre como gestão e abra Alimentação Escolar → Entregas e recebimentos.
2. Use **Testar API e Backblaze B2**. O resultado comprova autenticação e leitura da ACL do bucket privado; ainda não comprova escrita e leitura de um arquivo real.
3. Envie um pequeno documento pela área Documentos, confirme o estado e baixe-o. Confira a mesma operação no celular, pelo domínio HTTPS publicado.
4. Cadastre/ative o depósito pelo botão existente se necessário; confira o estoque inicial.
5. Registre Alimentação Enviada: escola, produtos, quantidades, identificação e fotos.
6. Confira a baixa e o código `AE` no histórico. Não lance novamente a saída na tela antiga.
7. Entre como diretor vinculado à escola, abra Alimentação Recebida e confirme uma entrega.
8. Confira a entrada na escola, o código `AR`, os comprovantes e o histórico. Não registre outra entrada manual para os mesmos produtos.
9. Teste desligar seu computador e repetir pelo celular. O domínio publicado deve continuar funcionando.
10. Teste recarregar o histórico após uma interrupção de rede antes de iniciar uma nova operação.

## 9. Operação diária e estados

| Operação | Depósito | Escola | Estado |
| --- | --- | --- | --- |
| Confirmar envio | Diminui uma única vez | Não muda | `enviado` |
| Confirmar recebimento | Não muda novamente | Soma a quantidade aceita | `recebido` |
| Cancelar antes do recebimento | Estorna uma única vez | Não muda | `cancelado` |
| Encerrar divergência | Não muda | Não muda | Divergência `resolvida` |

- Envio, saldo, registro por produto e auditoria são confirmados juntos em uma transação.
- Recebimento e cancelamento disputando a mesma entrega não podem ambos efetivar: o Firestore reexecuta a transação concorrente e o estado é conferido novamente.
- Uma entrega recebida não é apagada ou cancelada. Correções posteriores usam lançamentos corretivos rastreáveis pela gestão.
- Na divergência, informe somente a quantidade aceita para entrar no estoque. Produtos danificados/rejeitados não devem ser somados como utilizáveis. A diferença permanece registrada e não volta automaticamente ao depósito.
- Quantidade maior que a enviada deve ser tratada em operação separada pela gestão, não escondida na conferência.
- Escolha um item existente compatível por nome, unidade, lote e validade ou um item separado. O padrão reutiliza `transf-ID_DO_ITEM_ORIGEM`; lotes/validades diferentes exigem item separado para não misturar estoques.
- O resumo conta envios do dia em São Paulo, pendências e divergências abertas da unidade consultada. Não soma quilogramas e unidades em um indicador sem significado.
- A entrada de fornecedores no depósito continua no fluxo existente de Entrada / Saída; há um atalho no painel de recebimentos. Essa operação local não representa transferência entre escolas.

## 10. Histórico e comprovantes

O histórico tem filtro por escola, status, período, divergências e busca textual por código, produto e responsáveis. Retorna até vinte resultados por página, examinando no máximo cem registros por requisição. Em consultas seletivas pode haver uma página vazia com botão para continuar; isso evita baixar toda a base de uma só vez. Fotos são carregadas somente ao solicitar o comprovante.

Abra Ver detalhes para ver envio, recebimento, produtos, quantidades, responsáveis, observações e anexos. Use Imprimir / salvar comprovante em PDF para impressão pelo navegador. O comprovante não publica CPF completo nem URLs públicas de arquivos. Não é uma assinatura digital ICP-Brasil: mantém o mecanismo de identificação por nome/CPF do sistema.

## 11. Endpoints e dados

Foi preservado um único endpoint autenticado: `POST /api/alimentacao/documentos`, com JSON, `Origin` autorizado e `Authorization: Bearer <Firebase ID token>`.

| Ação | Função |
| --- | --- |
| `status` | Diagnóstico administrativo da API e ACL do bucket |
| `enviar` / `baixar` | Upload validado / download autenticado e verificação SHA-256 |
| `arquivar` | Arquiva documento livre; anexos oficiais vinculados são protegidos |
| `vincular` | Associação aos registros já suportados pelo sistema |
| `enviarEntrega` | Saída transacional do depósito e entrega pendente |
| `receberEntrega` | Entrada transacional na escola e divergências |
| `cancelarEntrega` | Cancelamento com estorno antes de receber |
| `resolverDivergencia` | Registro da providência, sem alterar saldo |
| `listarEntregas` / `detalharEntrega` | Histórico paginado / registro completo |
| `resumoEntregas` | Contagens reais da unidade |
| `salvarVisita` / `acompanharVisita` | Protocolos AF preservados |

As fotos de uma entrega são enviadas previamente com `escolaId` igual à escola de destino; os IDs são passados em `fotos`. A transação confere que todos estão prontos, não arquivados, sem outro vínculo e pertencem ao usuário. Um arquivo não pode ser reutilizado para duas confirmações.

| Caminho | Conteúdo |
| --- | --- |
| `escolas/{id}/estoque/{itemId}` | Estoque já existente |
| `escolas/{id}/movimentacoes/{id}` | Lançamentos por produto, também nas telas antigas |
| `escolas/{destino}/entregas/{UUID}` | Registro canônico da transferência |
| `escolas/{destino}/entregaIdentificacoes/{UUID}-enviar ou -receber` | Nome/CPF e autor; leitura restrita |
| `escolas/{id}/documentos/{UUID}` | Metadados, `key`, `versionId`, MIME, SHA-256 e estado do upload |
| `auditoriaRegistros/{id}` | Antes/depois, usuário, domínio e timestamp |
| `contadoresAlimentacao/{ano}` | Sequência amigável anual, escrita somente no servidor |
| `limitesAlimentacao/{uid}` | Controle de frequência e volume |

O objeto B2 mantém a organização já existente `{clienteId}/{escolaId}/{UUID}.{extensao}`. O ID interno da entrega é UUID; o código sequencial é apenas apresentação. `AR` usa a mesma sequência do envio correspondente. Não se usa código amigável como autorização.

## 12. Falhas parciais e recuperação

- Foto falha: formulário e identificadores permanecem na tela; nenhum estoque é alterado. Repetir tenta os anexos ainda não confirmados.
- Upload termina e a confirmação Firestore falha: o registro do arquivo permanece `falhou` ou `enviando`, com chave conhecida. A repetição usa a mesma chave e confirma a versão retornada. `enviando` tem janela de dois minutos para evitar envios sobrepostos.
- Uma versão anterior do objeto pode permanecer no B2 se a resposta de upload ou a confirmação dos metadados se perder. Não há limpeza automática destrutiva de versões: o administrador deve reconciliar objetos livres usando os metadados e o histórico de versões. Esta atualização não implementa um coletor automático de versões órfãs.
- Arquivos enviados antes de uma operação abandonada permanecem na área Documentos, sem vínculo; podem ser arquivados administrativamente. Não desaparecem silenciosamente.
- Firestore falha na transação de entrega: saldo, entrega e auditoria não são parcialmente confirmados.
- Resposta da entrega se perde: o formulário mantém o mesmo UUID e payload para nova tentativa. O servidor detecta a repetição sem movimentar novamente.
- Após fechar/recarregar o navegador, confira o histórico antes de começar outro envio; o rascunho não é persistido em armazenamento local, para não guardar CPF e comprovantes no dispositivo.

## 13. Desenvolvimento local

Copie `.env.alimentacao.example` para `.env.server` e configure somente no seu computador. Abra dois terminais:

```powershell
npm run api:alimentacao
```

```powershell
npm run dev
```

Para testar pelo celular na mesma rede, use o endereço mostrado pelo Vite e adicione a origem exata na variável **local** `SEDUC_LOCAL_ORIGINS`, por exemplo `http://192.168.1.20:3000`. Reinicie a API. HTTPS publicado é a referência para validar permissões de câmera; suporte em HTTP local varia por navegador.

Não copie `.env.server` para `public`, `src`, Git ou o ZIP de entrega. Credenciais nunca precisam do prefixo `VITE_`.

## 14. Diagnóstico

| Sintoma | Verificação |
| --- | --- |
| API retorna HTML | Deployment estático ou rewrite indevido de `/api/` |
| 503 de configuração | Nomes das variáveis, JSON válido, cliente e projeto correspondentes; novo deployment |
| Origem não autorizada | Protocolo e domínio exatos em `SEDUC_ADMIN_ORIGINS`, sem barra final |
| Sessão expirada | Sair e entrar novamente; janela de oito horas e revogações são respeitadas |
| Sem permissão | Papel real em `usuarios/{uid}` e vínculo do diretor com a escola |
| B2 inacessível | Região, endpoint, nome do bucket, ACL privada e capacidades da chave |
| Erro de consulta após publicar | Publicação e conclusão dos índices Firestore |
| Arquivo recusado | MIME, extensão, conteúdo real e limite de 2 MiB após preparação |
| Item de destino incompatível | Nome, unidade, lote ou validade diferem; usar item separado |
| Saldo insuficiente | Outra operação pode ter consumido estoque; atualizar e conferir |

Logs de falhas internas registram tipo/código técnico, sem token, senha ou CPF. Consulte os logs da Function na Vercel para erros de dependências/configuração. Mensagens esperadas de validação são retornadas ao usuário.

## 15. Testes e limites da validação

Comandos adicionados:

```powershell
npm run test:entregas
npm run test:entregas:emulador
npm run test:entregas:interface
```

O segundo comando exige Java 21 ou superior para a versão do Firebase CLI do projeto. O terceiro usa Chromium instalado pelo Playwright (`npx playwright install chromium`) ou caminho explícito em `CHROMIUM_EXECUTABLE`.

Executado nesta entrega:

- 12 testes de API/domínio, incluindo estoque insuficiente, CPF, anexos, permissões, idempotência, cancelamento, recebimento parcial, MIME falso e falhas B2/Firestore.
- 13 testes já existentes de estoque e cardápio.
- 3 testes com Firestore Emulator: concorrência real, repetição, recebimento parcial, regras de isolamento/identificação, auditoria e disputa entre cancelamento e recebimento.
- 7 testes existentes de regras do depósito.
- Interface em Chromium: 320, 375, 390, 414, 768, 1024 e 1440 pixels; duas fotos, retomada sem reenviar fotos confirmadas, mesmo ID na repetição e recebimento parcial. Serviços simulados exclusivamente no teste de interface.
- Axe: nenhuma violação nas regras WCAG A/AA selecionadas para a tela de envio testada. Isso não certifica acessibilidade de todo o sistema.
- Build de produção e lint dos arquivos alterados.

No ambiente desta execução, a concorrência foi validada com Firestore Emulator 1.19.8 e Java 17, iniciado diretamente, pois o CLI atual exige Java 21. O teste padrão entregue usa o CLI do projeto. O emulador não valida IAM, limites do plano, índices publicados ou a configuração da Vercel.

**Pendente de homologação real:** câmera física Android/iOS, permissões específicas desses navegadores, upload/download no seu bucket, domínio Vercel, interrupção real de rede móvel e testes de credenciais de produção. Não foram usados dados reais de alunos ou operações reais de estoque nos testes.

Avisos de build preexistentes: bundle Firebase acima de 500 kB e importação de `useAuth` simultaneamente estática/dinâmica. Não impediram a compilação.

## 16. Arquivos principais alterados

- `server/alimentacao/entregas.cjs`: regras de negócio, consultas, transações e identificação.
- `server/alimentacao/handler.cjs` e `b2.cjs`: integração, WEBP, diagnóstico e proteção de arquivos vinculados.
- `src/components/alimentacao/EntregaForm.vue`, `EntregasPainel.vue`, `FotosEntrega.vue`: fluxo e apresentação.
- `src/services/fotosEntrega.js` e `alimentacaoApi.js`: preparação, upload e erros.
- `src/views/PainelEscolaView.vue`: ações principais e nova seção integrada.
- `src/components/documentos/DocumentosUnidade.vue`: preservação de comprovantes oficiais.
- `src/composables/useBackup.js`: inclusão das subcoleções de entrega e identificação.
- `firebase/firestore.rules` e `firestore.indexes.json`: isolamento, somente servidor e índices.
- `vercel.json`: permissão de câmera no próprio domínio.
- `scripts/alimentacao-local.cjs`: origens adicionais explícitas para teste local.
- `.gitignore`, `package.json`, testes e este guia.

O backup administrativo completo existente percorre coleções; ele é o indicado para recuperação integral, incluindo contadores. O backup por escola inclui agora entregas e identificações, mas os bytes B2 continuam exigindo a rotina própria de backup de arquivos existente.

## Referências técnicas consultadas

- https://vercel.com/docs/functions/limitations — payload da Function limitado a 4,5 MB.
- https://www.backblaze.com/docs/en/cloud-storage-call-the-s3-compatible-api — endpoint S3 regional.
- https://www.backblaze.com/apidocs/s3-get-object — leitura por versão do objeto.
