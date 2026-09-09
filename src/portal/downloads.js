export function baixarTexto(texto, nome, tipo = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo })),
    a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function baixarPublicacao(p, escola = "") {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const pdf = new jsPDF();
  pdf.setFontSize(10);
  pdf.setTextColor(0, 95, 89);
  pdf.text("Secretaria Municipal de Educação · Pedro II", 14, 16);
  autoTable(pdf, {
    startY: 23,
    head: [[p.titulo]],
    body: [
      [escola],
      [p.numero ? `Referência: ${p.numero}` : ""],
      [p.resumo || ""],
      [p.texto || ""],
      [p.url ? `Documento / serviço: ${p.url}` : ""],
    ].filter((r) => r[0]),
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fontSize: 17, textColor: [15, 60, 65] },
    margin: { bottom: 20 },
    didDrawPage: () => {
      pdf.setFontSize(8);
      pdf.setTextColor(90);
      pdf.text(
        `Portal da Educação · ${pdf.internal.getNumberOfPages()}`,
        14,
        287,
      );
    },
  });
  const nome = (p.titulo || "publicacao")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 65);
  pdf.save(`${nome}.pdf`);
}
export function calendarioIcs(eventos) {
  const esc = (v) =>
    String(v || "")
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SEDUC Pedro II//Calendario//PT-BR",
    "CALSCALE:GREGORIAN",
  ];
  for (const e of eventos) {
    const fim = new Date((e.dataFim || e.dataInicio) + "T12:00:00Z");
    fim.setUTCDate(fim.getUTCDate() + 1);
    linhas.push(
      "BEGIN:VEVENT",
      `UID:${String(e.id).replace(/[^a-zA-Z0-9_-]/g, "")}@seduc-pedro-ii`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${e.dataInicio.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${fim.toISOString().slice(0, 10).replace(/-/g, "")}`,
      `SUMMARY:${esc(e.titulo)}`,
      `DESCRIPTION:${esc(e.resumo)}`,
      `LOCATION:${esc(e.local)}`,
      "END:VEVENT",
    );
  }
  linhas.push("END:VCALENDAR");
  // RFC 5545: linhas longas dobradas sem dividir caracteres UTF-8.
  return (
    linhas
      .map((l) => {
        let s = "",
          n = 0;
        for (const c of l) {
          const b = new TextEncoder().encode(c).length;
          if (n + b > 73) {
            s += "\r\n ";
            n = 1;
          }
          s += c;
          n += b;
        }
        return s;
      })
      .join("\r\n") + "\r\n"
  );
}
