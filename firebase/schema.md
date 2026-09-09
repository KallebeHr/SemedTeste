> Modelagem do portal e módulo de alimentação. A versão atual usa confirmação por nome e CPF no Firestore, sem envio ao Storage. Consulte `../GUIA-PORTAL.md` para atualização e limites.

# Modelagem de Dados — Firestore

Sistema de Controle de Estoque, Alimentação, Vistoria e Auditoria
para Secretaria Municipal de Educação (SEDUC).

## Coleções do portal

| Caminho | Dados | Leitura |
| --- | --- | --- |
| `usuarios/{uid}` | Nome, e-mail, cargo, situação e vínculos da equipe | Próprio titular e Master |
| `equipe/{uid}` | Nome, cargo, situação e escolas; sem e-mail | Equipe autorizada |
| `conteudos/{id}` | Rascunho, versão e dados editoriais | Master/Alimentador; Nutricionista nos cardápios |
| `publicacoes/{id}` | Projeção revisada e publicada, sem campos internos | Pública |
| `portalPublico/configuracao` | Hero, contatos oficiais e versão | Pública |
| `escolas/{id}` | Cadastro interno da escola e subcoleções da alimentação | Equipe conforme cargo/vínculo |
| `escolasPublicas/{id}` | Ficha pública com campos permitidos | Pública |
| `escolasPublicas/{id}/vistorias/{id}` | Data, tipo, resultado, nota, nome do responsável, publicação | Pública enquanto a escola estiver publicada |
| `solicitacoes/{id}` | Protocolo, assunto, pedido, situação e resposta | Titular e equipe conforme cargo/vínculo |
| `limitesAtendimento/{uid}` | Horário/protocolo do último envio | Titular; atualização atômica com o pedido |
| `alunos/{id}` | Nome, turma, ano e vínculos com escola/professores/família | Master, diretor da escola, professor vinculado e família verificada vinculada |
| `alunos/{id}/notas/{id}` | Componente, bimestre, ano, nota, frequência, observação e autor | Mesmo escopo do aluno |
| `auditoriaPortal/{id}` | Ação, referência do documento, ator e horário | Master |
| `auditoria/{id}` | Alterações operacionais da alimentação | Master/Nutricionista |
| `notificacoes/{id}` | Alertas da alimentação | Gestão ou destinatário autorizado |

Publicações e cadastros editáveis usam `versao` para detectar conflitos. Dados operacionais não se tornam públicos automaticamente. Consulte as listas exatas de campos em `firestore.rules`.

## `usuarios/{uid}`
Espelha o Firebase Auth (uid = auth.uid).

| campo | tipo | descrição |
|---|---|---|
| nome | string | nome completo |
| email | string | |
| papel | string | `master` \| `alimentador` \| `nutricionista` \| `diretor` \| `professor`; aliases antigos `admin` e `gerente` aceitos para acesso |
| escolasVinculadas | array<string> | Até 20 IDs; diretor/professor dependem do vínculo; gestão tem acesso à rede |
| ativo | boolean | |
| criadoEm | timestamp | |
| ultimoAcesso | timestamp | |

## `escolas/{escolaId}`

| campo | tipo | descrição |
|---|---|---|
| nome | string | |
| codigoInep | string | código INEP da escola |
| endereco | string | |
| telefone | string | |
| diretorId | string | uid do diretor responsável |
| diretorNome | string | |
| totalAlunos | number | usado para cálculo de per-capita de alimentação |
| ativo | boolean | |
| criadoEm | timestamp | |

## `escolas/{escolaId}/estoque/{itemId}`
Item de estoque (gêneros alimentícios, materiais de limpeza, etc).

| campo | tipo | descrição |
|---|---|---|
| nome | string | |
| categoria | string | `perecivel` \| `nao_perecivel` \| `hortifruti` \| `limpeza` \| `descartavel` |
| unidade | string | kg, l, un, cx, pct |
| quantidadeAtual | number | atualizada a cada movimentação (transação) |
| ultimaMovimentacaoId | string | ID do movimento novo confirmado na mesma transação |
| quantidadeMinima | number | gera alerta de reposição |
| validade | timestamp \| null | usada para alertas de vencimento |
| lote | string | |
| fornecedorId | string | |
| precoUnitario | number | |
| localArmazenamento | string | |
| atualizadoEm | timestamp | |
| atualizadoPor | string (uid) | |
| ativo | boolean | soft delete |

## `escolas/{escolaId}/movimentacoes/{movId}`
Toda entrada/saída de estoque — imutável após criada (correções geram
movimentação de estorno, nunca edição direta).

