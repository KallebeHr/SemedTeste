# Operação, atualização e recuperação — versão 2

Esta versão corrige os cinco pontos do relatório no código e inclui ferramentas para os dados antigos. Não executa alterações no Firebase de produção automaticamente. Faça a primeira atualização e o ensaio de recuperação em uma janela acompanhada pelo responsável técnico.

## Atualizar uma instalação existente

1. Guarde a versão anterior e extraia o ZIP completo em outra pasta. Execute `npm ci` com Node 22.12 ou superior. Java 21 é necessário apenas para os testes com emuladores.
2. Interrompa os lançamentos e as alterações de contas durante a atualização. Preserve uma cópia completa dos dados usando a rotina abaixo. Enquanto as regras antigas estiverem publicadas, a indicação de manutenção desta versão ainda não bloqueia clientes antigos.
3. Confira `clientes/pedro-ii.json`: os valores públicos do Firebase original foram preservados. Credenciais de serviço e parâmetros de senha não pertencem a esse arquivo.
4. Gere `npm run build -- --cliente pedro-ii`. Confira `dist/implantacao.json`. O projeto de destino original é `recallapp-14074`.
5. Com o terminal autorizado no Firebase, execute `npm run publicar -- --cliente pedro-ii --confirmar-projeto recallapp-14074`. Esse comando publica aplicação, regras e índices no mesmo projeto. As etapas do provedor não são uma troca atômica: mantenha a janela de manutenção e aguarde os índices ficarem prontos.
6. Feche/recarregue as abas antigas. O aplicativo anterior não envia o novo histórico obrigatório e suas gravações serão recusadas.
7. Execute o plano de migração de notas, revise duplicidades e aplique conforme a seção abaixo. Revise também vistorias e publicações antigas. O novo código não comprova retroativamente quem registrou os dados históricos.
8. Confira um lançamento e seu histórico, uma vistoria completa, o boletim da família e os acessos de cada cargo antes de liberar a operação.

Em outro provedor de hospedagem, utilize o mesmo build identificado e publique separadamente regras/índices do projeto correspondente. Preserve os cabeçalhos e o redirecionamento de rotas. Não reutilize um build de outra instituição.

## O que a recuperação preserva

| Conteúdo | Tratamento |
| --- | --- |
| Firestore | Todas as coleções e subcoleções existentes, inclusive pais ausentes, alunos, notas, conteúdos, novos cardápios, publicações, escolas, estoque, vistorias, identificações, solicitações, vínculos e auditoria. |
| Tipos do Firestore | Timestamps com nanossegundos, referências, GeoPoint, bytes, listas, mapas e números especiais. Referências internas passam a apontar para o projeto restaurado. |
| Authentication padrão do projeto | UIDs, e-mails, estado de verificação, perfis, senhas exportáveis, provedores vinculados e custom claims. Preserva o vínculo entre conta e documentos. |
| Configuração versionada | Configuração pública do cliente, regras, índices, configuração de hospedagem e manifesto de dependências. São incluídos para conferência; a restauração não os publica sozinha. |
| Proteção do arquivo | JSON tipado, compactado e cifrado com AES-256-GCM; chave derivada da senha por scrypt, sal e IV aleatórios. Há conferência de integridade e contagem. |
| Recuperação | Plano sem escrita por padrão; aplicação explícita em destino vazio; verificação do resultado; retomada de interrupções sem sobrescrever divergências. |

A coleção `operacao` é controle temporário de manutenção e não é restaurada como dado de negócio. A restauração cria seu próprio bloqueio. Guarde também o ZIP do código desta versão: o arquivo de dados não substitui a cópia do código-fonte.

Limites: não copia arquivos binários do Storage, imagens antigas ou documentos hospedados externamente; preserva suas referências. IAM, DNS, domínios autorizados, configurações dos provedores de login, regras efetivamente publicadas e índices do console precisam ser conferidos no destino. O sistema atual não depende de novos uploads ou Cloud Functions. Projetos que adotem tenants do Authentication ou MFA por TOTP exigem outra rotina de recuperação; a ferramenta recusa contas incompatíveis detectadas. Não use esta rotina como backup de uma configuração multitenant do Authentication.

