# Instalação e operação — SEDUC 2.1.0

Leia também `REVISAO-TECNICA.md` e `VALIDACAO.md`. Esta entrega é baseada no ZIP 2.0.0 disponível na conversa. Se o seu repositório de produção recebeu mudanças posteriores, compare-as antes de substituir arquivos. Preserve uma cópia do código e um backup verificado do banco.

## Preparar o projeto

Extraia a pasta `Seduc` completa. Use Node 22.12 ou superior (22 LTS/24 compatível) e execute na pasta que contém `package.json`:

```sh
npm ci
npm run build -- --cliente pedro-ii
```

O build deve terminar identificando `pedro-ii / recallapp-14074`. `dist` contém o frontend compilado. O ZIP inclui fontes, API, regras, índices, scripts, testes, documentação e lockfile; não inclui `node_modules`, credenciais ou cópias de dados pessoais.

Para desenvolvimento: `npm run dev`. O arquivo `.env.example` mostra apenas opções públicas. Para emuladores, defina `VITE_FIREBASE_EMULATORS=true` somente no ambiente local. O código impede conexão com emuladores em build de produção. Não inclua esse valor em um deploy comum.

Se `npm ci` no Windows retornar EPERM no arquivo `rolldown-binding…node`, encerre o servidor Vite com Ctrl+C, feche os terminais que usam o projeto e tente novamente. Se o arquivo continuar bloqueado, reinicie o computador. Evite instalar o projeto dentro de outra pasta com `node_modules` compartilhada; use a pasta extraída e seu lockfile. Não resolva o problema ampliando `server.fs.allow` para todo o disco ou desativando verificações do navegador.

## Publicação na Vercel

O repositório deve conter a pasta raiz do projeto, incluindo `api/`, `server/`, `scripts/`, `clientes/`, `package.json`, `package-lock.json` e `vercel.json`. Na Vercel, a Root Directory deve apontar para essa pasta.

| Configuração | Valor |
| --- | --- |
| Framework | Vite |
| Build Command | `npm run build -- --cliente pedro-ii` |
| Output Directory | `dist` |
| Install Command | `npm ci` |
| Node | 22.12+ ou 24 |

O arquivo `vercel.json` contém o build e o tratamento de rotas. Remova overrides antigos que conflitem com ele. Publique uma nova implantação após alterar variáveis/configuração; alterar uma variável não modifica o código de uma implantação anterior.

A aplicação tem assets versionados. Não configure todos os caminhos de arquivo para devolver `index.html`; JS/CSS inexistentes devem retornar erro de arquivo ausente. O painel de erro do aplicativo permite recarregar quando uma aba antiga tentar buscar um módulo de um deploy anterior. Os cabeçalhos configurados precisam ser conferidos no deployment real.

## Regras e índices do Firebase

Hospedar o site na Vercel **não publica as regras do Firebase**. Com Firebase CLI autenticado no projeto correto, faça a atualização em janela controlada:

```sh
npx firebase deploy --only firestore:rules,firestore:indexes,storage --project recallapp-14074
```

Caso o Storage nunca tenha sido provisionado e o comando desse serviço falhe, publique primeiro somente Firestore:

```sh
npx firebase deploy --only firestore:rules,firestore:indexes --project recallapp-14074
```

O módulo atual usa identificação por CPF e não depende de uploads. Se houver um bucket legado, publique e confira suas regras separadamente. Aguarde os índices estarem prontos antes de liberar as novas consultas. Novas coleções incluem `parametros`, `pendencias`, leituras individuais em `usuarios/{uid}/leituras` e o histórico administrativo de servidor `operacoesAdmin`.

Publique código e regras na mesma janela de atualização. Clientes antigos podem ter gravações recusadas com o esquema mais restrito. Não reverta para regras permissivas para fazer uma aba antiga voltar a salvar. Feche essas abas e reabra a aplicação atualizada.

## Ativar administração do Authentication

