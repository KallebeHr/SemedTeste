const {
  doc,
  getDoc,
  writeBatch,
  collection,
  serverTimestamp,
} = require("firebase/firestore");
const { createHash } = require("node:crypto");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const chaveNota = (componente, ano, bimestre, uid) =>
  hash(`${componente}|${ano}|${bimestre}|${uid}`);
async function loteAuditado(env, db, uid, operacoes, ajustar) {
  const b = writeBatch(db);
  let perfil;
  await env.withSecurityRulesDisabled(async (c) => {
    perfil = (await getDoc(doc(c.firestore(), "usuarios", uid))).data();
  });
  for (const op of operacoes) {
    const r = doc(db, op.path);
    let antes;
    await env.withSecurityRulesDisabled(async (c) => {
      const s = await getDoc(doc(c.firestore(), op.path));
      antes = s.exists() ? s.data() : null;
    });
    if (
      /^escolas\/[^/]+\/assinaturas\//.test(op.path) ||
      op.path.startsWith("limitesAtendimento/")
    ) {
      b.set(r, op.data);
      continue;
    }
    const ar =
      op.tipo === "delete"
        ? doc(
            db,
            "auditoriaRegistros",
            "del-" + (antes?._auditoria || hash(op.path)),
          )
        : doc(collection(db, "auditoriaRegistros"));
    const depois =
      op.tipo === "delete"
        ? null
        : {
            ...(op.tipo === "update" ? antes : {}),
            ...op.data,
            _auditoria: ar.id,
            _registradoEm: serverTimestamp(),
          };
    const partes = op.path.split("/");
    const e = {
      versaoEsquema: 1,
      caminho: op.path,
      alvo: r,
      colecao: partes.at(-2),
      documentoId: partes.at(-1),
      escolaId: ["escolas", "escolasPublicas"].includes(partes[0])
        ? partes[1]
        : null,
      dominio:
        /^escolas\/[^/]+\/(estoque|movimentacoes|vistorias|cardapios|fornecedores)\//.test(
          op.path,
        )
          ? "alimentacao"
          : "portal",
      acao: depois === null ? "delete" : antes === null ? "create" : "update",
      usuarioId: uid,
      usuarioNome: perfil?.nome || uid + "@example.test",
      papelUsuario: perfil?.papel || "cidadao",
      dadosAntes: antes,
      dadosDepois: depois,
      timestamp: serverTimestamp(),
    };
    if (ajustar) ajustar({ b, r, ar, antes, depois, e });
    else {
      if (depois === null) b.delete(r);
      else b.set(r, depois);
      b.set(ar, e);
    }
  }
  return b.commit();
}
module.exports = { loteAuditado, hash, chaveNota };
