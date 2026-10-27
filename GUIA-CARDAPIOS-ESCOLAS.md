# Cardápios oficiais vinculados a escolas

## Situação da entrega

O código acrescenta PDF oficial e múltiplos vínculos ao cadastro existente em `conteudos`/`publicacoes`, sem migrar ou trocar IDs. O editor mensal, o texto legado, a geração de PDF, as imagens e as vistorias continuam disponíveis.

**Nenhuma publicação, escola ou PDF foi cadastrado no Firebase/B2 de produção nesta execução.** Não havia conta autenticada no Firebase local; os registros reais das duas escolas não puderam ser consultados. O teste do documento anexado usou Firestore emulado e armazenamento B2 simulado. O código não cria vínculos usando nomes como IDs.

## Onde usar

- Master e Nutrição: `/administracao/cardapios`, menu **Gerenciar cardápios**.
- No editor genérico, selecionar o tipo Cardápio abre o mesmo gerenciador.
- Visitantes: `/merenda-escolar`, sem login.

### Publicar o exemplo de Outubro de 2026

1. Confira os cadastros em Escolas da Rede Municipal. As unidades devem existir no Firestore com seus IDs reais. Se necessário, execute a importação das 43 escolas no módulo existente.
2. Autorize a publicação dos nomes de **E. M. Vovó Inácia** e **E. de E. Infantil Maria de Lurdes Viana dos Santos**; ambas devem estar ativas. Não é necessário preencher outros dados.
3. Em Novo cardápio, clique em **Preparar exemplo de Outubro/2026**. A prévia resolve os dois IDs por correspondência exata no cadastro carregado. Se faltar uma unidade ou houver nomes duplicados, o sistema pede conferência em vez de escolher arbitrariamente.
4. Confira a diferença entre o arquivo (“Maria de Lourdes Viana”) e o cadastro (“Maria de Lurdes Viana dos Santos”). O cadastro não é renomeado.
5. Selecione o PDF original anexado, de duas páginas e 484.026 bytes. A aplicação preserva os bytes e rejeita PDFs inválidos, criptografados ou com conteúdo ativo. Limite atual: 2 MB, conforme a infraestrutura existente.
6. Use Visualizar PDF original, confira as duas escolas, Outubro/2026, Educação Infantil, Parcial e PNAE. Nenhum alimento é extraído automaticamente.
7. Salve como rascunho ou marque a conferência e publique.
8. Na página pública, consulte cada escola em Outubro/2026; o mesmo arquivo deverá estar disponível para ambas. Outra escola ou outro mês não deverá exibi-lo.

## Modelo e compatibilidade

- `escolas/{id}`: cadastro oficial administrativo, escutado em tempo real; basta o nome. O depósito municipal não aparece como escola.
- `escolasPublicas/{id}`: autorização de exposição pública; não é criada implicitamente por publicar um cardápio.
- `conteudos/{id}`: rascunho versionado. Mantém `tipo: cardapio`, `numero: AAAA-MM` e `escolaId` para compatibilidade; acrescenta `escolaIds`, `etapa`, `turno`, `programa`, `observacoes`, `arquivoId`, `arquivoNome` e URL pública calculada.
- `publicacoes/{mesmoId}`: versão conferida pelo administrador; rascunhos posteriores não a alteram.
- Formatos anteriores com `escolaId` individual continuam sendo lidos. A próxima gravação utiliza os mesmos IDs dos registros existentes.
- `cardapiosArquivos/{arquivoId}`: referência privada do PDF no B2, versão, SHA-256, tamanho e autoria. Nenhum PDF é salvo no Firestore ou em arquivos permanentes da Vercel.
- `cardapiosControle/publicacao`: serialização de publicações concorrentes.
- `auditoriaRegistros`: envio, edição, publicação, substituição de vínculos e retirada com ator, horário e estados.
- Um PDF pode atender várias escolas e publicações. Substituições e retiradas não apagam objetos do B2.

## Conflitos, cópias e revisão

A faixa de conflito é escola + mês + etapa + turno (comparação de texto sem variação de maiúsculas/acentos). Etapas ou turnos com nomenclaturas diferentes, como abreviações antigas, precisam de revisão administrativa para padronização; não são renomeados automaticamente.

A API verifica todos os cardápios publicados na transação, incluindo vínculos antigos. Em caso de conflito, a tela oferece revisão, cancelamento ou substituição explícita. Ao substituir, apenas os vínculos conflitantes são removidos; as outras unidades continuam com o documento anterior. Rascunhos das publicações substituídas preservam seus demais campos e recebem nova versão.

