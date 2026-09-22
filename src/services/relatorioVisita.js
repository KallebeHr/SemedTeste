import { PERGUNTAS } from "../../shared/protocolo-af.mjs";
export async function exportarVisita(v) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const pdf = new jsPDF();
  pdf.setFontSize(14);
  pdf.text("SEMED - PEDRO II", 14, 18);
  pdf.setFontSize(11);
  pdf.text("Protocolo de visita - Agricultura Familiar", 14, 26);
  autoTable(pdf, {
    startY: 32,
    theme: "grid",
    body: [
      ["Escola", v.escolaNome],
      ["Data da visita", v.dataVisita.split("-").reverse().join("/")],
      ["Lanche do dia", v.lanche],
      [
        "Resultado",
        v.resultado === "sem_pendencias"
          ? "Sem pendências apontadas"
          : "Com pontos de atenção",
      ],
      ["Protocolo", v.id],
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 36 } },
  });
  autoTable(pdf, {
    startY: pdf.lastAutoTable.finalY + 6,
    head: [["Pergunta", "Resposta", "Observações"]],
    body: PERGUNTAS.map((p, i) => [
      `${i + 1}. ${p}`,
      v.respostas[i].resposta === "sim" ? "Sim" : "Não",
      v.respostas[i].observacao || "—",
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [0, 112, 101] },
    columnStyles: { 0: { cellWidth: 95 }, 1: { cellWidth: 18 } },
  });
  autoTable(pdf, {
    startY: pdf.lastAutoTable.finalY + 6,
    body: [
      ["Plano de ação", v.planoDeAcao || "Não informado"],
      ["Acompanhamento", v.acompanhamento?.texto || "Sem atualização"],
      [
        "Responsável pela visita",
        v.responsavel.nome + " - " + v.responsavel.cpfMascarado,
      ],
      [
        "Diretor(a) / acompanhante",
        v.acompanhante.nome + " - " + v.acompanhante.cpfMascarado,
      ],
      ["Registrado por", v.criadoPorNome],
      [
        "Arquivos anexados",
        (v.documentos || []).length +
          " arquivo(s) na criação do protocolo. Outros anexos podem constar no sistema.",
      ],
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 48 } },
  });
  for (let i = 1; i <= pdf.getNumberOfPages(); i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.text(
      "Transcrição revisada. Consulte os documentos originais anexados. Página " +
        i,
      14,
      290,
    );
  }
  pdf.save("visita-af-" + v.dataVisita + "-" + v.id.slice(0, 8) + ".pdf");
}
