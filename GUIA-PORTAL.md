# Portal da Educação de Pedro II

Esta versão integra o portal público, a administração e os serviços escolares ao Firebase existente. A configuração pública em `clientes/pedro-ii.json`, selecionada no build e utilizada por `src/firebase.js`, mantém os valores do projeto enviado. Leia primeiro `OPERACAO-E-RECUPERACAO.md` para atualizar uma instalação da versão anterior. Não há senha padrão nem criação automática de Master.

## Instalação e ativação

1. Guarde uma cópia da versão anterior. Extraia este projeto completo em uma pasta própria, para evitar misturar o roteador antigo com os componentes novos.
2. Use Node.js 22.12 ou superior. Dentro da pasta `Seduc`, execute `npm ci` e `npm run dev`.
3. No Firebase Authentication, mantenha o provedor **E-mail/senha** habilitado. Cadastre o domínio de produção em **Authorized domains** e confira os modelos de confirmação de e-mail e recuperação de senha. Em desenvolvimento, confira também `localhost`.
4. Publique as regras e os índices desta versão no mesmo Firebase configurado no projeto. Pelo terminal autenticado:

   ```sh
   npx firebase login
   npx firebase deploy --only firestore:rules,firestore:indexes --project recallapp-14074
   ```

   Também é possível publicar o conteúdo de `firebase/firestore.rules` na aba **Rules** do Firestore. Os índices estão em `firebase/firestore.indexes.json`. Aguarde a conclusão da criação dos índices. As regras anteriores não reconhecem as novas coleções.
5. Abra `/login` com sua conta atual. O cargo antigo `admin` funciona como **Master**. O cargo antigo `gerente` equivale a **Nutricionista**. Cadastros antigos sem `ativo` continuam ativos.
6. Se não houver Master, um proprietário do projeto deve criar a conta no Authentication e criar **um documento cujo ID seja exatamente o UID** em `usuarios`, com `nome`, `email`, `papel: "master"`, `ativo: true` e `escolasVinculadas: []`. O aplicativo não permite que um visitante conceda acesso a si mesmo.
7. Em **Escolas e publicação**, publique as fichas das escolas que devem aparecer ao público. As escolas já cadastradas internamente não são divulgadas automaticamente. Em **Página inicial e contatos**, preencha os dados oficiais. Em **Conteúdos e serviços**, publique os textos, notícias, calendário e demais informações.
8. Para produção, execute `npm run build -- --cliente pedro-ii`. A pasta de saída é `dist`. O projeto inclui redirecionamento de rotas e cabeçalhos de segurança para Vercel e Firebase Hosting. No Firebase Hosting, o comando de publicação é `npm run publicar -- --cliente pedro-ii --confirmar-projeto recallapp-14074`.

Atualize o aplicativo e as regras como a mesma versão e suspenda lançamentos durante a troca. A proteção nova do estoque exige um vínculo de movimentação que o aplicativo antigo não enviava. Depois da troca, recarregue as abas antigas antes de lançar dados.

Nenhuma regra, índice, conta ou publicação foi alterada no seu Firebase de produção durante a preparação deste arquivo. A ativação acima precisa ser feita pelo proprietário do projeto.

## Acessos e hierarquia

A entrada da equipe é `https://SEU-DOMINIO/login`, seguida de `/administracao`. O painel mostra somente as seções do cargo. O link pode ser copiado em **Usuários e cargos**; ele não autentica ninguém sozinho. O controle efetivo é realizado pelas regras do Firestore e pelo Firebase Authentication.