Duplicar para outro mês cria uma edição ainda não salva; exige revisão antes de publicar. O PDF permanece o original e pode conter o mês anterior: revise/substitua. A grade diária é reiniciada para não copiar refeições para datas diferentes sem conferência.

## Ativação necessária no Firebase

Em uma máquina autenticada e autorizada no projeto `recallapp-14074`:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project recallapp-14074
```

As regras novas bloqueiam escrita direta de cardápios pelo SDK do navegador, mesmo por Master/Nutrição: a escrita passa pela API, que confere permissões, versões, escolas, arquivos e conflitos. A leitura dos registros anteriores continua disponível. Não é necessário dar acesso público a `escolas`, `conteudos` ou `cardapiosArquivos`.

**Enquanto as regras não forem publicadas, clientes antigos ainda podem usar as permissões antigas de escrita, sem a nova proteção centralizada de conflitos.** Os arquivos de regras/índices no GitHub não significam que a configuração foi aplicada no Firebase.

O índice adicionado é `auditoriaRegistros: caminho ASC, timestamp DESC`, para as últimas 100 alterações de cada cardápio. Aguarde a conclusão da criação do índice antes de consultar o histórico em produção.

## Configuração do servidor / B2

A nova função `/api/cardapios` reutiliza as variáveis já utilizadas pelos PDFs oficiais de editais:

- `SEDUC_CLIENTE=pedro-ii`
- `SEDUC_ADMIN_CREDENTIALS_JSON` (credencial do projeto correto, somente no servidor)
- `SEDUC_ADMIN_ORIGINS` incluindo `https://www.semedpii.com.br` e demais origens administrativas realmente utilizadas
- `B2_ENDPOINT`, `B2_REGION`, `B2_BUCKET`, `B2_KEY_ID`, `B2_APPLICATION_KEY`

O bucket deve continuar privado e a chave permitir envio, leitura e consulta de ACL, como na integração atual. Não é necessário tornar o bucket público nem configurar CORS de upload direto: a API encaminha os bytes ao B2. A função também entrega o arquivo ao visitante após conferir publicação e escola autorizada. As chaves e versões privadas nunca entram na projeção pública.

Acesso real ao bucket não foi testado com credenciais nesta execução. A verificação de configuração da função após implantação não equivale a um teste de envio/leitura no B2.

Desenvolvimento local: `npm run api:cardapios` (porta 3003) junto com `npm run dev`; o proxy foi acrescentado sem alterar os de editais e alimentação.

## Verificações executadas

- 19 testes de unidade/regressão: vínculos individuais e múltiplos, período/etapa/turno, correspondência dos nomes, editor mensal e cadastro/importação de escolas.
- 16 testes com Firestore emulado: API e concorrência, PDF original, substituição parcial, rascunho/retirada/auditoria, versões antigas, editor estruturado, permissões e regras de escolas.
- Navegador em 320, 390 e 1280 px, com serviços simulados: seleção das duas unidades reais da fixture, um envio do PDF original, SHA-256 do envio, consulta de cada escola, exclusão da terceira, troca de mês, download e ausência de transbordamento horizontal.
- ESLint dos arquivos alterados e build de produção de Pedro II.

Os testes de produção dependentes de autenticação e escrita ainda devem ser feitos após a ativação: publicar o PDF com os IDs reais, abrir por cada escola, baixar e conferir o documento. Não há confirmação de publicação do conteúdo do PDF no banco real nesta entrega.

## Arquivos alterados

- `api/cardapios.js`
- `server/cardapios/handler.cjs`
- `server/alimentacao/handler.cjs`
- `shared/cardapios.mjs`
- `src/services/cardapiosApi.js`
- `src/views/admin/CardapiosAdmin.vue`
- `src/views/admin/ConteudosAdmin.vue`
- `src/views/admin/AdminLayout.vue`
- `src/views/portal/MerendaPublica.vue`
- `src/views/portal/PublicacaoView.vue`
- `src/portal/editorial.js`
- `src/portal/downloads.js`
- `src/router/index.js`
- `firebase/firestore.rules`
- `firebase/firestore.indexes.json`
- `vercel.json`
- `vite.config.mjs`
- `package.json`
- `scripts/cardapios-local.cjs`
- `tests/cardapios/modelo.test.mjs`
- `tests/cardapios/servidor.test.cjs`
- `tests/cardapios/interface.mjs`
- `tests/cardapio-regras.test.cjs`
- `GUIA-CARDAPIOS-ESCOLAS.md`
