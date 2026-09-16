import {
  validarCardapio,
  semanasDoMes,
  DIAS_SEMANA,
  tituloMes,
  legendaDia,
  MARCAS,
  RECORTES,
  diaUtil,
} from "./cardapioMensal";

async function carregarMarcas() {
  const imagem = new Image();
  await new Promise((resolve, reject) => {
    imagem.onload = resolve;
    imagem.onerror = () =>
      reject(
        new Error(
          "Não foi possível carregar as marcas do cardápio. Atualize a página e tente novamente.",
        ),
      );
    imagem.src = MARCAS;
  });
  return Object.fromEntries(
    Object.entries(RECORTES).map(([nome, [x, y, w, h]]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(imagem, x, y, w, h, 0, 0, w, h);
      return [nome, canvas.toDataURL("image/png")];
    }),
  );
}
// Retorna o documento para permitir visualização e testes; não faz upload.
export async function criarCardapioPdf(publicacao, escola = "") {
  const g = validarCardapio(publicacao.gradeCardapio, {
    mes: publicacao.numero,
  });
  const [{ jsPDF }, { default: autoTable }, marcas] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    carregarMarcas(),
  ]);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const largura = 269,
    margem = 14;
  const cabecalho = () => {
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(0);
    pdf.setFontSize(10.8);
    pdf.addImage(marcas.semed, "PNG", 9, 5, 36.9, 26);
    pdf.addImage(marcas.pnae, "PNG", 246.5, 7, 42.7, 23.5);
    const linhas = [
      "PREFEITURA MUNICIPAL DE PEDRO II-PIAUÍ",
      "SECRETARIA MUNICIPAL DE EDUCAÇÃO",
      "PROGRAMA NACIONAL DE ALIMENTAÇÃO ESCOLAR-PNAE",
      `${g.etapa}-${g.turno}`,
      tituloMes(g.mes),
    ];
    linhas.forEach((s, i) => {
      // Cabeçalhos extensos cabem sem invadir os logotipos.
      pdf.setFontSize(
        Math.min(
          10.8,
          (10.8 * 194) /
            Math.max(
              194,
              (pdf.getStringUnitWidth(s) * 10.8) / pdf.internal.scaleFactor,
            ),
        ),
      );
      pdf.text(s, 148.5, 8 + i * 5.6, { align: "center" });
    });
  };
  const body = [];
  for (const s of semanasDoMes(g.mes)) {
    const fill =
      s.indice % 2 === 0 && (s.indice === 0 || s.dias.every(Boolean))
        ? [240, 240, 240]
        : [255, 255, 255];
    const cell = (content, extra = {}) => ({
      content,
      styles: { fillColor: fill, ...extra },
    });
    const a = [
        { ...cell(s.rotulo, { valign: "middle" }), rowSpan: 2 },
        cell("1º", { textColor: [255, 0, 0] }),
      ],
      b = [cell("2º")];
    for (const dia of s.dias) {
      if (!dia) {
        a.push({ ...cell(""), rowSpan: 2 });
        continue;
      }
      const d = g.dias[dia - 1];
      if (d.situacao !== "letivo")
        a.push({
          ...cell(legendaDia(d), { textColor: [255, 0, 0], valign: "middle" }),
          rowSpan: 2,
        });
      else {
        a.push(
          cell(d.primeiro + (d.observacao ? " *" : ""), {
            textColor: [255, 0, 0],
          }),
        );
        b.push(cell(d.segundo, { minCellHeight: 17.5 }));
      }
    }
    body.push(a, b);
  }
  autoTable(pdf, {
    startY: 33,
    head: [["DIA", "LANCHES", ...DIAS_SEMANA]],
    body,
    margin: { left: margem, right: margem, top: 33, bottom: 12 },
    tableWidth: largura,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 10.8,
      cellPadding: { top: 0.15, bottom: 0.15, left: 1, right: 1 },
      halign: "center",
      valign: "top",
      lineWidth: 0.18,
      lineColor: [0, 0, 0],
      textColor: [0, 0, 0],
      overflow: "linebreak",
    },
    headStyles: {
      fontStyle: "normal",
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
    },
    columnStyles: Object.fromEntries(
      [6.5, 10.3, 13.1, 24.3, 13.1, 16.8, 15.9].map((v, i) => [
        i,
        { cellWidth: (largura * v) / 100 },
      ]),
    ),
    rowPageBreak: "avoid",
    willDrawPage: cabecalho,
  });
  const notas = [];
  if (g.observacoes)
    notas.push([
      {
        content: g.observacoes,
        styles: { fontStyle: "bold", halign: "center", fontSize: 9.6 },
      },
    ]);
  g.dias.forEach((d, i) => {
    if (d.observacao && diaUtil(g.mes, i + 1))
      notas.push([
        `* ${String(i + 1).padStart(2, "0")}/${g.mes.slice(5)} — ${d.observacao}`,
      ]);
  });
  if (escola) notas.push([`Escola: ${escola}`]);
  if (publicacao.local)
    notas.push([`Responsável técnico: ${publicacao.local}`]);
  if (notas.length)
    autoTable(pdf, {
      startY: pdf.lastAutoTable.finalY + 5,
      body: notas,
      theme: "plain",
      margin: { left: margem, right: margem, top: 12, bottom: 12 },
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 1.3,
        textColor: [0, 0, 0],
        overflow: "linebreak",
      },
      rowPageBreak: "avoid",
    });
  const total = pdf.internal.getNumberOfPages();
  if (total > 1)
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(70);
      pdf.text(`${tituloMes(g.mes)} · ${i}/${total}`, 283, 205, {
        align: "right",
      });
    }
  return pdf;
}
export async function baixarCardapioPdf(publicacao, escola = "") {
  const pdf = await criarCardapioPdf(publicacao, escola);
  const nome = (escola || publicacao.titulo || "escola")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 65);
  pdf.save(`cardapio-${publicacao.numero}-${nome}.pdf`);
}
