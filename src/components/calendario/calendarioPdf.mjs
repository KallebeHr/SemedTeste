import { jsPDF } from "jspdf";
import brasao from "../editais/brasao.mjs";
import { BASE, MESES, validarCalendario } from "../../../shared/calendario.mjs";
const rgb = (hex) => hex.match(/[a-f\d]{2}/gi).map((v) => parseInt(v, 16));
export function gerarCalendarioPdf(entrada, mes = null) {
  const c = validarCalendario(entrada);
  if (mes !== null && (!Number.isInteger(mes) || mes < 1 || mes > 12))
    throw Error("Mês inválido.");
  const pdf = new jsPDF(),
    cats = { ...BASE, ...c.categorias };
  const cabecalho = (titulo) => {
    pdf.addImage(brasao, "JPEG", 14, 10, 13, 16);
    pdf.setTextColor(23, 60, 64);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text("PREFEITURA MUNICIPAL DE PEDRO II", 32, 16);
    pdf.setFont("helvetica", "normal");
    pdf.text("SECRETARIA MUNICIPAL DE EDUCAÇÃO", 32, 22);
    pdf.setFontSize(16);
    pdf.text(titulo, 14, 37);
    pdf.setDrawColor(0, 122, 114);
    pdf.line(14, 41, 196, 41);
  };
  function grade(m, x, y, w, h) {
    const cel = w / 7,
      linha = (h - 15) / 7;
    pdf.setFontSize(mes ? 14 : 10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(23, 60, 64);
    pdf.text(MESES[m - 1] + " " + c.ano, x, y + 5);
    pdf.setFontSize(mes ? 10 : 7);
    ["D", "S", "T", "Q", "Q", "S", "S"].forEach((d, i) =>
      pdf.text(d, x + (i + 0.5) * cel, y + 13, { align: "center" }),
    );
    const primeiro = new Date(Date.UTC(c.ano, m - 1, 1)).getUTCDay();
    for (const d of c.dias.filter((d) => d.mes === m)) {
      const pos = primeiro + d.dia - 1,
        xx = x + (pos % 7) * cel,
        yy = y + 16 + Math.floor(pos / 7) * linha;
      pdf.setFillColor(...rgb(d.cor));
      pdf.setDrawColor(145);
      pdf.rect(xx, yy, cel, linha, "FD");
      pdf.setTextColor(15);
      pdf.setFontSize(mes ? 12 : 8);
      pdf.text(String(d.dia), xx + cel / 2, yy + linha * 0.6, {
        align: "center",
      });
      if (d.eventoIds.length) {
        pdf.setFontSize(6);
        pdf.text("*", xx + cel - 2, yy + 3);
      }
    }
  }
  function legenda(y) {
    let x = 14;
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    for (const v of Object.values(cats)) {
      const largura = pdf.getTextWidth(v.rotulo) + 9;
      if (x + largura > 196) {
        x = 14;
        y += 6;
      }
      pdf.setFillColor(...rgb(v.cor));
      pdf.setDrawColor(120);
      pdf.rect(x, y - 3, 3, 3, "FD");
      pdf.setTextColor(30);
      pdf.text(v.rotulo, x + 5, y);
      x += largura;
    }
    return y + 7;
  }
  if (mes === null) {
    for (let pagina = 0; pagina < 2; pagina++) {
      if (pagina) pdf.addPage();
      cabecalho(
        "Calendário Escolar " +
          c.ano +
          " · " +
          (pagina === 0 ? "Janeiro a junho" : "Julho a dezembro"),
      );
      for (let i = 0; i < 6; i++)
        grade(
          pagina * 6 + i + 1,
          14 + (i % 2) * 94,
          48 + Math.floor(i / 2) * 66,
          88,
          61,
        );
      legenda(252);
      pdf.setFontSize(8);
      pdf.text("* Consulte os eventos e detalhes na versão mensal.", 14, 281);
    }
  } else {
    cabecalho("Calendário Escolar · " + MESES[mes - 1] + " " + c.ano);
    grade(mes, 14, 48, 182, 106);
    let y = legenda(162);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text("Eventos do mês", 14, y);
    y += 7;
    pdf.setFont("helvetica", "normal");
    const prefixo = `${c.ano}-${String(mes).padStart(2, "0")}`;
    const eventos = c.eventos.filter(
      (e) =>
        e.dataInicio.slice(0, 7) <= prefixo && e.dataFim.slice(0, 7) >= prefixo,
    );
    if (!eventos.length) {
      pdf.text("Nenhum evento específico registrado.", 14, y);
      y += 6;
    }
    for (const e of eventos) {
      const texto = `${e.dataInicio.split("-").reverse().join("/")} a ${e.dataFim.split("-").reverse().join("/")}: ${e.titulo}. ${e.observacao || ""}`;
      const linhas = pdf.splitTextToSize(texto, 180);
      for (const l of linhas) {
        if (y > 274) {
          pdf.addPage();
          cabecalho("Eventos · " + MESES[mes - 1] + " " + c.ano);
          y = 50;
          pdf.setFontSize(9);
        }
        pdf.text(l, 14, y);
        y += 4.5;
      }
      y += 3;
    }
  }
  for (let i = 1; i <= pdf.getNumberOfPages(); i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(70);
    pdf.text("www.semedpii.com.br · Calendário escolar · " + c.ano, 14, 291);
    pdf.text(`${i}/${pdf.getNumberOfPages()}`, 196, 291, { align: "right" });
  }
  return pdf;
}
