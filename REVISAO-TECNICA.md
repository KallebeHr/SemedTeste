# Revisão técnica — SEDUC Pedro II 2.1.0

Data: 08/09/2026. Base: última cópia disponível do projeto `Seduc.zip`, versão 2.0.0. A revisão cobre o código dessa cópia; não houve acesso administrativo ao Firebase ou à Vercel de produção, nem comparação com commits que possam ter sido publicados depois dela.

## Parecer

Esta entrega melhora a segurança e a operação do sistema existente, preservando Vue 3, Firebase, a identidade visual, as rotas públicas e os módulos anteriores. É uma candidata à homologação, não uma certificação de ausência de falhas. Pode ser apresentada como evolução do produto, usando dados fictícios. A liberação para novos clientes e uso crítico exige instalar as regras/índices, configurar o servidor, ensaiar a restauração e concluir a conferência de interface e acessibilidade descrita neste relatório.

Não é tecnicamente justificável prometer “zero falhas”. Um ZIP não comprova regras efetivamente publicadas, IAM, disponibilidade dos provedores, comportamento com carga real ou funcionamento em todos os navegadores. A identificação por nome e CPF continua sendo declarada: não constitui assinatura digital certificada nem prova da titularidade do CPF.

## Diagnóstico inicial, por prioridade

| Prioridade | Constatação no código recebido | Tratamento nesta entrega |
| --- | --- | --- |
| Alta | Validações de esquema incompletas em estoque, movimentações e alertas, apesar da auditoria transacional já existente. | Listas de campos permitidos, limites, vínculos de identificação, origem real dos alertas e testes negativos nas regras. |
| Alta | Suspender o perfil não desativava a identidade no Authentication; não havia prazo administrativo absoluto enforced no banco. | Sessão de equipe de oito horas nas regras, encerramento local por inatividade e API exclusiva do Master para desativação/revogação. |
| Alta | Dependências administrativas apresentaram alertas de segurança quando passaram a compor o servidor. | Admin SDK 14.3.0 e substituição pontual de `uuid` em duas dependências transitivas; validação descrita em `VALIDACAO.md`. |
| Alta | Não havia execução periódica operável do backup completo. | Agendador com arquivos cifrados, exclusão mútua, verificação e status no painel; ativação depende da infraestrutura do operador. |
| Média | Reescrita ampla de SPA podia devolver HTML ao pedir um JS/CSS antigo após deploy. | Assets excluídos do fallback, HTML revalidado, assets versionados imutáveis e recuperação explícita de erro de módulo. |
| Média | Destinatários dos alertas e marcação compartilhada de leitura eram insuficientes. | Caixa de entrada por perfil/escola, leitura individual, pendências atribuídas e ID único por origem. |
| Média | Faltavam relatórios consolidados, Excel e filtros do histórico. | Indicadores, evolução mensal por unidade, filtros, PDF/Excel e paginação de auditoria por cursor. |
| Média | Trocar escola/aba podia descartar formulários. | Confirmação de saída para formulários críticos e proteção da troca de contexto da alimentação. |
| Média | Não havia leitura em voz e Libras; faltava evidência atual de acessibilidade. | Voz local, integração pública isolada do VLibras, ajustes semânticos e roteiro de validação humana. |

## 1. Segurança

As regras continuam sendo a barreira de autorização, independentemente dos botões visíveis. A revisão preservou a auditoria que obriga operação e histórico na mesma transação e confere os estados anterior/posterior. Notas usam uma chave determinística; vistorias exigem dois CPFs válidos pelo cálculo de dígitos verificadores e nomes coerentes com suas identificações. Os testes exercitam as regras reais no emulador, incluindo tentativas de ignorar a interface.

Foram acrescentadas validações de campos e tamanhos, unidade de estoque, estrutura da movimentação, autoria, identificação resumida e notificações. Alertas novos exigem movimentação ou vistoria existente do autor, situação compatível com o alerta e ID derivado da origem. A emissão do alerta ocorre depois da operação: uma falha de notificação não transforma uma movimentação salva em erro. Os indicadores recalculados do estoque/vistorias são a referência operacional; a caixa de entrada não é uma garantia de entrega de mensagens.

Sessões administrativas têm prazo absoluto de oito horas nas regras, usando `auth_time`. A interface encerra após trinta minutos sem atividade e avisa nos dois minutos finais. O prazo de inatividade é um recurso do cliente, não substitui o limite no banco. A revogação individual registra um marco de tempo no perfil; o cliente não pode apagar/reduzir esse marco por escrita direta. Usuários podem atualizar somente seu próprio `ultimoAcesso` sem criar eventos de negócio artificiais.

O endpoint `api/admin/usuarios.js` verifica token com revogação, perfil Master ativo, origem permitida, método e corpo, autenticação recente de quinze minutos, limite de dez ações por minuto e identificador idempotente. O bloqueio de dados é gravado antes da ação no Authentication. Como esses dois serviços não compartilham transação, resultados parciais aparecem no histórico e exigem conferência; o sistema não repete silenciosamente uma ação ambígua. Reativar login não reativa automaticamente o perfil da equipe.