A coleta do Firestore utiliza uma transação de leitura, mas Firestore e Authentication não oferecem aqui um snapshot conjunto. Pause também criação/alteração de contas e integrações com Admin SDK/Console durante a coleta. As regras bloqueiam gravações de negócio feitas pelos clientes; não limitam um administrador do provedor. Para volumes que ultrapassem 256 MiB de conteúdo do arquivo, o tempo da transação ou as cotas disponíveis, adote exportação gerenciada e uma rotina dimensionada. A execução consome leituras e algumas gravações do Firebase.

## Preparar o terminal do operador

O comando usa Application Default Credentials do Google, com permissão no projeto indicado. Autenticar apenas `firebase login` não necessariamente configura essas credenciais. Use uma identidade de operação autorizada por sua organização. Se precisar usar `GOOGLE_APPLICATION_CREDENTIALS`, aponte para um arquivo protegido fora do projeto e fora da pasta publicada. Nunca envie esse arquivo ao frontend, ao Git ou no ZIP.

Para contas com senha, exportar hashes exige a permissão `firebaseauth.configs.getHashConfig`. Copie os parâmetros de hash exibidos no Authentication do projeto de origem para um arquivo protegido, por exemplo `/caminho-protegido/parametros-senha.json`, com estas propriedades:

- `algorithm`: `SCRYPT`;
- `key`: chave em Base64 fornecida pelo Firebase;
- `saltSeparator`: separador em Base64 fornecido pelo Firebase, inclusive vazio quando for o valor real;
- `rounds` e `memoryCost`: números exatamente iguais aos do projeto de origem.

Não invente esses valores. A ferramenta recusa a ausência dos hashes, mas só um ensaio de login no destino comprova que os parâmetros fornecidos estão corretos. Guarde a senha do backup separadamente; perdê-la impede a recuperação. O terminal solicita uma senha de pelo menos 16 caracteres sem exibi-la. Para agendamento, forneça `SEDUC_BACKUP_SENHA` através do gerenciador de segredos do ambiente, sem inseri-la no comando, no código ou em logs.

