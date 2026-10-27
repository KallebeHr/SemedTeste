# Calendário Escolar

Acesse `/calendario`. A base integral de 2026 do anexo está em `src/data/calendario2026.json`: 365 dias, 45 eventos, sobreposições e quantitativos oficiais preservados. A agenda antiga permanece disponível em “Outros eventos e publicações do portal”. O total de 202 dias é documental, sem inferência a partir dos dias úteis.

## Ativar a gestão Master

Publique as regras revisadas antes de usar o painel (isso requer uma sessão Firebase autorizada):

```
npx firebase-tools deploy --only firestore:rules --project recallapp-14074
```

O deploy da Vercel não publica regras do Firebase. Sem elas, o site consulta a base 2026 incluída, mas salvar/publicar pelo Master será recusado pelo Firestore.

## Operação

No menu Master, “Calendários escolares” (`/administracao/calendarios`), escolha “Prévia do arquivo 2026”, confira e salve o rascunho. Depois clique em “Publicar versão conferida”. Para outro ano, importe um JSON completo no mesmo formato ou crie um ano em branco. Dias de anos novos começam sem atividade indicada: classifique-os explicitamente. Categorias adicionais podem ser definidas no JSON, com identificador, rótulo e cor hexadecimal.

Os eventos são editados por formulário. Selecione um dia na grade para alterar a classificação visual. Ao alterar intervalos ou excluir eventos, os vínculos dos dias são recalculados sem modificar sua classificação documental. As cores dos dias são independentes dos eventos que se sobrepõem a eles.

Importações rejeitam dias ausentes/duplicados, anos incorretos, eventos repetidos, referências inconsistentes, datas inválidas, cores inseguras e arquivos acima de 300 KB. O ano identifica o único rascunho e a única publicação, sem registros duplicados. Transações verificam versão para impedir sobrescritas concorrentes. Alterações ficam privadas até a publicação. A publicação copia a versão salva, não o formulário local.

Cada gravação usa a transação de auditoria existente, com estado anterior/posterior, autor e horário. Regras permitem rascunhos e escritas somente ao Master e exigem auditoria atômica. A coleção pública contém somente o snapshot publicado. As novas coleções são `calendariosEscolares` e `calendariosPublicos`; inclua-as em processos de exportação que usem listas fixas de coleções.

A base 2026 incluída é fallback somente quando não é possível consultar uma revisão publicada. Mensagens na página identificam esse caso. Nenhum rascunho é usado como fallback público.

## Verificação

```
node --test tests/calendario/modelo.test.mjs
npm run build -- --cliente pedro-ii
```
