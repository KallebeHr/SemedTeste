const { createHash } = require("node:crypto");
const {
  FieldValue,
  FieldPath,
  Timestamp,
} = require("firebase-admin/firestore");
const {
  Falha,
  idValido,
  uuid,
  conferir,
  auditar,
  limite,
  GESTAO,
} = require("./seguranca.cjs");
const { cpfValido, nomeValido } = require("../../shared/protocolo-af.mjs");
const DEPOSITO = "deposito-municipal";
const MOTIVOS = [
  "quantidade diferente",
  "produto danificado",
  "produto vencido",
  "embalagem violada",
  "item não recebido",
  "produto diferente",
  "outro",
];
const digest = (d) =>
  createHash("sha256").update(JSON.stringify(d)).digest("hex");
function texto(v = "", max = 3000) {
  if (typeof v !== "string" || v.length > max)
    throw new Falha(400, "Texto inválido ou muito longo.");
  return v.trim();
}
function quantidade(n, zero = false) {
  if (
    typeof n !== "number" ||
    !Number.isFinite(n) ||
    n < (zero ? 0 : 0.000001) ||
    n > 1e9 ||
    Math.abs(n - Math.round(n * 1e6) / 1e6) > Number.EPSILON * Math.max(1, n)
  )
    throw new Falha(
      400,
      "Quantidade inválida: utilize até seis casas decimais.",
    );
  return n;
}
function saldo(a, delta) {
  return quantidade(
    Math.round((quantidade(a, true) + delta) * 1e6) / 1e6,
    true,
  );
}
function pessoa(d) {
  const nome = texto(d?.nome, 160),
    cpf = String(d?.cpf || "").replace(/\D/g, "");
  if (!nomeValido(nome) || !cpfValido(cpf))
    throw new Falha(400, "Informe nome completo e CPF válido do responsável.");
  return { nome, cpf };
}
function fotos(v = []) {
  if (!Array.isArray(v) || v.length > 6 || new Set(v).size !== v.length)
    throw new Falha(400, "Escolha até seis comprovantes diferentes.");
  return v.map(uuid);
}
function itensEnvio(v) {
  if (!Array.isArray(v) || !v.length || v.length > 20)
    throw new Falha(400, "Inclua de 1 a 20 produtos.");
  const itens = v.map((i) => {
    if (!i || typeof i !== "object") throw new Falha(400, "Produto inválido.");
    return {
      itemId: idValido(i.itemId),
      quantidade: quantidade(i.quantidade),
      lote: texto(i.lote, 100),
      observacao: texto(i.observacao, 500),
    };
  });
  if (new Set(itens.map((i) => i.itemId)).size !== itens.length)
    throw new Falha(
      400,
      "Reúna as quantidades do mesmo item em uma única linha.",
    );
  return itens;
}
async function anexos(tx, db, escolaId, ids, uid) {
  const docs = await Promise.all(
    ids.map((id) => tx.get(db.doc(`escolas/${escolaId}/documentos/${id}`))),
  );
  if (
    docs.some(
      (s) =>
        !s.exists ||
        s.data().estado !== "pronto" ||
        s.data().arquivado ||
        s.data().vinculo ||
        s.data().criadoPor !== uid,
    )
  )
    throw new Falha(
      409,
      "Os comprovantes precisam estar enviados, livres e pertencer à sua conta nesta escola.",
    );
  return docs;
}
function vincular(tx, db, docs, id, token, perfil) {
  docs.forEach((s) =>
    auditar(
      tx,
      db,
      s.ref,
      s.data(),
      { ...s.data(), vinculo: { tipo: "entregas", id } },
      token,
      perfil,
    ),
  );
}
function identificacao(tx, db, base, id, etapa, p, token) {
  tx.create(db.doc(`${base}/entregaIdentificacoes/${id}-${etapa}`), {
    ...p,
    entregaId: id,
    etapa,
    criadoPor: token.uid,
    criadoEm: FieldValue.serverTimestamp(),
  });
}
function registrarEstoque(
  tx,
  db,
  escolaId,
  item,
  dados,
  delta,
  entrega,
  etapa,
  token,
  perfil,
  responsavel,
) {
  const ref = db.doc(`escolas/${escolaId}/estoque/${item}`);
  const mov = db.doc(
    `escolas/${escolaId}/movimentacoes/${entrega.id}-${etapa}-${item}`,
  );
  const anterior = dados.quantidadeAtual || 0,
    resultante = saldo(anterior, delta);
  auditar(
    tx,
    db,
    ref,
    dados._novo ? null : dados,
    {
      ...Object.fromEntries(
        Object.entries(dados).filter(([k]) => k !== "_novo"),
      ),
      quantidadeAtual: resultante,
      ultimaMovimentacaoId: mov.id,
      atualizadoPor: token.uid,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    token,
    perfil,
  );
  if (delta !== 0)
    auditar(
      tx,
      db,
      mov,
      null,
      {
        tipo:
          delta < 0 ? "saida" : etapa === "cancelar" ? "estorno" : "entrada",
        itemId: item,
        itemNome: dados.nome,
        unidade: dados.unidade,
        quantidade: Math.abs(delta),
        quantidadeAnterior: anterior,
        quantidadeResultante: resultante,
        motivo: `Entrega ${entrega.codigo} · ${etapa}`,
        observacoes: "",
        entregaId: entrega.id,
        responsavelId: token.uid,
        responsavelNome: responsavel,
        registradoPorNome: perfil.nome || "Profissional",
        metodoConfirmacao: "identificacao_cpf",
        data: FieldValue.serverTimestamp(),
      },
      token,
      perfil,
    );
}
function serializar(v) {
  if (v?.toDate) return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(serializar);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v)
        .filter(([k]) => !k.startsWith("_") && !k.startsWith("digest"))
        .map(([k, x]) => [k, serializar(x)]),
    );
  return v;
}
async function executarEntrega({ db, token, b, perfil }) {
  const escolaId = idValido(b.escolaId),
    base = `escolas/${escolaId}`;
  if (b.acao === "resumoEntregas") {
    const q =
      escolaId === DEPOSITO && GESTAO.includes(perfil.papel)
        ? db.collectionGroup("entregas")
        : db.collection(`${base}/entregas`);
    const dia = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Sao_Paulo",
    });
    const inicio = Timestamp.fromDate(new Date(dia + "T00:00:00-03:00"));
    const [hoje, pendentes, divergencias] = await Promise.all([
      q.where("criadoEm", ">=", inicio).count().get(),
      q.where("status", "==", "enviado").count().get(),
      q.where("divergencia.status", "==", "aberta").count().get(),
    ]);
    return {
      hoje: hoje.data().count,
      pendentes: pendentes.data().count,
      divergencias: divergencias.data().count,
    };
  }
  if (b.acao === "listarEntregas") {
    const gestao = GESTAO.includes(perfil.papel);
    let q =
      escolaId === DEPOSITO && gestao
        ? db.collectionGroup("entregas")
        : db.collection(`${base}/entregas`);
    if (b.status) {
      if (!["enviado", "recebido", "cancelado"].includes(b.status))
        throw new Falha(400, "Status inválido.");
      q = q.where("status", "==", b.status);
    }
    q = q.orderBy("criadoEm", "desc").orderBy(FieldPath.documentId(), "desc");
    if (b.cursor) {
      if (
        !/^escolas\/[a-zA-Z0-9_-]{1,128}\/entregas\/[0-9a-f-]{36}$/.test(
          b.cursor,
        ) ||
        (escolaId !== DEPOSITO && !b.cursor.startsWith(base + "/"))
      )
        throw new Falha(400, "Página inválida.");
      const s = await db.doc(b.cursor).get();
      if (!s.exists) throw new Falha(409, "Atualize o histórico.");
      q = q.startAfter(s);
    }
    const busca = texto(b.busca, 160).toLocaleLowerCase("pt-BR");
    for (const data of [b.de, b.ate])
      if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data))
        throw new Falha(400, "Período inválido.");
    const s = await q.limit(101).get(),
      pagina = [];
    let ultimo = null,
      processados = 0;
    for (const doc of s.docs.slice(0, 100)) {
      processados++;
      ultimo = doc.ref.path;
      const d = serializar(doc.data());
      const dia = doc
        .data()
        .criadoEm.toDate()
        .toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      if (
        (b.de && dia < b.de) ||
        (b.ate && dia > b.ate) ||
        (b.divergencia && d.divergencia?.status !== b.divergencia)
      )
        continue;
      if (
        busca &&
        ![
          d.codigo,
          d.codigoRecebimento,
          d.escolaNome,
          d.enviadoPorNome,
          d.recebidoPorNome,
          d.responsavelEnvio,
          d.responsavelRecebimento,
          ...d.itens.map((i) => i.nome),
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(busca)
      )
        continue;
      pagina.push({ ...d, id: doc.id });
      if (pagina.length === 20) break;
    }
    return { registros: pagina, cursor: s.size > processados ? ultimo : null };
  }
  if (escolaId === DEPOSITO)
    throw new Falha(400, "Selecione uma escola de destino.");
  const id = uuid(b.id),
    ref = db.doc(`${base}/entregas/${id}`);
  if (b.acao === "detalharEntrega") {
    const s = await ref.get();
    if (!s.exists) throw new Falha(404, "Entrega não encontrada.");
    return { ...serializar(s.data()), id };
  }
  return db.runTransaction(async (tx) => {
    const { perfil: p, escola } = await conferir(tx, db, token, escolaId);
    const s = await tx.get(ref),
      antes = s.data();
    if (b.acao === "enviarEntrega") {
      if (!GESTAO.includes(p.papel))
        throw new Falha(
          403,
          "Somente a gestão do estoque pode registrar envios.",
        );
      await conferir(tx, db, token, DEPOSITO);
      const itens = itensEnvio(b.itens),
        comprovantes = fotos(b.fotos),
        responsavel = pessoa(b.responsavel),
        observacao = texto(b.observacao);
      const hash = digest({ itens, comprovantes, responsavel, observacao });
      if (s.exists) {
        if (antes.enviadoPor !== token.uid || antes.digestEnvio !== hash)
          throw new Falha(
            409,
            "Esta operação já foi utilizada com outros dados.",
          );
        return { id, codigo: antes.codigo, repetido: true };
      }
      const estoques = await Promise.all(
        itens.map((i) =>
          tx.get(db.doc(`escolas/${DEPOSITO}/estoque/${i.itemId}`)),
        ),
      );
      const docs = await anexos(tx, db, escolaId, comprovantes, token.uid);
      const ano = new Date().getUTCFullYear(),
        contadorRef = db.doc(`contadoresAlimentacao/${ano}`),
        contador = await tx.get(contadorRef);
      const numero = (contador.data()?.numero || 0) + 1,
        codigo = `AE-${ano}-${String(numero).padStart(6, "0")}`;
      const dadosItens = itens.map((i, n) => {
        const d = estoques[n].data();
        if (
          !d ||
          d.ativo === false ||
          !["kg", "l", "un", "cx", "pct"].includes(d.unidade)
        )
          throw new Falha(
            409,
            "Produto inexistente, inativo ou unidade inválida.",
          );
        if (quantidade(d.quantidadeAtual, true) < i.quantidade)
          throw new Falha(409, `Estoque insuficiente: ${d.nome}.`);
        if (d.lote && i.lote && d.lote !== i.lote)
          throw new Falha(409, "O lote deve corresponder ao item do depósito.");
        return {
          ...i,
          lote: i.lote || d.lote || "",
          nome: d.nome,
          unidade: d.unidade,
          validade: d.validade || null,
          categoria: d.categoria || "",
          precoUnitario: d.precoUnitario || 0,
        };
      });
      const reg = await limite(tx, db, token);
      reg();
      tx.set(contadorRef, { numero });
      const entrega = { id, codigo };
      dadosItens.forEach((i, n) =>
        registrarEstoque(
          tx,
          db,
          DEPOSITO,
          i.itemId,
          estoques[n].data(),
          -i.quantidade,
          entrega,
          "enviar",
          token,
          p,
          responsavel.nome,
        ),
      );
      auditar(
        tx,
        db,
        ref,
        null,
        {
          codigo,
          escolaId,
          escolaNome: escola.nome,
          origemId: DEPOSITO,
          origemNome: "Depósito Municipal",
          status: "enviado",
          itens: dadosItens,
          fotosEnvio: comprovantes,
          fotosRecebimento: [],
          observacao,
          enviadoPor: token.uid,
          enviadoPorNome: p.nome || "Profissional",
          responsavelEnvio: responsavel.nome,
          criadoEm: FieldValue.serverTimestamp(),
          digestEnvio: hash,
          divergencia: null,
        },
        token,
        p,
      );
      identificacao(tx, db, base, id, "enviar", responsavel, token);
      vincular(tx, db, docs, id, token, p);
      return entrega;
    }
    if (!s.exists) throw new Falha(404, "Entrega não encontrada.");
    if (b.acao === "receberEntrega") {
      const responsavel = pessoa(b.responsavel),
        comprovantes = fotos(b.fotos),
        observacao = texto(b.observacao);
      if (!Array.isArray(b.itens) || b.itens.length !== antes.itens.length)
        throw new Falha(400, "Confira todos os produtos.");
      const recebidos = b.itens.map((i, n) => {
        if (!i || typeof i !== "object")
          throw new Falha(400, "Produto inválido.");
        const original = antes.itens[n],
          q = quantidade(i.quantidadeRecebida, true);
        if (i.itemId !== original.itemId || q > original.quantidade)
          throw new Falha(
            400,
            "A quantidade recebida deve estar entre zero e a quantidade enviada.",
          );
        const motivo = texto(i.motivo, 100),
          detalhe = texto(i.detalhe, 500);
        if (
          (q !== original.quantidade || motivo) &&
          (!MOTIVOS.includes(motivo) || (motivo === "outro" && !detalhe))
        )
          throw new Falha(400, "Informe o motivo de cada divergência.");
        return {
          itemId: i.itemId,
          destinoItemId: i.destinoItemId
            ? idValido(i.destinoItemId)
            : `transf-${i.itemId}`,
          quantidadeRecebida: q,
          motivo,
          detalhe,
        };
      });
      if (
        new Set(recebidos.map((i) => i.destinoItemId)).size !== recebidos.length
      )
        throw new Falha(
          400,
          "Não reúna dois produtos no mesmo item de destino.",
        );
      const hash = digest({ recebidos, responsavel, comprovantes, observacao });
      if (antes.status === "recebido") {
        if (antes.recebidoPor !== token.uid || antes.digestRecebimento !== hash)
          throw new Falha(
            409,
            "O recebimento já foi confirmado. Atualize o histórico.",
          );
        return { id, repetido: true };
      }
      if (antes.status !== "enviado")
        throw new Falha(409, "Esta entrega não aguarda recebimento.");
      const estoques = await Promise.all(
        recebidos.map((i) =>
          tx.get(db.doc(`${base}/estoque/${i.destinoItemId}`)),
        ),
      );
      const docs = await anexos(tx, db, escolaId, comprovantes, token.uid);
      const dados = recebidos.map((i, n) => {
        const d = estoques[n].data(),
          origem = antes.itens[n];
        if (
          d &&
          (d.ativo === false ||
            d.unidade !== origem.unidade ||
            d.nome !== origem.nome ||
            (d.lote || "") !== origem.lote ||
            JSON.stringify(serializar(d.validade || null)) !==
              JSON.stringify(serializar(origem.validade)))
        )
          throw new Falha(
            409,
            `O item de destino de ${origem.nome} precisa ter o mesmo nome, unidade, lote e validade. Selecione um novo item.`,
          );
        return (
          d || {
            _novo: true,
            nome: origem.nome,
            unidade: origem.unidade,
            categoria: origem.categoria,
            validade: origem.validade,
            lote: origem.lote,
            precoUnitario: origem.precoUnitario,
            quantidadeAtual: 0,
            quantidadeMinima: 0,
            localArmazenamento: "",
            ativo: true,
          }
        );
      });
      const reg = await limite(tx, db, token);
      reg();
      recebidos.forEach((i, n) => {
        if (i.quantidadeRecebida > 0)
          registrarEstoque(
            tx,
            db,
            escolaId,
            i.destinoItemId,
            dados[n],
            i.quantidadeRecebida,
            { id, codigo: antes.codigo },
            "receber",
            token,
            p,
            responsavel.nome,
          );
      });
      const temDivergencia = recebidos.some(
        (i, n) =>
          i.motivo || i.quantidadeRecebida !== antes.itens[n].quantidade,
      );
      auditar(
        tx,
        db,
        ref,
        antes,
        {
          ...antes,
          status: "recebido",
          codigoRecebimento: antes.codigo.replace("AE-", "AR-"),
          recebidos,
          responsavelRecebimento: responsavel.nome,
          recebidoPor: token.uid,
          recebidoPorNome: p.nome || "Profissional",
          recebidoEm: FieldValue.serverTimestamp(),
          fotosRecebimento: comprovantes,
          observacaoRecebimento: observacao,
          digestRecebimento: hash,
          divergencia: temDivergencia
            ? {
                status: "aberta",
                registradoPor: token.uid,
                registradoEm: FieldValue.serverTimestamp(),
              }
            : null,
        },
        token,
        p,
      );
      identificacao(tx, db, base, id, "receber", responsavel, token);
      vincular(tx, db, docs, id, token, p);
      return { id };
    }
    if (b.acao === "cancelarEntrega") {
      if (!GESTAO.includes(p.papel))
        throw new Falha(403, "Somente a gestão pode cancelar.");
      await conferir(tx, db, token, DEPOSITO);
      const motivo = texto(b.motivo, 1000);
      if (!motivo) throw new Falha(400, "Informe o motivo do cancelamento.");
      if (antes.status === "cancelado") return { id, repetido: true };
      if (antes.status !== "enviado")
        throw new Falha(
          409,
          "Uma entrega recebida não pode ser cancelada. Registre uma operação corretiva.",
        );
      const estoques = await Promise.all(
        antes.itens.map((i) =>
          tx.get(db.doc(`escolas/${DEPOSITO}/estoque/${i.itemId}`)),
        ),
      );
      if (estoques.some((s) => !s.exists))
        throw new Falha(409, "Item de origem não encontrado.");
      const reg = await limite(tx, db, token);
      reg();
      antes.itens.forEach((i, n) =>
        registrarEstoque(
          tx,
          db,
          DEPOSITO,
          i.itemId,
          estoques[n].data(),
          i.quantidade,
          { id, codigo: antes.codigo },
          "cancelar",
          token,
          p,
          p.nome || "Profissional",
        ),
      );
      auditar(
        tx,
        db,
        ref,
        antes,
        {
          ...antes,
          status: "cancelado",
          motivoCancelamento: motivo,
          canceladoPor: token.uid,
          canceladoEm: FieldValue.serverTimestamp(),
        },
        token,
        p,
      );
      return { id };
    }
    if (b.acao === "resolverDivergencia") {
      if (!GESTAO.includes(p.papel))
        throw new Falha(403, "Somente a gestão pode encerrar divergências.");
      const resolucao = texto(b.resolucao, 2000);
      if (!resolucao || !antes.divergencia)
        throw new Falha(400, "Descreva a providência adotada.");
      if (antes.divergencia.status === "resolvida")
        return { id, repetido: true };
      const reg = await limite(tx, db, token);
      reg();
      auditar(
        tx,
        db,
        ref,
        antes,
        {
          ...antes,
          divergencia: {
            ...antes.divergencia,
            status: "resolvida",
            resolucao,
            resolvidoPor: token.uid,
            resolvidoEm: FieldValue.serverTimestamp(),
          },
        },
        token,
        p,
      );
      return { id };
    }
    throw new Falha(400, "Ação de entrega desconhecida.");
  });
}
module.exports = { executarEntrega, quantidade, saldo, itensEnvio, MOTIVOS };