| campo | tipo | descrição |
|---|---|---|
| tipo | string | `entrada` \| `saida` \| `estorno` \| `perda` |
| itemId | string | |
| itemNome | string | desnormalizado para relatórios rápidos |
| quantidade | number | |
| quantidadeAnterior | number | snapshot antes da operação |
| quantidadeResultante | number | snapshot depois |
| motivo | string | ex: "Preparo do almoço", "Recebimento NF 1234" |
| notaFiscal | string \| null | |
| fornecedorId | string \| null | |
| responsavelId | string (uid) | |
| responsavelNome | string | |
| assinaturaId | string \| null | ID da identificação do responsável; registros legados podem referenciar imagem |
| data | timestamp | |
| observacoes | string | |

## `escolas/{escolaId}/vistorias/{vistoriaId}`
Vistoria/inspeção sanitária e de recebimento.

| campo | tipo | descrição |
|---|---|---|
| tipo | string | `recebimento` \| `sanitaria` \| `estrutural` \| `rotina` |
| data | timestamp | |
| responsavelId | string (uid) | normalmente o nutricionista |
| checklist | array<{item, status, observacao}> | de 1 a 8 itens; resultado validado nas regras |
| notaGeral | number ou null | 0–10; null quando todos os itens são N/A |
| status | string | `conforme` \| `nao_conforme` \| `conforme_com_ressalvas` \| `nao_aplicavel` |
| fotos | array<string> | vazio nas novas vistorias; referência legada |
| assinaturaResponsavelId | string | |
| assinaturaTestemunhaId | string | obrigatória nas novas vistorias; pode ser null em registros antigos |
| planoDeAcao | string \| null | obrigatório se houver qualquer item não conforme |
| criadoEm | timestamp | |

## `escolas/{escolaId}/assinaturas/{assinaturaId}`
Identificação por nome e CPF vinculada à operação, escrita na mesma transação.

| Campo | Tipo | Descrição |
| --- | --- | --- |
| metodo | string | `identificacao_cpf` |
| versao | number | `2` |
| nomeSignatario | string | Nome completo normalizado |
| cpf | string | 11 dígitos, sem pontuação |
| papelSignatario | string | Função declarada da pessoa |
| cargoDocumento | string | Responsável ou testemunha |
| documentoTipo | string | `movimentacao` ou `vistoria` |
| documentoId | string | ID da operação |
| hashDocumento | string | SHA-256 dos dados da operação, calculado no cliente; não certifica identidade |
| criadoPor | string | UID da conta que registrou os dados |
| dataHora | timestamp | Data da identificação |

As operações novas também guardam `metodoConfirmacao: identificacao_cpf`, `identificacaoResponsavel` e, nas vistorias, `identificacaoTestemunha`. Cada resumo contém `nome`, `cpfMascarado`, `funcao` e `metodo`, sem CPF completo. `responsavelId` identifica a conta que registrou a operação; `responsavelNome` identifica o responsável declarado, e `registradoPorNome`, a conta que efetuou o cadastro.

Registros anteriores podem conter `imagemUrl`, `storagePath`, `documentoDados` e outros campos de captura manuscrita. Esses dados são preservados; novos registros não enviam imagens. CPF completo só pode ser lido pela gestão ou pela conta que criou a identificação, conforme as regras publicadas.

## `auditoria/{logId}` (coleção raiz — trilha imutável e global)

| campo | tipo | descrição |
|---|---|---|
| escolaId | string \| null | |
| colecao | string | coleção afetada |
| documentoId | string | |
| acao | string | `create` \| `update` \| `delete` |
| usuarioId | string (uid) | |
| usuarioNome | string | |
| papelUsuario | string | |
| dadosAntes | map \| null | snapshot anterior (null em create) |
| dadosDepois | map \| null | snapshot novo (null em delete) |
| camposAlterados | array<string> | diff calculado no cliente |
| timestamp | timestamp | |
| dispositivo | string | |

> A trilha do aplicativo não substitui logs independentes do provedor. Não há Cloud Function implantada.

## `backups/{backupId}` — referência legada

A interface atual gera somente um arquivo JSON local, com `versaoEsquema: 2`. Ela não grava nesta coleção nem envia arquivos ao Storage. O esquema abaixo descreve cópias antigas no servidor.

| campo | tipo | descrição |
|---|---|---|
| criadoEm | timestamp | |
| criadoPor | string (uid) | |
| tipo | string | `manual` \| `automatico_diario` |
| escolasIncluidas | array<string> | |
| storagePath | string | caminho do `.json` no Storage |
| tamanhoBytes | number | |
| status | string | `concluido` \| `erro` |
| totalDocumentos | number | |

## `notificacoes/{notifId}`
Alertas de estoque baixo, validade próxima, vistoria não conforme.

| campo | tipo | descrição |
|---|---|---|
| tipo | string | `estoque_baixo` \| `validade_proxima` \| `vistoria_nao_conforme` |
| escolaId | string | |
| titulo | string | |
| mensagem | string | |
| destinatarios | array<string> (uid) | |
| lida | boolean | |
| criadoEm | timestamp | |

---

## Índices

O arquivo `firestore.indexes.json` contém os índices usados nas consultas do projeto. Publique esse arquivo junto das regras e aguarde a construção no Firebase antes de usar as telas.
