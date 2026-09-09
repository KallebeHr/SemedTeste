# Validação — versão 2.1.0

Verificação em 08/09/2026, usando a cópia de código disponível. Nenhuma conta, regra, índice ou documento de produção foi alterado. Os emuladores usam projetos fictícios `demo-*` e dados de teste.

| Verificação | Resultado desta rodada |
| --- | --- |
| Build identificado | Concluído para `pedro-ii / recallapp-14074`. |
| ESLint | Sem erros ou avisos de código; o aviso de configuração de proxy vem do ambiente npm. |
| Dependências de produção | `npm audit --omit=dev`: 0 vulnerabilidades conhecidas na consulta após a atualização/overrides. Isso não garante ausência de falhas. |
| Regras do portal + segurança/auditoria | 35 testes aprovados, incluindo sessão de oito horas, origem do alerta, campos extras e permissões de pendências. |
| API administrativa | 5 testes aprovados. Firestore emulado e serviço Auth simulado: permissão, origem, idempotência, auditoria, falha parcial e reativação sem liberar perfil. |
| Recuperação/migração/agendador | 11 testes aprovados com Firestore/Auth emulados; inclui um arquivo agendado gerado/decifrado e restauração com login por senha. |
| Integração de composables | 32 testes aprovados com SDK simulado. |
| Isolamento/seleção de cliente | 3 testes aprovados. |
| Indicadores/segmentação de voz | 3 testes aprovados. |
| Navegador/end-to-end desta versão | Não concluído: a conexão de controle do navegador encerrou durante as tentativas de navegação. |
| NVDA/VoiceOver | Não executados; não estão disponíveis no ambiente de validação. |
| VLibras real e áudio do dispositivo | Integração implementada, mas não homologada com o intérprete externo/vozes locais. |
| Produção/IAM/cabeçalhos Vercel/carga | Não acessados ou medidos nesta rodada. |

**89 testes automatizados aprovados: 51 nos emuladores/handler administrativo e 38 de integração/unidades.** A suíte de navegador anterior foi preservada e ampliada com axe, mas seus resultados da versão 2.0.0 não são apresentados como validação desta versão.

## O que os testes comprovam

Recusa de operação sem auditoria ou evento sem operação correspondente; antes/depois e autor conferidos; impossibilidade de alterar o histórico pelo cliente; IDs determinísticos de notas; CPF inválido ou nome divergente recusados; checklist de oito itens; vínculos de escola/professor/família; suspensão e expiração; alertas com origem real; destinatário exclusivo de pendência e leitura individual; parâmetros versionados; bloqueio de manutenção; restauração em destino vazio; arquivo alterado/senha errada recusados; retomada sem sobrescrita divergente; preservação de dados e credenciais fictícias; migração explícita de notas duplicadas.

Os testes da API verificam o protocolo de autorização e as transações usando um Auth simulado. Não equivalem a testar IAM, assinatura real de token ou função hospedada. No servidor real, o Admin SDK executa a verificação criptográfica/revogação. A ativação requer um ensaio na Vercel de homologação com contas de teste e origem permitida.

A recuperação foi exercitada com dados fictícios de alunos, notas, cardápios, solicitações, identificações, custom claims, tipos Firestore e subcoleções sem pai. Parâmetros reais de hash de senha, IAM, configuração de provedores e volume de produção precisam de ensaio próprio. A rotina não inclui binários do Storage nem documentos externos.

## Repetir os testes

Node 22.12+ e Java 21 para emuladores. Não configure credenciais de produção nos testes.

```sh
npm ci
npm run lint
npm run test:integracao
npm run test:clientes
node --test tests/seguranca/indicadores.test.cjs
npm run test:regras
npm run test:seguranca
npm run test:admin
npm run test:recuperacao
npm audit --omit=dev
npm run build -- --cliente pedro-ii
```

Execute as suítes de emuladores sequencialmente, pois usam as mesmas portas. Para repetir a rodada combinada:

```sh
npx firebase emulators:exec --only firestore,auth --project demo-seduc "node --test --test-concurrency=1 tests/portal/regras.test.cjs tests/seguranca/auditoria.test.cjs tests/seguranca/admin-servidor.test.cjs tests/seguranca/recuperacao.test.cjs tests/seguranca/migracao.test.cjs"
```

Teste local de navegador, ainda pendente nesta revisão:

```sh
npx playwright install chromium
npm run test:navegador
```

O roteiro impede solicitações externas e usa emuladores: não valida o serviço remoto VLibras. A saída axe de merenda fica em `test-results/axe-merenda.json`. Corrija violações e confirme o funcionamento humano; axe não certifica WCAG. A instalação de navegador pode exigir acesso de rede e bibliotecas do sistema.

## Homologação visual e por tecnologias assistivas

| Cenário | Critério de aceitação |
| --- | --- |
| Teclado público | Tab/Shift+Tab acessam links e controles; o primeiro link pula para o conteúdo; Enter/Espaço acionam elementos; Escape fecha menus e retorna foco. |
| Administrativo em 390 px e 200% | Menu recolhe sem esconder o botão de abertura; links ocultos não recebem foco; conteúdo mantém ordem e controles visíveis; tabelas podem rolar sem rolagem horizontal da página toda. |
| Contraste | Medir ao menos 4,5:1 para texto normal e 3:1 para texto grande/elementos relevantes; conferir também links, mensagens, campos desativados conforme critérios aplicáveis e alto contraste. |
| NVDA + Firefox | Títulos, rótulos, tabelas, erros, mensagens de sucesso, carregamento, permissão e foco de rota são compreensíveis sem olhar a tela. |
| VoiceOver + Safari | Repetir os fluxos principais, incluindo navegação móvel e campos de CPF; não depender de cor ou posição para entender a ação. |
| Voz local | Iniciar, pausar, retomar e parar; mudar de rota encerra; ausência de voz informa limitação; valores de formulários não são lidos. |
| VLibras | Ativar somente em rota pública; verificar o intérprete, seleção de texto, fechamento, teclado e CSP; nenhuma área privada deve ser enviada. |
| Formulário pendente | Trocar rota/escola/aba pede confirmação; cancelar mantém dados; timeout permite conferir resultado antes de repetir; não duplicar movimentação. |
| Deploy/aba antiga | JS/CSS ausente não retorna o HTML da SPA; erro oferece recarregar sem loop; 404 personalizada funciona para rota inválida. |

## Avisos remanescentes

O build mantém um chunk Firebase acima de 500 kB e informa que uma importação dinâmica de Auth também é estática. Isso afeta oportunidades de otimização, não impediu compilar. Testes Node emitem avisos de módulos VM experimentais e detecção de módulos; não foram ocultados.

Não foram realizados pentest independente, teste de carga, certificação de acessibilidade, revisão jurídica ou configuração remota. Para apresentar comercialmente, use dados fictícios e explique essas limitações; para operar com dados reais, cumpra a homologação em `ATUALIZACAO-2.1.md`.