Conteúdo continua renderizado como texto pelo Vue, sem inserir HTML de formulários por `v-html`. URLs aceitam HTTPS ou caminhos internos válidos, recusam credenciais embutidas e sequências de controle. Remover controles e validar limites não substitui a autorização no banco. A exportação Excel usa células textuais explícitas para impedir que texto iniciado por `=` seja tratado como fórmula.

Os valores públicos de configuração Firebase foram preservados. API key de aplicativo Web não equivale a uma chave de serviço. Credenciais administrativas entram somente no ambiente do servidor e jamais em variáveis `VITE_*`, arquivos de cliente ou no bundle. App Check é suportado quando a chave pública de reCAPTCHA Enterprise é configurada; a imposição e a revisão de métricas dependem do console. A política de senha, proteção contra enumeração e limites do Authentication também precisam ser conferidos no provedor. Não foi criado um contador visual que prometa impedir força bruta em chamadas diretas.

Storage: a decisão anterior de usar CPF e nome, sem enviar imagens de assinatura, foi mantida. Novos uploads continuam negados pelas regras; as leituras legadas autorizadas agora respeitam sessão/revogação. Não foi reintroduzido um fluxo de upload que exigisse Storage. Uma futura inclusão de anexos deve validar conteúdo real, tamanho e autorização no servidor/regras, além da extensão/MIME na tela.

## 2. Rotas e estrutura

Guards conferem autenticação e permissão para URLs administrativas. O layout reage a alterações de cargo e vínculos, e as consultas descartam resultados de contextos anteriores. Rotas públicas de merenda continuam mostrando dados publicados, não um formulário de administração. Login permanece em `/login`; a página 404 existente foi preservada.

Novas páginas usam importação dinâmica. Falhas de chunk ou CSS apresentam uma ação de recarregar, sem um ciclo automático que descarte formulários. `vercel.json` inclui o build identificado de Pedro II, diretório `dist`, exclusão de `/assets/`, `/IMG/`, arquivos com extensão e `/api/` do fallback. Cabeçalhos exigem revalidação do HTML e permitem cache longo de assets com hash. Não foram verificadas as respostas HTTP efetivamente publicadas na Vercel.

## 3. Funcionalidades

| Recurso | Comportamento e limites |
| --- | --- |
| Indicadores da rede | Estoque crítico, vencidos com saldo, escolas sem vistoria no prazo e valor cadastral do estoque. Consulta por escolas autorizadas. |
| Consumo | Saídas agrupadas por mês e unidade; não soma kg com litros nem contabiliza perdas como consumo. Registros históricos utilizam a unidade/categoria atual do item; editar esses cadastros pode alterar a classificação do histórico. |
| Relatórios | Escola, período, categoria, situação e busca; tabelas paginadas na tela; PDF e Excel sem CPF completo. Estoque é o saldo atual, não uma reconstrução de saldo passado. |
| Limites de consulta | Até 200 escolas e 1.000 registros por tipo/escola. Resultados excedentes são identificados como parciais e não exportáveis; consulta com prazo de 45 segundos. Exportação limitada a 10.000 linhas. |
| Notificações | Alertas alimentares por escola/perfil e leitura por usuário; pendências do Master para profissionais, com prazo e conclusão versionada. Concluir uma pendência não assina documento nem cria vistoria. |
| Auditoria | Histórico imutável para clientes, com autor, coleção, caminho, data e antes/depois. Filtros por UID, coleção e período; páginas de cinquenta eventos e exportação da página. |
| Versionamento | Histórico anterior/posterior preservado; conflitos tratados nos parâmetros e nas pendências. Não existe reversão automática genérica de todo tipo de registro. |
| Backup | Mantida recuperação completa de Firestore/Auth e dados antigos; novo processo agendável grava cópia cifrada, verifica o arquivo e informa último resultado no painel. Não depende da aba aberta. |
| Restauração | Assistida por CLI, plano sem escrita por padrão, aplicação explícita, destino vazio e retomada verificada. Não há botão no navegador com credenciais administrativas. |

Notificações exibem até cem alertas e cem pendências recentes; não representam uma fila sem limite. Leituras individuais são consultadas até mil registros. O histórico de negócio permanece nas coleções originais e na auditoria. Para crescimento significativo, será necessário paginar também a caixa de entrada e materializar indicadores no servidor.

## 4. Administração e permissões

| Perfil | Escopo |
| --- | --- |
| Master / `admin` legado | Usuários, parâmetros, conteúdo, escolas, alimentação, alunos, notas, solicitações, auditoria e recuperação; visão consolidada. |
| Alimentador | Conteúdos, configuração editorial, escolas/publicação e solicitações. Não recebe permissão de gestão de contas, notas ou estoque. |
| Nutricionista / `gerente` legado | Alimentação de todas as escolas, movimentações, cardápios, vistorias e relatórios. Gerente mantém a equivalência de compatibilidade já existente. |
| Diretor | Escolas vinculadas, alimentação/vistorias autorizadas, alunos e solicitações da sua escola. Não recebe os poderes de movimentação/gestão exclusivos da equipe de nutrição. |
| Professor | Notas e frequência dos alunos atribuídos, conforme os vínculos no banco. |
| Família autenticada | Apenas solicitações próprias e boletim dos alunos com vínculo verificado. |
| Visitante | Somente conteúdo explicitamente publicado; sem CPF, notas, estoques internos ou auditoria privada. |

