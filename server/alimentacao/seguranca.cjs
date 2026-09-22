const { randomUUID } = require("node:crypto");
const { FieldValue } = require("firebase-admin/firestore");
class Falha extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const GESTAO = ["master", "admin", "nutricionista", "gerente"];
function idValido(v) {
  if (typeof v !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(v))
    throw new Falha(400, "Identificador inválido.");
  return v;
}
function uuid(v) {
  if (
    typeof v !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      v,
    )
  )
    throw new Falha(400, "Identificador da operação inválido.");
  return v;
}
function autorizar(token, p, escolaId, escola, agora = Date.now()) {
  if (
    !p ||
    p.ativo === false ||
    (!GESTAO.includes(p.papel) &&
      !(
        p.papel === "diretor" &&
        escolaId !== "deposito-municipal" &&
        p.escolasVinculadas?.includes(escolaId)
      ))
  )
    throw new Falha(
      403,
      "Sua conta não tem acesso à alimentação desta unidade.",
    );
  const idade = agora / 1000 - Number(token.auth_time || 0);
  if (
    idade < 0 ||
    idade >= 28800 ||
    Number(token.auth_time || 0) < Number(p.sessaoRevogadaEm || 0)
  )
    throw new Falha(401, "Entre novamente para continuar.");
  if (!escola || escola.ativo === false)
    throw new Falha(403, "A unidade está inativa ou não existe.");
  if (escolaId === "deposito-municipal" && escola.tipoUnidade !== "deposito")
    throw new Falha(403, "Depósito inválido.");
}
async function conferir(tx, db, token, escolaId) {
  const [p, e, m] = await Promise.all([
    tx.get(db.doc("usuarios/" + token.uid)),
    tx.get(db.doc("escolas/" + escolaId)),
    tx.get(db.doc("operacao/estado")),
  ]);
  autorizar(token, p.data(), escolaId, e.data());
  if (m.data()?.bloqueado)
    throw new Falha(409, "Sistema em manutenção. Aguarde.");
  return { perfil: p.data(), escola: e.data() };
}
function auditar(tx, db, ref, antes, depois, token, perfil) {
  const audit = db.doc("auditoriaRegistros/" + randomUUID());
  const estado = {
    ...depois,
    _auditoria: audit.id,
    _registradoEm: FieldValue.serverTimestamp(),
  };
  tx.set(ref, estado);
  tx.create(audit, {
    versaoEsquema: 1,
    caminho: ref.path,
    alvo: ref,
    colecao: ref.parent.id,
    documentoId: ref.id,
    escolaId: ref.path.split("/")[1],
    dominio: "alimentacao",
    acao: antes ? "update" : "create",
    usuarioId: token.uid,
    usuarioNome: perfil.nome || "Profissional",
    papelUsuario: perfil.papel,
    dadosAntes: antes || null,
    dadosDepois: estado,
    timestamp: FieldValue.serverTimestamp(),
  });
  return estado;
}
async function limite(tx, db, token, bytes = 0) {
  const ref = db.doc("limitesAlimentacao/" + token.uid),
    s = (await tx.get(ref)).data(),
    min = Math.floor(Date.now() / 60000),
    dia = new Date().toISOString().slice(0, 10);
  const n = s?.min === min ? s.n : 0,
    total = s?.dia === dia ? s.total : 0,
    tamanho = s?.dia === dia ? s.bytes : 0;
  if (n >= 30 || total >= 400 || tamanho + bytes > 150 * 1024 * 1024)
    throw new Falha(
      429,
      "Limite de operações atingido. Aguarde ou solicite orientação à gestão.",
    );
  return () =>
    tx.set(ref, {
      min,
      n: n + 1,
      dia,
      total: total + 1,
      bytes: tamanho + bytes,
    });
}
module.exports = {
  Falha,
  idValido,
  uuid,
  autorizar,
  conferir,
  auditar,
  limite,
  GESTAO,
};