Criar/editar perfis e a gestão editorial existente continuam no frontend. Desativar login, reativar login e revogar sessões usam o endpoint protegido da Vercel. Configure estas variáveis **exclusivamente no servidor**, no ambiente da implantação:

| Variável | Conteúdo |
| --- | --- |
| `SEDUC_CLIENTE` | `pedro-ii` |
| `SEDUC_ADMIN_ORIGINS` | Origens HTTPS exatas autorizadas, separadas por vírgula e sem barra final; por exemplo, a origem real do portal e seu domínio institucional. Não use `*`. |
| `SEDUC_ADMIN_CREDENTIALS_JSON` | JSON de uma identidade administrativa autorizada somente para o projeto correto; `project_id` deve coincidir com o cliente selecionado. |

Não use prefixo `VITE_` nessas credenciais. Não cole o JSON em `src/firebase.js`, `clientes/pedro-ii.json`, Git, ZIP ou mensagens. A identidade precisa das permissões de gerenciamento de usuários do Authentication e das leituras/transações necessárias no Firestore. Use uma conta dedicada com acesso mínimo ao projeto; revise e revogue suas chaves conforme o procedimento da instituição. A configuração ausente ou divergente faz o endpoint recusar a operação com 503.

Após redeploy, entre como Master em **Usuários e cargos**, edite um perfil de teste, confirme sua própria senha e execute uma operação controlada. Confirmação recente vale quinze minutos. A API recusa autodesativação, conta sem perfil/vínculo de equipe e corpo inválido, limita ações e registra tentativas/resultados. Para outro domínio ou preview, cadastre a origem explicitamente; credenciais de produção não devem ser reutilizadas livremente em previews.

Em caso de “verificar”/“em execução” prolongado, confira a conta no Authentication e o perfil no Firestore. A comunicação com dois serviços não é atômica. O bloqueio do perfil permanece se uma etapa posterior falhar. Reativar o login não remove a suspensão do perfil; libere o acesso explicitamente somente depois da conferência.

`npm run dev` serve apenas Vite e não hospeda a API Vercel. Sem um ambiente de funções, os botões administrativos de servidor exibem indisponibilidade. Os testes do handler usam emuladores e uma simulação do serviço de token; a assinatura real do token é verificada pelo Admin SDK no endpoint implantado. No Firebase Hosting puro será necessário hospedar a API em um backend autorizado e adaptar a integração; esse arquivo não cria uma Cloud Function automaticamente.

## Configurações do console

- Confira Authentication por e-mail/senha, domínios autorizados, modelo de recuperação e política de senha. Ative a proteção contra enumeração e confirme as limitações/cotas do projeto.
- App Check: o frontend aceita `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`. Cadastre o domínio, confira métricas em homologação e só então imponha App Check no provedor. Nenhuma enforcement foi ativada remotamente nesta entrega.
- Revise IAM dos operadores e da identidade da API. Security Rules não limitam quem acessa o banco pelo Admin SDK com privilégios de provedor.
- Configure monitoramento de erros, consumo de leituras/cotas, disponibilidade e incidentes. Os erros de DNS/QUIC/bloqueador apresentados anteriormente não demonstram, sozinhos, falha nas regras do Firebase.

## Agendar o backup completo

A aba Backup da alimentação oferece exportação operacional local. Para recuperação completa da instituição, utilize **Recuperação e ambiente** e os scripts administrativos. O agendador novo executa a rotina cifrada completa de Firestore/Auth; não utiliza Storage nem precisa que alguém mantenha uma aba aberta.

Prepare uma máquina administrativa sempre ligada ou serviço equivalente, Node, identidade autorizada e os parâmetros de hash de senha descritos em `OPERACAO-E-RECUPERACAO.md`. As credenciais, o arquivo de parâmetros e a senha ficam fora do projeto e da pasta pública. Forneça `SEDUC_BACKUP_SENHA` pelo ambiente protegido do processo, com pelo menos dezesseis caracteres; guarde a senha separada das cópias.

