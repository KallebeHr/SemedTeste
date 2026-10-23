# Editais e inscrições online

Implementação para revisão, sem publicação em produção. Mantém as publicações existentes e reutiliza o destaque no hero para notícias e editais.

## Operação pelo Master

1. Crie um conteúdo do tipo edital e salve o rascunho. Reabra o editor para configurar as inscrições.
2. Escolha o modelo Anexo II 2026 ou um modelo personalizado de campos de texto. Confira categorias, anexos obrigatórios, limite por arquivo, instruções e aviso de privacidade.
3. Informe datas somente quando previstas no regulamento. O editor usa horário de Brasília (UTC−3); o servidor aplica a janela de recebimento. Sem datas, a abertura depende do botão de ativação.
4. Salve a configuração e envie o PDF completo oficial. O documento fornecido como referência contém apenas as páginas do Anexo II; não substitui o edital completo.
5. Valide institucionalmente as exigências e ative as inscrições. Publique o edital pelo fluxo existente. Alterações na configuração de um edital já publicado têm efeito imediato, independentemente do salvamento do conteúdo.
6. Confira os botões de download e inscrição na página pública. Para aparecer no hero, marque o destaque no editor.
7. Em **Editais e Inscrições**, consulte totais, escolha o edital e filtre por situação, início de uma palavra ou protocolo completo. A listagem carrega 25 inscrições por página. Abra os detalhes para baixar anexos, gerar a ficha e confirmar o recebimento.

A confirmação administrativa não equivale a aprovação, classificação ou concessão de prêmio. Não há classificação automática.

## Ficha e assinatura

O formulário tem identificação, síntese, anexos/declaracão e revisão. O modelo Anexo II conserva os campos e a declaração da referência. A ficha gerada mantém o brasão original, cabeçalho institucional e espaços para assinatura do responsável e ciência da gestão/coautores. O brasão conserva a resolução disponível no documento original.

O aceite eletrônico é registrado separadamente. A aplicação não inventa assinatura nem certifica uma assinatura digital. Se a instituição exigir ficha assinada, deve tornar o anexo de assinaturas obrigatório: o participante baixa o rascunho, assina e anexa antes de concluir. O PDF original enviado é preservado byte a byte após validação estrutural, sem reescrita que invalidaria assinaturas.

Categorias, prazos e documentos obrigatórios não foram deduzidos das duas páginas recebidas. O Master deve conferi-los no regulamento completo antes de ativar.

## Arquitetura e proteção

- `/inscricao/:id`: formulário público; `/administracao/inscricoes`: conferência exclusiva do Master (inclui o alias legado admin).
- `/api/editais`: API com Firebase Admin, validação de origem, perfil ativo, autenticação recente do Master, janela de abertura e manutenção.
- `editaisConfiguracao/{editalId}`: versão da configuração e metadados do PDF oficial.
- `editaisInscricoes/{editalId}`: contadores; subcoleção `inscricoes`: rascunhos, dados recebidos, configuração congelada, anexos e protocolo.
- `auditoriaRegistros`: configuração, documento oficial e confirmação; `limitesEditais`: limites de uso por dia com identificador de IP derivado por HMAC.
- As regras negam acesso direto às novas coleções, inclusive ao Master. Somente a API expõe os dados autorizados.
- Anexos ficam no B2 privado, no namespace do cliente/edital/inscrição. O PDF oficial é disponibilizado pela API somente para edital publicado. Anexos pessoais não recebem links públicos permanentes.
- O participante usa uma chave aleatória mantida apenas na memória da página. Tentativas repetidas usam o mesmo identificador; o protocolo e os contadores são confirmados em transação, sem duplicação.
- Os dados enviados não podem ser editados. Uma repetição com conteúdo diferente é rejeitada.

Não foram adicionadas credenciais. A API reutiliza as variáveis de servidor `SEDUC_CLIENTE`, `SEDUC_ADMIN_ORIGINS`, `SEDUC_ADMIN_CREDENTIALS_JSON`, `B2_ENDPOINT`, `B2_REGION`, `B2_BUCKET`, `B2_KEY_ID` e `B2_APPLICATION_KEY`. A origem oficial deve constar em `SEDUC_ADMIN_ORIGINS`. Nunca coloque as credenciais em variáveis `VITE_`, código cliente ou commits.

O navegador envia à API no mesmo domínio; a API acessa o B2. Não é necessário tornar o bucket público nem configurar CORS de acesso direto ao bucket para este módulo.