| Perfil | Atribuições no sistema |
| --- | --- |
| Master | Usuários, cargos, vínculos, escolas, configuração, publicações, alimentação, atendimentos, alunos, notas, auditoria e recuperação completa. |
| Alimentador | Notícias, serviços, páginas, calendário, editais, documentos, biblioteca, transporte, indicadores, contatos, fichas públicas das escolas e atendimento. Não gerencia cargos, CPFs internos, notas ou cardápios técnicos. |
| Nutricionista | Estoque, movimentações, vistorias, cardápios, publicação dos resumos de vistoria, alertas, auditoria da alimentação e backup da alimentação em toda a rede. |
| Diretor(a) | Consulta da alimentação e registro de vistorias nas escolas vinculadas; atendimento de matrícula/transporte dessas escolas; cadastro de alunos e vínculos; consulta de boletins. Não altera notas nem publica cardápios/resumos técnicos. |
| Professor(a) | Consulta dos alunos vinculados e lançamento/edição dos próprios registros de notas e frequência. Não altera vínculos, cargos ou registros de outro professor. |
| Família / cidadão | Conta de atendimento, sem cargo administrativo. Após confirmar o e-mail, envia solicitações e consulta os próprios protocolos e os alunos vinculados pela escola. |
| Visitante | Conteúdos publicados, busca, serviços, escolas, calendário, editais, biblioteca, transporte e Merenda pública. |

O Master cria contas de equipe sem encerrar a própria sessão, ou vincula um UID já existente. Uma falha entre a criação da conta e a gravação do perfil preserva o UID para tentar novamente. A suspensão pelo painel bloqueia as operações administrativas nas regras; a conta do Authentication ainda existe e pode usar os serviços da família. Alterações do e-mail de login e desativação completa da identidade são operações do Firebase Authentication. O Master não consegue suspender ou rebaixar o próprio acesso.

Diretores e professores podem ter até 20 escolas vinculadas. Cada aluno admite até 8 professores nesta versão. Os limites são validados pelo banco; não basta alterar a tela.

## Conteúdo, início e navegação

- **Rascunho:** salva a edição sem mudar a versão pública anterior.
- **Publicar no portal:** exige revisão explícita. Grava a versão pública e o evento de auditoria na mesma transação.
- **Retirar do portal:** preserva o rascunho e remove a publicação.
- **Conflitos de edição:** uma versão impede que duas pessoas sobrescrevam silenciosamente o trabalho uma da outra.
- **Destaque:** marque uma notícia para o hero da página inicial. A ordem de exibição define a prioridade. Sem notícia em destaque, aparece a apresentação institucional e os atalhos úteis.
- **Carta de serviços:** escolha o identificador de um serviço existente ou cadastre um novo, e preencha requisitos, público, documentos, etapas, custos, prazos e canais. Os cartões, a busca e a página `/servico/identificador` usam esses dados. Serviços existentes mantêm seus fluxos; um novo serviço oferece as orientações, um canal/link opcional e acesso ao atendimento.
- **Páginas:** escolha Institucional, Legislação, Planejamento, Transparência, Indicadores, Sistemas, Acesso à informação ou Privacidade.
- **Documentos:** a categoria define a seção institucional. Links aceitam HTTPS ou caminhos internos; o texto pode ser exportado em PDF.
- **Calendário:** usa a data real, permite navegação por mês, consulta por dia, busca, impressão e exportação `.ics`.
- **Editais:** a situação é calculada pelas datas cadastradas. Documento, inscrição ou resultado podem ser disponibilizados pelo link da publicação.
- **Biblioteca e sistemas:** títulos, descrições, textos e links públicos são administrados pelo painel.
- **Transporte:** publique cada rota com horários, localidades, orientações e referência. Solicitações são recebidas pela área de atendimento. Não há rastreamento GPS de veículos.
- **Indicadores:** publique somente números apurados, informando referência, período e fonte. Não há estatísticas municipais fictícias no código.

A busca consulta apenas os serviços e os documentos públicos. Nenhum dado de usuário, atendimento, CPF ou aluno entra no índice de busca. As páginas não renderizam HTML cadastrado, evitando executar marcações ou scripts enviados no conteúdo.

## Merenda pública e gestão interna