Execução única, adequada para Agendador de Tarefas do Windows ou timer do sistema:

```sh
npm run backup:agendado -- --cliente pedro-ii --confirmar-projeto recallapp-14074 --destino /pasta-protegida/SEDUC-backups --hash-config /pasta-protegida/parametros-senha.json --uma-vez
```

No Windows, substitua os caminhos por caminhos absolutos reais e use aspas quando contiverem espaços. A pasta de destino deve estar fora do projeto e não pode ser a raiz do disco. Configure no agendador: diretório de trabalho da aplicação, identidade de serviço, variáveis protegidas, frequência desejada e proibição de sobreposição. Teste manualmente uma execução sob a mesma identidade usada pelo serviço.

Alternativa: processo contínuo supervisionado, intervalo de 24 horas entre execuções:

```sh
npm run backup:agendado -- --cliente pedro-ii --confirmar-projeto recallapp-14074 --destino /pasta-protegida/SEDUC-backups --hash-config /pasta-protegida/parametros-senha.json --horas 24
```

O processo usa um lock por cliente, cria arquivos novos, verifica a decifragem e o manifesto e registra o status em `operacao/backupAgendado`. Se houver desligamento forçado, confira se o processo e a manutenção realmente terminaram antes de remover um lock antigo. Não remova bloqueio de restauração em andamento.

O agendador **não está ativado apenas por publicar o ZIP**. É necessário cadastrar o timer/serviço. Ele não apaga backups antigos, não envia automaticamente para outra máquina e não protege contra perda do mesmo disco. Defina retenção, alertas de falha/atraso, limites de espaço, cópia independente e ensaios de restauração. A rotina pode pausar gravações de negócio durante a coleta; programe a janela apropriada. Consulte os limites de tamanho, snapshot e Authentication no guia de operação.

## Restaurar e validar antes da liberação

Siga `OPERACAO-E-RECUPERACAO.md`: o comando de restauração mostra o plano sem gravar, exige destino vazio e só aplica com opção explícita. Faça o primeiro ensaio em projeto separado da mesma instituição, publique as regras/índices, confira contas e dados e libere a manutenção após validação. Preserve à parte arquivos antigos de Storage e documentos externos, que não integram a cópia binária.

Confira pelo menos: entrada/saída e auditoria; vistoria com dois CPFs e publicação sem CPF; nota e boletim vinculado; acesso negado entre escolas/perfis; cadastro/suspensão/recuperação de conta; relatório PDF/Excel; notificação individual; backup e login restaurado. Use dados fictícios na demonstração comercial.

## Acessibilidade e serviços externos

O texto para voz depende de uma voz local em português instalada no dispositivo. A integração VLibras carrega somente quando ativada em página pública e usa iframe isolado. Os cabeçalhos específicos de `/libras/` fazem parte da entrega; valide o intérprete real no deployment de homologação. Não flexibilize a segurança da área administrativa para fazer um tradutor acessar informações pessoais.

Execute o roteiro de navegador e testes com NVDA/VoiceOver antes de declarar conformidade WCAG AA. Esta versão ainda não tem essa certificação. Os critérios e limitações atuais estão em `VALIDACAO.md`.

## Dependências

Adicionadas `@vueuse/core` para comportamento responsivo, `write-excel-file` para Excel e `@axe-core/playwright` para verificação automática de acessibilidade no roteiro de testes. Foram usadas animações nativas, sem dependência extra para transições simples. `firebase-admin` agora é dependência do servidor; `vue-router` foi classificado como dependência de execução.

`firebase-admin` está fixado em 14.3.0. `overrides` troca `uuid` por 11.1.1 somente dentro de `gaxios@6.7.1` e `teeny-request@9.0.0`, resolvendo o alerta conhecido da versão antiga conservada por essas dependências. Preserve o lockfile e revise esses overrides em futuras atualizações dos pacotes pais. O aplicativo não usa os métodos v3/v5/v6 afetados, mas a árvore de produção foi corrigida e auditada.
