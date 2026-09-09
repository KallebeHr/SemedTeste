# SEDUC · Pedro II

**Versão atual: 2.1.1.** As mudanças no botão flutuante, VLibras e menus mobile estão em `AJUSTES-INTERFACE-2.1.1.md`. Para instalar, siga `ATUALIZACAO-2.1.md`. O diagnóstico técnico e a validação da revisão anterior permanecem em `REVISAO-TECNICA.md` e `VALIDACAO.md`.

Portal público e administração escolar em Vue 3, Vuetify e Firebase. Leia **CORRECOES-RELATORIO.md**, **OPERACAO-E-RECUPERACAO.md** e **GUIA-PORTAL.md** para ativar as regras, configurar os perfis e publicar informações oficiais.

```sh
npm ci
npm run dev
```

- Portal: `/`
- Merenda pública: `/merenda-escolar`
- Equipe: `/login` → `/administracao`
- Famílias: `/atendimento` e `/boletim`
- Produção: `npm run build -- --cliente pedro-ii` → `dist`

A configuração de produção do Firebase foi mantida. Não há usuários/senhas padrão. Os testes usam apenas emuladores e dados fictícios próprios.

A versão 2 exige atualizar aplicação e regras juntas. Notas antigas têm uma migração assistida; o backup completo é cifrado e inclui Authentication. Cada instituição usa seu próprio projeto Firebase.