O cadastro de contas existente foi preservado, usando autenticação secundária em memória para não trocar a sessão do Master. Se a conta for criada e o perfil falhar, o UID permanece para completar o cadastro sem duplicar a identidade. Recuperação usa o e-mail cadastrado; identidades vinculadas manualmente devem ter UID/e-mail conferidos no Authentication. Não existe senha padrão de produção no ZIP.

Parâmetros centralizados permitem definir prazo de vistorias, antecedência da validade e categorias. Alterações são auditadas e verificam versão. Categorias removidas não apagam registros antigos. O formulário de estoque mantém disponível a categoria já gravada ao editar um item.

## 5–7. Interface, navegação e acessibilidade

Foram mantidos paleta, marca, composição das páginas, componentes existentes e navegação pública. O menu administrativo agora pode ser recolhido no celular, reage a Escape, informa seu estado por ARIA e oculta links fora do perfil. Há indicador de notificações, feedback de navegação, skeleton de consulta e pequenas transições nativas. A preferência `prefers-reduced-motion` desativa animações.

A barra permite fonte de 90% a 200%, contraste, leitura em voz e acesso público a Libras. Leitura usa exclusivamente uma voz portuguesa marcada como local pelo navegador; se não existir, informa a necessidade de instalação, sem enviar texto privado a um sintetizador remoto. Mudanças de rota encerram a leitura. Formulários, campos, navegação e conteúdo oculto são excluídos da extração.

VLibras só recebe texto de rotas públicas permitidas, após ativação explícita. O serviço roda em iframe isolado sem acesso à origem da aplicação. Sua compatibilidade nesse isolamento e a tradução final precisam de homologação com o serviço externo; o painel informa falha de carregamento e o caráter automático da tradução. Não foi injetado um script de terceiros nas telas de CPF/alunos.

Foram corrigidos textos de baixo contraste na linha de auditoria, rótulo de filtro, semântica de lista, controles e alturas da barra. Isso não é uma declaração de conformidade WCAG AA de todas as páginas. A sessão de navegador de testes não pôde ser mantida nesta rodada; não foi possível repetir os testes visuais/end-to-end nem executar NVDA/VoiceOver. O roteiro existente foi preservado e recebeu verificação axe para merenda pública.

## Pendências para liberação e melhorias seguintes

1. **Antes de produção:** instalar regras/índices e aguardar conclusão; configurar API privada e domínios; testar todos os papéis em homologação. Conferir política de senha, recuperação, App Check e IAM.
2. **Continuidade:** ativar o agendador em máquina segura sempre disponível, definir retenção, monitorar falhas/espaço e manter outra cópia independente. Ensaiar restauração real em projeto separado, inclusive login por senha.
3. **Acessibilidade:** testar teclado a 200% e 390 px, foco/Escape, alto contraste, erros e mensagens com NVDA/Firefox e VoiceOver/Safari. Medir contraste nas páginas públicas e privadas, validar a voz local e o intérprete. Ver `VALIDACAO.md`.
4. **Escala:** testes de carga/cotas, indicadores agregados, paginação em cadastros extensos e fila durável para alertas. Definir catálogo curricular para impedir que nomes semanticamente diferentes de disciplina criem notas distintas.
5. **Governança:** revisar publicações antigas, política de retenção de dados pessoais, acesso aos backups, trilha do provedor e procedimentos de incidentes. Administradores com IAM podem ignorar regras do cliente: usar privilégios mínimos e revisão periódica.
6. **Comercialização:** cada instituição recebe projeto Firebase, ambiente Vercel, credenciais, operadores e backups próprios. Não utilizar um banco compartilhado acrescentando apenas `tenantId`; esse modelo não foi implementado/testado.

## Fontes técnicas consultadas

- Firebase — sessões/revogação: https://firebase.google.com/docs/auth/admin/manage-sessions
- Firebase — usuários administrativos: https://firebase.google.com/docs/auth/admin/manage-users
- Firebase — senha e proteção contra enumeração: https://firebase.google.com/docs/auth/web/password-auth
- Firebase — chaves públicas: https://firebase.google.com/docs/projects/api-keys
- Firebase — versões do SDK administrativo: https://firebase.google.com/support/release-notes/admin/node
- Vite — erros de carregamento após deploy: https://vite.dev/guide/build
- Vercel — configuração: https://vercel.com/docs/project-configuration/vercel-json
- VLibras — integração e CSP: https://vlibras.gov.br/doc/widget/installation/webpageintegration.html e https://vlibras.gov.br/doc/widget/installation/content-security-policy.html
- Web Speech — voz local: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService

Instruções de instalação desta versão: **ATUALIZACAO-2.1.md**. Resultados e limites dos testes: **VALIDACAO.md**. Procedimentos completos de restauração e migração: **OPERACAO-E-RECUPERACAO.md**.