Referências: [credenciais do Admin SDK](https://firebase.google.com/docs/admin/setup), [exportação de usuários e hashes](https://firebase.google.com/docs/auth/admin/manage-users#list_all_users), [importação de contas e parâmetros de hash](https://firebase.google.com/docs/auth/admin/import-users).

## Gerar a cópia completa

```sh
npm run recuperacao -- --acao backup --cliente pedro-ii --confirmar-projeto recallapp-14074 --arquivo backup-antes-atualizacao.seducbak --hash-config /caminho-protegido/parametros-senha.json
```

O comando cria um arquivo novo, sem substituir um existente. Compare o manifesto, preserve a cópia em local restrito e faça uma segunda cópia independente. O painel do Master, em **Recuperação e ambiente**, oferece o comando do cliente selecionado. Não expõe credenciais administrativas ao navegador.

O bloqueio de manutenção é retirado ao terminar a coleta, inclusive quando uma exceção é tratada. Se o computador desligar ou o processo for encerrado à força, verifique se não há operação em andamento antes de liberar `operacao/estado` no Console. Não remova um bloqueio de restauração interrompida: retome essa restauração.

## Ensaiar e aplicar uma restauração

Crie um projeto de recuperação vazio e uma configuração de cliente separada, conforme a última seção. Configure Authentication e Firestore, as permissões do operador e os provedores de login. Não copie apenas o `projectId` deixando `apiKey` e `appId` do projeto antigo.

Exemplo com um cliente `recuperacao-teste` cujo projeto foi configurado como `SEU-PROJETO-DE-RECUPERACAO` — substitua ambos pelos identificadores reais:

```sh
npm run recuperacao -- --acao restaurar --cliente recuperacao-teste --confirmar-projeto SEU-PROJETO-DE-RECUPERACAO --arquivo backup-antes-atualizacao.seducbak --permitir-projeto-diferente
```

Esse comando confere o arquivo e mostra o plano, sem gravar. Para executar o plano, repita com `--aplicar`. Só use `--permitir-projeto-diferente` para recuperação/migração deliberada da mesma instituição. Nunca restaure os dados de um cliente na base de outro.

Se houver interrupção, repita com `--aplicar --retomar`. A retomada exige o mesmo manifesto e bloqueio de restauração; documentos divergentes causam erro e permanecem intactos. O destino não pode conter uma base de uso normal. Uma restauração confirmada permanece bloqueada para escrita até a conferência final.

Após publicar as regras/índices desta versão, ajustar os domínios e validar contas, permissões e dados:

```sh
npm run recuperacao -- --acao liberar --cliente recuperacao-teste --confirmar-projeto SEU-PROJETO-DE-RECUPERACAO --regras-conferidas
```

Para validar o resultado, entre com uma conta restaurada, confira seu cargo, abra aluno e boletim vinculados, visualize cardápios e vistorias, e faça uma operação de teste com auditoria. Defina frequência e retenção de cópias segundo a necessidade do cliente. Registre quando ocorreu o último ensaio de restauração e quanto tempo levou; a existência de um arquivo sozinha não comprova recuperação operacional.

## Regularizar notas antigas

A chave única usa aluno (no caminho), componente normalizado, ano, bimestre e professor. Caixa, acentos e marcas Unicode equivalentes são normalizados. Abreviações ou nomes distintos de disciplinas continuam sendo componentes diferentes; um catálogo curricular padronizado é uma melhoria futura.

Notas antigas continuam legíveis. A edição de um ID antigo pede regularização para que não surja uma segunda nota ao salvar. Não renomeie documentos diretamente pelo Console.

```sh
npm run migrar:notas -- --cliente pedro-ii --confirmar-projeto recallapp-14074 --relatorio plano-notas.json
```

O plano não grava no banco. Proteja o arquivo: ele contém caminhos de alunos e valores de notas. Grupos com mais de um registro precisam de decisão explícita. Crie `decisoes-notas.json` como um objeto cujas chaves sejam os caminhos `destino` apresentados no plano e os valores sejam os caminhos dos registros escolhidos. Exemplo de formato, sem usar literalmente estes caminhos:

```json
{
  "alunos/ID-ALUNO/notas/HASH-DESTINO": "alunos/ID-ALUNO/notas/ID-ESCOLHIDO"
}
```

Depois de conferir as decisões com a escola e gerar um backup completo recente:

```sh
npm run migrar:notas -- --cliente pedro-ii --confirmar-projeto recallapp-14074 --aplicar --decisoes decisoes-notas.json --backup backup-antes-atualizacao.seducbak --operador "Nome do operador"
```

Sem duplicidades, `--decisoes` pode ser omitido. A ferramenta confere se o backup contém o estado atual das notas. Cada grupo é alterado em uma transação: o registro escolhido passa para o ID único, os originais ficam preservados em `migracoesNotas` e cada mudança recebe histórico identificado como manutenção. Essa coleção é restrita ao operador Admin e está incluída nos backups. Notas inválidas bloqueiam a aplicação e exigem revisão do cadastro. Em falha após alguns grupos, um novo plano e backup permitem tratar só os grupos restantes.

## Conferir vistorias antigas

Os novos registros exigem dois CPFs com dígitos verificadores válidos, pessoas distintas, nome/sobrenome e papéis correspondentes. O nome público deve corresponder à identificação do responsável. CPF continua sendo identificação declarada, não prova de titularidade ou assinatura certificada.

Vistorias e resumos públicos antigos não são revalidados quando as regras são publicadas. Confira os registros que já existem, retire resumos inconsistentes em **Publicar vistorias** e registre uma nova vistoria quando necessário. Não altere uma identificação imutável para fazer o histórico parecer correto. A nova publicação recusa identificação ausente, CPF inválido ou nome divergente.

## Uma instituição por projeto Firebase

Copie `clientes/exemplo.json` para `clientes/identificador-do-cliente.json`. Informe `id`, nome, município e os valores do aplicativo Web do **novo** projeto Firebase. O exemplo vazio não pode ser compilado. Configurações diferentes que apontem para o mesmo projeto são recusadas.

Cada instituição precisa de Firestore, Authentication, configuração de hospedagem/domínios, regras, índices, operadores e rotina de cópias próprios. Reaproveite o código, não as credenciais de serviço nem o banco. Gere o build com `npm run build -- --cliente identificador-do-cliente`; o manifesto e o comando de publicação precisam corresponder ao mesmo cliente/projeto. Revise também a identidade visual e todo conteúdo institucional, que não são dados de outro cliente a serem copiados.

O isolamento adotado é entre projetos; não foi implementado um banco compartilhado com um campo `tenantId`. Dentro de uma instituição, as regras continuam restringindo escola, cargo, professor e titular. Administradores com IAM amplo podem atravessar projetos fora do aplicativo: conceda acesso por projeto e revise esses vínculos com cada cliente.