- `/merenda-escolar` é pública. Não redireciona para o login.
- `/administracao/merenda` contém estoque, lançamentos, vistorias, histórico, PDFs, auditoria e backup conforme o cargo.
- A ficha pública da escola contém somente nome, endereço, contato público, etapas, horário e apresentação.
- Cadastre o cardápio como conteúdo **Cardápio mensal**, com escola publicada, mês, responsável técnico/CRN e texto por dia/semana/turno. Ele é exibido no portal e gera PDF no navegador. É possível publicar mais de um cardápio no mesmo mês, por exemplo por etapa ou turno.
- Uma vistoria salva continua interna até Master ou Nutricionista usar **Publicar vistorias**. O resumo só aceita data, tipo, resultado, nota e nome do responsável correspondente à identificação de CPF válida do registro original. Publicações antigas precisam de revisão antes de serem reutilizadas. Testemunha, CPF, identificação, fotos e plano interno não são divulgados.
- Vistorias admitem até 8 itens, incluindo itens específicos removíveis. O servidor valida respostas, calcula a nota correspondente e exige plano de ação quando houver não conformidade.
- Nome e CPF continuam substituindo a assinatura desenhada. Há validação de formato e dígitos verificadores, mas isso não comprova que a pessoa é titular do CPF nem constitui assinatura certificada.
- Estoque e movimentação são confirmados juntos. Um saldo não pode ser alterado diretamente sem o movimento correspondente. Reenvios usam o mesmo identificador para não duplicar o lançamento.
- A exportação parcial da alimentação é um JSON baixado localmente. Inclui identificações completas e deve permanecer com a equipe autorizada. A recuperação completa de Firestore e Authentication está em **Recuperação e ambiente**, restrita ao Master, e é executada pelo operador no terminal. Consulte `OPERACAO-E-RECUPERACAO.md`.

Não há novos uploads para Firebase Storage nem dependência de Cloud Functions. Documentos externos devem ter um endereço público existente. Os PDFs de cardápio, publicações, estoque, histórico e boletins são gerados localmente. URLs antigas de assinaturas continuam sendo registros legados; não há conversão automática de imagens antigas para CPF. Se um bucket antigo estiver ativo, o arquivo `firebase/storage.rules` permite apenas leitura autorizada dos caminhos legados e bloqueia novos uploads. Sua publicação é opcional e separada (`npx firebase deploy --only storage --project recallapp-14074`); não ative Storage apenas para este portal. Regras não revogam URLs de download com tokens já compartilhados. Os testes automatizados desta entrega cobrem Firestore, não o bucket legado.

## Matrícula, atendimento e boletim

1. A família cria uma conta de atendimento e confirma o e-mail. Essa conta não recebe cargo de equipe.
2. Em `/atendimento`, envia matrícula, transporte, manifestação ou pedido de informação. O pedido recebe protocolo e aparece apenas na conta do solicitante e para a equipe autorizada.
3. O banco exige um intervalo mínimo de 60 segundos entre novos pedidos de uma mesma conta. O e-mail e o titular não podem ser forjados pelo formulário.
4. A equipe registra andamento e resposta. A família acompanha em tempo real, sem depender de disparos de e-mail para cada mudança.
5. Matrícula é um fluxo de **solicitação e análise**. O envio não reserva vaga. Após a análise, a direção/Master cadastra o aluno e os vínculos; não há integração presumida com um sistema estadual ou federal não fornecido.
6. A família informa à escola o UID mostrado na conta de atendimento. A escola confere o vínculo documental antes de associar a conta ao aluno.
7. Master/Diretor cadastra o aluno, a turma, o ano e os professores. Professor lança componente, bimestre, nota de 0 a 10, frequência de 0 a 100% e observação.
8. A família vinculada consulta e baixa o boletim em PDF. Não existe consulta pública de notas por CPF ou nome.

## Segurança e operação

