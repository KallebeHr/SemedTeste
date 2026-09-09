# Ajustes de interface — 2.1.1

- Removida a faixa superior de acessibilidade. Os controles agora ficam em um menu aberto por ícone fixo no canto inferior esquerdo, tanto no portal quanto na administração.
- Preservados ajuste de fonte, alto contraste, leitura por voz e preferências já salvas. O menu fecha por X, Escape, clique externo ou mudança de página.
- A opção Libras ativa diretamente o VLibras Widget, sem o painel anterior de título, explicações e cópia visível do conteúdo. O isolamento do serviço e a restrição a páginas públicas foram preservados.
- Menu hambúrguer público e menu administrativo no celular agora ocupam toda a tela, têm rolagem própria e X no canto superior direito. O diálogo nativo mantém foco no menu e impede interação com o fundo enquanto aberto.
- Links e permissões anteriores foram preservados. O menu desktop permanece horizontal no portal e lateral na administração.

Validação desta alteração: análise estática e build do projeto. O roteiro local de navegador foi ajustado para abrir o novo botão de acessibilidade antes dos controles de fonte. Os 89 testes documentados na revisão 2.1.0 são evidência daquela rodada; não foram todos repetidos para esta mudança de interface. A homologação do intérprete externo e com leitores de tela continua dependente dos testes no ambiente de destino.
