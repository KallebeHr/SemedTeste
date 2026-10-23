import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import brasao from "./brasao.mjs";
import { campos, DECLARACAO, SEMINARIO } from "../../../shared/editais.mjs";
export function gerarFicha(registro, { rascunho = false } = {}) {
  const pdf = new jsPDF(),
    c = registro.config,
    d = registro.dados || {},
    anexo = c.modelo === "anexo-ii-2026";
  const body = campos(c).map((f) => [f.label, d[f.id] || "Não informado"]);
  body.push([
    "Declaração",
    registro.declaracao ||
      (anexo
        ? DECLARACAO
        : "Declaro que as informações prestadas são verdadeiras e que li o regulamento e o aviso de privacidade."),
  ]);
  body.push([
    "Aceite eletrônico",
    registro.aceiteEm
      ? new Date(registro.aceiteEm).toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }) +
        " (horário de Brasília). Não substitui assinatura ou ciência exigida."
      : "Ainda não registrado.",
  ]);
  if (anexo) {
    body.push(
      [
        "Assinatura do responsável",
        "________________________________________________",
      ],
      [
        "Ciência da gestão escolar",
        "________________________________________________",
      ],
      [
        "Ciência dos coautores, quando houver",
        "________________________________________________",
      ],
    );
  }
  body.push([
    "Informações administrativas",
    rascunho
      ? "Rascunho para conferência e coleta de assinaturas. Ainda não constitui inscrição enviada."
      : `Protocolo: ${registro.protocolo}\nEnviada em: ${new Date(registro.criadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília)\nSituação: ${registro.status === "confirmada" ? "Confirmada" : "Recebida — aguardando conferência"}${registro.confirmadoEm ? "\nConfirmação: " + new Date(registro.confirmadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : ""}`,
  ]);
  autoTable(pdf, {
    startY: 65,
    margin: { top: 65, bottom: 18, left: 18, right: 18 },
    head: [
      [
        anexo
          ? "Anexo II — Ficha de inscrição da boa prática"
          : "Ficha de inscrição",
        c.nome || SEMINARIO,
      ],
    ],
    body,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 3,
      overflow: "linebreak",
      valign: "top",
    },
    columnStyles: { 0: { cellWidth: 53 }, 1: { cellWidth: 121 } },
    headStyles: { fillColor: [27, 71, 65] },
    rowPageBreak: "auto",
    didDrawPage: () => {
      pdf.addImage(brasao, "JPEG", 18, 10, 14, 18);
      pdf.setFont("times", "bold");
      pdf.setFontSize(11);
      pdf.text("PREFEITURA MUNICIPAL DE PEDRO II", 120, 14, {
        align: "center",
      });
      pdf.text("“PALÁCIO DA OPALA”", 120, 20, { align: "center" });
      pdf.setFont("times", "normal");
      pdf.setFontSize(10);
      pdf.text("Praça Domingos Mourão Filho, 345, Centro", 120, 26, {
        align: "center",
      });
      pdf.text("CEP: 64.255-000 — CNPJ: 06.553.929/0001-24", 120, 32, {
        align: "center",
      });
      pdf.setFontSize(9);
      pdf.text("Secretaria Municipal de Educação — SEMED", 105, 41, {
        align: "center",
      });
      pdf.line(18, 46, 192, 46);
      pdf.text(
        rascunho ? "RASCUNHO — NÃO ENVIADO" : "Registro de inscrição",
        18,
        55,
      );
      pdf.text("Página " + pdf.internal.getNumberOfPages(), 192, 287, {
        align: "right",
      });
    },
  });
  return pdf;
}
export function baixarFicha(registro, opcoes) {
  gerarFicha(registro, opcoes).save(
    (opcoes?.rascunho
      ? "ficha-para-assinatura"
      : registro.protocolo || "ficha-inscricao") + ".pdf",
  );
}