As coleções públicas são separadas das privadas e usam listas de campos permitidos. Regras negam acesso por padrão às coleções não previstas. Contas não podem alterar o próprio cargo ou vínculos; perfis suspensos perdem as permissões. Identificações, movimentos e eventos de auditoria são imutáveis pelo aplicativo. O histórico novo exige operação correspondente, autor autenticado e estados anterior/posterior conferidos pelas regras, sendo imutável para o cliente. A leitura da auditoria geral é restrita ao Master; gestores de alimentação consultam apenas seu domínio. O último acesso é uma métrica operacional separada; não substitui logs independentes do provedor nem auditoria externa.

As consultas novas aguardam confirmação do servidor para não apresentar documentos antigos do cache a outro perfil. A autenticação de equipe consulta o perfil no servidor. Não foi habilitada persistência offline de dados escolares. Use o botão Sair ao terminar em um equipamento compartilhado.

**App Check:** há suporte opcional a reCAPTCHA Enterprise. Cadastre o aplicativo Web no App Check, configure `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` no ambiente de build, gere um novo build e acompanhe as métricas no Firebase antes de ativar a aplicação obrigatória no Firestore. Não ative enforcement antes de configurar e testar o cliente. Não há chave de reCAPTCHA inventada no pacote.

Ative a política de senha do Firebase e a proteção contra enumeração de e-mails conforme as opções disponíveis no seu projeto. Revise os domínios autorizados, os membros do projeto no Console, as cotas e os alertas de uso. Regras de aplicação não limitam proprietários com acesso administrativo ao Console ou Admin SDK.

O portal carrega publicações e fichas públicas por listeners compartilhados e filtra a busca no navegador. Isso atende um catálogo municipal pequeno/moderado; um acervo muito grande deve migrar para paginação do servidor e serviço de busca. Históricos internos e alertas usam limites de registros indicados na tela. O plano e as cotas do Firebase continuam valendo.

O texto inicial de Privacidade descreve o funcionamento implementado. A Secretaria deve publicar seus canais oficiais, responsável pelo atendimento aos titulares e critérios próprios de retenção. Não foram inventados responsáveis, contatos, prazos legais ou dados municipais.

## Testes locais

Nenhum teste abaixo usa credenciais ou dados de produção. As contas `example.test` só existem nos emuladores e não são contas do seu Firebase.

```sh
npm run lint
npm run test:integracao
npm run test:regras
npm run test:seguranca
npm run test:recuperacao
npm run test:clientes
npx playwright install chromium
npm run test:navegador
npm run build -- --cliente pedro-ii
```

Os emuladores exigem Java 21 ou superior. Os testes de regras verificam acessos permitidos e negados, publicação sem campos privados, propriedade das solicitações, vínculos de alunos, integridade de movimentos e identificações.

Para explorar manualmente um ambiente vazio de testes:

```sh
npx firebase emulators:start --only firestore,auth --project demo-seduc
```

Em outro terminal, Linux/macOS: `VITE_FIREBASE_EMULATORS=true npm run dev`. No PowerShell: `$env:VITE_FIREBASE_EMULATORS="true"; npm run dev`. Nesse modo de desenvolvimento, o cliente usa exclusivamente o projeto fictício `demo-seduc` e os emuladores locais. A chave de teste não é usada no build de produção.

Os controles de acessibilidade incluem fonte de 90% a 200%, contraste, foco visível, link para pular ao conteúdo, navegação por teclado, nomes de campos e redução de movimento. Os testes de navegador não equivalem a uma certificação completa de acessibilidade ou a um teste de invasão independente.

## Referências técnicas

- [Condições das regras e compatibilidade com consultas](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Testes com o emulador do Firestore](https://firebase.google.com/docs/firestore/security/test-rules-emulator)
- [Atualizações em tempo real e metadados do cache](https://firebase.google.com/docs/firestore/query-data/listen)
- [Requisitos do Vite](https://vite.dev/guide/)
