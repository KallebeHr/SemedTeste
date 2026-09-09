import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

const rotulos = {
  conforme: "Conforme",
  conforme_com_ressalvas: "Conforme com ressalvas",
  nao_conforme: "Não conforme",
  nao_aplicavel: "Não se aplica",
  recebimento: "Recebimento",
  sanitaria: "Sanitária",
  estrutural: "Estrutural",
  rotina: "Rotina",
  entrada: "Entrada",
  saida: "Saída",
  perda: "Perda / descarte",
  estorno: "Estorno",
};
function rotulo(valor) {
  return (
    rotulos[valor] || String(valor || "Não informado").replaceAll("_", " ")
  );
}
function data(valor) {
  const d = valor?.toDate ? valor.toDate() : valor ? new Date(valor) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleString("pt-BR")
    : "Não informada";
}
function nomeArquivo(prefixo, escolaNome) {
  return `${prefixo}-${String(escolaNome || "escola")
    .replace(/[^\p{L}\p{N} -]/gu, "")
    .slice(0, 80)}-${Date.now()}.pdf`;
}
function cabecalho(pdf, titulo, escolaNome) {
  pdf.setFontSize(14);
  pdf.text("Secretaria Municipal de Educação - Pedro II/PI", 14, 15);
  pdf.setFontSize(11);
  pdf.text(titulo, 14, 22);
  pdf.setFontSize(9);
  pdf.setTextColor(100);
  const linhas = pdf.splitTextToSize(
    `Escola: ${escolaNome} | Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    180,
  );
  pdf.text(linhas, 14, 28);
  pdf.setTextColor(0);
  return 34 + (linhas.length - 1) * 4;
}
const tabela = {
  styles: { fontSize: 8, overflow: "linebreak" },
  headStyles: { fillColor: [0, 123, 116] },
  margin: { top: 15, bottom: 15 },
};
export function useRelatorios() {
  function gerarRelatorioEstoque(itens, escolaNome) {
    const pdf = new jsPDF(),
      startY = cabecalho(pdf, "Relatório de Posição de Estoque", escolaNome);
    autoTable(pdf, {
      ...tabela,
      startY,
      head: [
        ["Item", "Categoria", "Qtd. atual", "Mínimo", "Unidade", "Validade"],
      ],
      body: itens.map((i) => [
        i.nome,
        rotulo(i.categoria),
        i.quantidadeAtual,
        i.quantidadeMinima,
        i.unidade,
        i.validade ? data(i.validade).split(",")[0] : "Não informada",
      ]),
    });
    pdf.save(nomeArquivo("estoque", escolaNome));
  }
  function gerarRelatorioMovimentacoes(
    movimentacoes,
    escolaNome,
    periodo = "",
  ) {
    const pdf = new jsPDF(),
      startY = cabecalho(
        pdf,
        `Relatório de Movimentações ${periodo}`,
        escolaNome,
      );
    autoTable(pdf, {
      ...tabela,
      startY,
      head: [["Data", "Tipo / item", "Qtd.", "Responsável / CPF", "Motivo"]],
      body: movimentacoes.map((m) => [
        data(m.data),
        `${rotulo(m.tipo)}\n${m.itemNome || ""}`,
        m.quantidade,
        `${m.identificacaoResponsavel?.nome || m.responsavelNome || "Não informado"}\n${m.identificacaoResponsavel?.cpfMascarado || "Registro anterior"}`,
        m.motivo || "Não informado",
      ]),
    });
    pdf.save(nomeArquivo("movimentacoes", escolaNome));
  }
  function gerarRelatorioVistoria(vistoria, escolaNome) {
    const pdf = new jsPDF(),
      startY = cabecalho(
        pdf,
        `Relatório de Vistoria - ${rotulo(vistoria.tipo)}`,
        escolaNome,
      );
    autoTable(pdf, {
      ...tabela,
      startY,
      theme: "plain",
      body: [
        ["Data", data(vistoria.data)],
        [
          "Resultado",
          `${rotulo(vistoria.status)} | Nota: ${vistoria.notaGeral == null ? "Não se aplica" : vistoria.notaGeral + "/10"}`,
        ],
      ],
    });
    autoTable(pdf, {
      ...tabela,
      startY: pdf.lastAutoTable.finalY + 5,
      head: [["Item verificado", "Status", "Observação"]],
      body: (vistoria.checklist || []).map((c) => [
        c.item || "Não informado",
        rotulo(c.status),
        c.observacao || "—",
      ]),
    });
    if (vistoria.planoDeAcao)
      autoTable(pdf, {
        ...tabela,
        startY: pdf.lastAutoTable.finalY + 8,
        head: [["Plano de ação"]],
        body: [[vistoria.planoDeAcao]],
      });
    const pessoas = [
      ["Responsável", vistoria.identificacaoResponsavel],
      ["Testemunha", vistoria.identificacaoTestemunha],
    ];
    if (vistoria.metodoConfirmacao === "identificacao_cpf") {
      autoTable(pdf, {
        ...tabela,
        startY: pdf.lastAutoTable.finalY + 8,
        head: [["Participação", "Nome completo", "CPF", "Função"]],
        body: pessoas.map(([tipo, pessoa]) => [
          tipo,
          pessoa?.nome || "Não informado",
          pessoa?.cpfMascarado || "Não informado",
          rotulo(pessoa?.funcao),
        ]),
      });
    } else {
      autoTable(pdf, {
        ...tabela,
        startY: pdf.lastAutoTable.finalY + 8,
        theme: "plain",
        body: [
          ["Responsável", vistoria.responsavelNome || "Não informado"],
          [
            "Identificação",
            "Registro anterior à confirmação por nome e CPF. As referências de assinatura originais foram preservadas.",
          ],
        ],
      });
    }
    pdf.save(nomeArquivo("vistoria", escolaNome));
  }
  return {
    gerarRelatorioEstoque,
    gerarRelatorioMovimentacoes,
    gerarRelatorioVistoria,
  };
}
