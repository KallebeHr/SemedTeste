# Correções do relatório de prontidão — versão 2.0.0

Os cinco pontos foram tratados no código, nas regras e nas ferramentas operacionais. A ativação exige publicar esta versão e suas regras/índices, regularizar dados legados e realizar um ensaio no ambiente do cliente. Não houve alteração de produção durante o desenvolvimento.

| Apontamento | Correção implementada | Evidência incluída |
| --- | --- | --- |
| Operações sem histórico ou eventos sem operação | Transação auditada obrigatória, referência ao documento alterado, ator conferido, estados anterior/posterior verificados pelas regras e evento imutável. Histórico falso ou separado da operação é recusado. | Testes negativos de gravação sem evento, evento isolado, estado anterior falso, autor forjado e alteração do histórico; gravações legítimas verificadas. |
| Notas duplicadas com IDs diferentes | ID canônico calculado e exigido pelo servidor; inclui aluno, componente normalizado, ano, bimestre e professor. Versão continua impedindo sobrescrita concorrente. | Tentativa por outro ID recusada; testes de nota válida, faixa de valores e vínculos; migração de IDs antigos com cópia prévia e decisões explícitas de duplicidade. |
| CPF fraco no banco e nome público divergente | Mesmos dígitos verificadores no frontend e nas regras; nome/sobrenome, dois CPFs distintos, papéis e resumos correspondentes. Publicação exige nome da identificação válida vinculada à vistoria. | CPF inválido, nome sem letras, responsável divergente e campos públicos extras recusados; vistoria completa com oito itens aceita. |
| Backup incompleto | Recuperação cifrada de todas as coleções/subcoleções, contas padrão do Authentication e configuração versionada. Plano sem escrita, destino vazio, verificação e retomada de falhas. Exportação antiga rotulada como parcial. | Restauração de alunos, notas, cardápios, contas, vínculos, tipos Firebase e subcoleções órfãs; login por senha no emulador; rejeição de senha errada, arquivo alterado e destino conflitante. |
| Outros clientes sem isolamento definido | Uma instituição por projeto Firebase; configuração explícita por cliente, rejeição de projeto compartilhado, build identificado e confirmação de destino ao publicar. | Configuração duplicada e publicação cruzada recusadas; dados com mesmos caminhos em dois projetos permanecem separados no emulador. |

## Melhorias associadas

- O Master consulta os estados antes/depois na auditoria geral e distingue registros legados dos novos.
- Nova seção **Recuperação e ambiente**, exclusiva do Master, mostra o projeto selecionado e os comandos operacionais.
- Manutenção de backup/recuperação bloqueia gravações de negócio; o painel mostra a situação e preserva o formulário quando uma operação é recusada.
- Checklist completo mantém a validação de seus oito itens e o cálculo de resultado sem ultrapassar o limite de expressões das regras.
- A migração preserva integralmente as notas substituídas e identifica as alterações realizadas pelo operador.
- A configuração original de Pedro II foi preservada e passou para um arquivo de cliente selecionado no build.

## Alcance das garantias

A auditoria obrigatória cobre as gravações de negócio feitas pelo cliente Firestore nesta versão. Identificações são vinculadas à operação principal e imutáveis; o controle de intervalo de solicitações depende do protocolo correspondente. A atualização de `ultimoAcesso` é uma métrica de login separada. Históricos anteriores continuam disponíveis, mas não ganham retroativamente a garantia nova. Contas do Authentication, operações do Console e Admin SDK precisam também dos registros e controles administrativos do provedor: proprietários do projeto não são limitados pelas regras do aplicativo.

CPF válido significa formato e dígitos verificadores corretos; não comprova titularidade ou presença da pessoa. O nome público vem da identificação declarada. Dados e publicações antigos precisam de revisão explícita: regras novas não percorrem nem corrigem automaticamente o banco existente.

O backup abrange os dados utilizados por este sistema. Não copia arquivos externos/Storage nem restaura automaticamente IAM, DNS e a configuração dos provedores de login. Não representa snapshot conjunto de Firestore e Authentication. É necessário pausar integrações e mudanças de contas durante a janela. Limites, permissões, tipos de conta suportados e passos de recuperação estão em **OPERACAO-E-RECUPERACAO.md**.

## Apresentação e uso comercial

Esta entrega pode ser demonstrada com dados fictícios e utilizada para um piloto supervisionado após ativação e homologação. Não é uma certificação de segurança nem uma promessa de ausência de falhas. Antes de operar com dados reais de um cliente, confirme regras/índices publicados, identidade e permissões do projeto, recuperação com as contas reais, restrição de dados públicos e aprovação dos fluxos pela equipe escolar.

Prioridades posteriores: MFA para equipe privilegiada com recuperação compatível, App Check configurado e observado, monitoramento/alertas operacionais, cópias recorrentes e ensaios de recuperação, catálogo curricular padronizado e revisão independente de segurança/acessibilidade. A organização também precisa definir responsáveis, retenção, suporte e tratamento de incidentes. Não foi presumida uma certificação ou adequação jurídica automática.

Consulte **VALIDACAO.md** para os resultados e **OPERACAO-E-RECUPERACAO.md** para os comandos de ativação.
