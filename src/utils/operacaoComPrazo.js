// Limita a espera da interface. Uma confirmação já em trânsito pode terminar no servidor.
// conferirAtiva impede iniciar novas leituras/escritas depois do prazo.
export async function executarComPrazo(
  acao,
  {
    mensagem = "O banco não confirmou a operação. Tente novamente nesta tela.",
    codigo = "operacao/timeout",
    limiteMs = 45000,
  } = {},
) {
  let ativa = true;
  let prazo;
  const falha = () =>
    Object.assign(new Error(`${mensagem} (${codigo})`), { code: codigo });
  const conferirAtiva = () => {
    if (!ativa) throw falha();
  };
  const limite = new Promise((_, reject) => {
    prazo = setTimeout(() => {
      ativa = false;
      reject(falha());
    }, limiteMs);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => acao(conferirAtiva)),
      limite,
    ]);
  } finally {
    ativa = false;
    clearTimeout(prazo);
  }
}