## Limites e recuperação

Os limites técnicos configuráveis são de até 20 arquivos, no máximo 2 MB cada, em PDF/JPEG/PNG/WEBP. Imagens são reduzidas e convertidas para JPEG sem metadados. PDFs devem ter de 1 a 200 páginas, não criptografados e sem ações/scripts identificados pela validação. Isso não substitui uma análise antimalware completa.

Há limites diários por IP (10 inícios, 100 uploads, 20 envios) e globais (2.000 inícios, 20.000 uploads). Redes compartilhadas podem atingir os limites: ajustar esses valores exige revisão operacional. Não há CAPTCHA externo novo.

Rascunhos expiram logicamente após 24 horas. Uma mudança da configuração exige recarregar e iniciar novamente. Fechar/recarregar a página perde a chave de consulta e os dados ainda não enviados; há aviso de saída. Depois de receber o protocolo, baixe a ficha e guarde o comprovante. Se ocorrer falha de rede, tente novamente na mesma página. Uploads interrompidos podem exigir aguardar dois minutos antes de repetir. Arquivos já reservados não têm remoção pelo participante nesta versão.

A expiração não apaga dados automaticamente. Definir retenção e rotina de limpeza de rascunhos, limites e objetos órfãos antes do uso prolongado. Não habilitar TTL nos registros de inscrições sem política de retenção aprovada. O script legado `backup:b2`, voltado à coleção de documentos, não cobre os anexos deste módulo: incluir `editaisConfiguracao`, `editaisInscricoes` com subcoleções e o namespace B2 correspondente no plano de backup e testar restauração antes de produção.

## Instalação após aprovação

1. Instale com `npm ci` em Node compatível com `package.json`.
2. Revise e publique as regras e índices de `firebase/firestore.rules` e `firebase/firestore.indexes.json` no projeto correto pelo processo existente. Aguarde os índices ficarem prontos.
3. Confira as variáveis existentes em ambiente de homologação e as permissões do B2 privado. Não use dados reais para testes.
4. Compile com `npm run build -- --cliente pedro-ii`. A Vercel inclui os módulos de servidor/shared e configura até 60 segundos para a função.
5. Execute a aceitação abaixo em homologação isolada antes de liberar em produção. Esta alteração não executa migração nem publica regras automaticamente.

## Testes locais

Requer Java 21 para o emulador atual do Firebase:

```sh
npm run test:editais
npm run test:editais:emulador
npm run build -- --cliente pedro-ii
```

Para desenvolver a interface, inicie `firebase emulators:start --only firestore,auth --project demo-seduc`, o Vite com `VITE_FIREBASE_EMULATORS=true` e a API com `SEDUC_EDITAIS_EMULADOR=true`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, usando `npm run api:editais`. No PowerShell, defina cada variável com `$env:NOME='valor'` no terminal correspondente. A API local usa armazenamento privado em `.editais-emulador`, não o B2 real. Crie apenas registros fictícios no projeto demo.

Validações executadas: build de produção; 23 testes unitários/regressão de entregas, imagens, importação de escolas e editais; dois testes integrados no Firestore Emulator, com B2 simulado, incluindo idempotência, autorização, busca por protocolo, confirmação/auditoria e falha de armazenamento. Ficha extensa gerada com 14 páginas, extração de texto e inspeção visual das duas primeiras páginas.

Pendente: fluxo visual completo em navegador e integração com B2 real em homologação. O navegador remoto não alcançou `localhost:3000` (ERR_CONNECTION_REFUSED); não foi declarado teste ponta a ponta de interface concluído.

## Aceitação em homologação

- Master cria rascunho, configura modelo, envia PDF oficial e publica; outro perfil não configura nem consulta inscrições.
- Público baixa o edital; datas fechadas/desativação bloqueiam envio também no servidor.
- No celular e desktop, preencher quatro etapas, testar campos obrigatórios, anexos inválidos, limites e aceite; revisar antes de enviar.
- Gerar ficha provisória, assinar manualmente se exigido e anexar; conferir brasão, cabeçalho, acentos e campos longos em todas as páginas.
- Interromper rede durante upload/envio; repetir na mesma página e conferir um único protocolo/contador, sem falso sucesso.
- Master busca pelo protocolo completo, pagina, abre detalhes, baixa anexos privados e confirma uma única vez com auditoria.
- Conferir regressão do hero, publicações, imagens, importação de escolas e demais módulos; verificar ausência de dados privados no cliente público.
