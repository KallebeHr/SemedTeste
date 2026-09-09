export function normalizarCpf(valor) {
  return String(valor ?? "").replace(/\D/g, "");
}

export function formatarCpf(valor) {
  const cpf = normalizarCpf(valor).slice(0, 11);
  return cpf
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3}\.\d{3})(\d)/, "$1.$2")
    .replace(/(\.\d{3})(\d)/, "$1-$2");
}

export function cpfValido(valor) {
  const cpf = normalizarCpf(valor);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let tamanho = 9; tamanho <= 10; tamanho++) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++)
      soma += Number(cpf[i]) * (tamanho + 1 - i);
    const resto = soma % 11;
    if (Number(cpf[tamanho]) !== (resto < 2 ? 0 : 11 - resto)) return false;
  }
  return true;
}

export function mascararCpf(valor) {
  const cpf = normalizarCpf(valor);
  return cpf.length === 11
    ? `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`
    : "Não informado";
}

export function normalizarNome(valor) {
  return String(valor ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");
}

export function validarIdentificacao(dados) {
  const nomeSignatario = normalizarNome(dados?.nomeSignatario);
  if (
    nomeSignatario.length > 160 ||
    !/^[\p{L}\p{M}.’'-]*\p{L}[\p{L}\p{M}.’'-]*( [\p{L}\p{M}.’'-]*\p{L}[\p{L}\p{M}.’'-]*)+$/u.test(
      nomeSignatario,
    ) ||
    nomeSignatario.split(" ").filter((parte) => /\p{L}/u.test(parte)).length < 2
  ) {
    throw new Error("Informe o nome e o sobrenome, sem números.");
  }
  if (!cpfValido(dados?.cpf))
    throw new Error("Informe um CPF válido com 11 dígitos.");
  if (
    ![
      "master",
      "nutricionista",
      "gerente",
      "diretor",
      "professor",
      "admin",
      "outro",
    ].includes(dados?.papelSignatario)
  )
    throw new Error("Selecione a função da pessoa identificada.");
  return {
    nomeSignatario,
    cpf: normalizarCpf(dados.cpf),
    papelSignatario: dados.papelSignatario,
  };
}

// Resumo para histórico/PDF: o CPF completo fica apenas no registro de identificação.
export function resumirIdentificacao(payload) {
  return {
    nome: payload.nomeSignatario,
    cpfMascarado: mascararCpf(payload.cpf),
    funcao: payload.papelSignatario,
    metodo: "identificacao_cpf",
  };
}

export function validarIdentificacaoPreparada(
  identificacao,
  { escolaId, documentoId, documentoTipo, usuarioId },
) {
  const p = identificacao?.payload;
  if (
    !identificacao?.id ||
    !p ||
    p.metodo !== "identificacao_cpf" ||
    p.documentoId !== documentoId ||
    p.documentoTipo !== documentoTipo ||
    p.criadoPor !== usuarioId ||
    identificacao.referencia?.path !==
      `escolas/${escolaId}/assinaturas/${identificacao.id}` ||
    !/^[a-f0-9]{64}$/.test(p.hashDocumento || "")
  ) {
    throw new Error("Confirme a identificação vinculada a este registro.");
  }
  const dados = validarIdentificacao(p);
  if (dados.cpf !== p.cpf || dados.nomeSignatario !== p.nomeSignatario)
    throw new Error("Confira o nome e o CPF da identificação.");
  return p;
}
