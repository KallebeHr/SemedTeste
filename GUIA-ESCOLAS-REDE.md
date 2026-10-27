# Escolas da Rede Municipal

## Estado da importação real

Esta entrega prepara a importação dos 43 nomes exatos informados. Não há credencial Firebase autorizada no ambiente de implementação: **zero escolas cadastradas por esta execução no Firestore real**. A lista de código é uma fonte para a prévia, não confirmação de cadastro. A quantidade de escolas já existentes no projeto real ainda não pôde ser consultada.

## Ativação

1. Atualize a pasta do projeto pela branch `main`.
2. Autentique o Firebase CLI com a conta autorizada e publique as regras:

```
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project recallapp-14074
```

3. Entre como Master em `/administracao/escolas`.
4. Abra **Importar escolas por planilha → Conferir lista inicial das 43 escolas**.
5. Confira os nomes, os cadastros já existentes e eventuais conflitos. Mantenha a atualização de existentes desmarcada para esta carga inicial.
6. Se desejar que os novos nomes apareçam no portal público, marque a autorização explícita **publicar somente nomes das novas escolas**. Sem isso, são cadastros internos.
7. Confirme a importação e confira o relatório de criadas, ignoradas e falhas. A confirmação executa uma consulta nova ao servidor antes de qualquer escrita. Corrija falhas e repita: escolas confirmadas são reconhecidas.

O deploy da Vercel não publica regras de segurança. Testes em emulador não contam como carga no banco real. O resultado exibido após a confirmação é a contagem da operação executada no servidor; conferir a lista atualizada e os registros de auditoria permite verificar os IDs criados.

## Compatibilidade e dados

A fonte interna continua sendo `escolas/{id}`. `escolasPublicas/{id}` é somente a projeção autorizada, com o mesmo identificador. Os seletores existentes de alimentação, estoque, professores e usuários continuam usando o cadastro oficial. Não existe uma segunda lista fixa de seleção: os 43 nomes são usados apenas na importação.

Campos canônicos existentes preservados: `nome`, `inep`, `alunos`, `funcionarios`, `endereco`, `contato` (telefone/contato institucional), `email`, `bairro`, `zona`, `etapas` (modalidades), `horario`, `sobre`, `ativo`. Acrescentados `responsavel`, `turnos`, `latitude`, `longitude`, `observacoes` e `totalPessoasEscola` derivado. Quantidades vazias são `null`; zero é preservado quando informado. O total é `null` até ambos os números existirem.

Os metadados operacionais `ativo`, `versao`, datas e auditoria não são dados fictícios da escola. A criação usa `ativo: true` para permitir a seleção nos módulos. Outros dados desconhecidos ficam ausentes, vazios ou `null`.

Na importação, nomes e INEP reconhecidos preservam o ID existente; colunas ausentes ou células vazias não apagam valores preenchidos. Novas escolas usam um ID determinístico derivado do nome normalizado. Cadastro rápido no estoque, cadastro manual e importação usam a mesma identidade para impedir duplicação na criação concorrente pelo nome. Alterar o nome nunca troca o ID. Duplicidades ou correspondências ambíguas preexistentes precisam de conferência manual; não há mesclagem automática.

Nomes originais são preservados. “E. M. Olho d água dos”, “Outra escola” e a grafia “Infatil” recebem avisos na listagem. Não são corrigidos automaticamente.

## Remoção sem perda

**Remover / arquivar** é sempre uma remoção lógica conservadora, inclusive em escolas aparentemente vazias. As regras continuam proibindo exclusão física. Essa decisão evita depender de uma busca incompleta de vínculos em coleções atuais ou futuras. Escolas arquivadas são inativadas, saem dos seletores ativos e da publicação pública, mas continuam na lista administrativa com o filtro de arquivadas e podem ser reativadas.

Alunos, vistorias, itens de estoque, movimentações, usuários vinculados, anexos e demais subcoleções não são apagados nem migrados. A reativação preserva o mesmo ID e não republica dados automaticamente. Cadastros com usuários vinculados continuam acessíveis conforme as regras de acesso existentes para consulta de históricos.

## Privacidade e auditoria

Nome é o único dado de conteúdo obrigatório. A publicação é opcional e exige autorização por campo. Diretor/responsável, observações internas e quantidades não são enviados à projeção pública. Publicar uma escola com somente nome não cria números fictícios. A projeção antiga é retirada ao desativar ou arquivar; os resumos históricos das vistorias são preservados e ficam indisponíveis à consulta pública sem a ficha da escola.

As transações usam a auditoria existente com autor, horário, caminho e estados anterior/posterior. Cada escola importada é confirmada individualmente, permitindo relatar falhas parciais e repetir a carga. Há controle de versão no editor e nas mudanças de situação. O Master gerencia o painel completo; o cadastro rápido legado de escolas no módulo de estoque mantém seu fluxo autorizado, agora reconhecendo escolas existentes e usando a mesma identidade de importação. Escritas comuns permanecem negadas e as novas regras restringem alterações de campos administrativos ao Master.

## Verificações

```
node --test tests/escolas/cadastro.test.mjs tests/portal/importacao-escolas.test.mjs
firebase emulators:exec --only firestore --project demo-escolas-cadastro "node --test tests/escolas/regras.test.mjs"
npm run build -- --cliente pedro-ii
```

## Arquivos desta implementação

- `GUIA-ESCOLAS-REDE.md`
- `firebase/firestore.rules`
- `shared/importacao-escolas.mjs`
- `src/components/admin/ImportarEscolas.vue`
- `src/composables/useEscolas.js`
- `src/data/escolasRede.mjs`
- `src/portal/permissoes.js`
- `src/router/index.js`
- `src/services/escolasCadastro.js`
- `src/services/importacaoEscolas.js`
- `src/views/admin/AdminLayout.vue`
- `src/views/admin/EscolasAdmin.vue`
- `src/views/portal/EscolasPublicas.vue`
- `tests/escolas/cadastro.test.mjs`
- `tests/escolas/interface.mjs`
- `tests/escolas/regras.test.mjs`

Testes executados: 7 casos de unidade/regressão, 3 casos no emulador de regras e fluxo de interface em 320, 390 e 1280 px com dados simulados. ESLint e build de produção concluídos. Nenhum registro desses testes foi gravado no projeto real.
