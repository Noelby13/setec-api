/** Standalone A4 internal receipt, using PDF standard fonts. No bank/fiscal integration. */
type Receipt = {
  numero: string | number;
  emitido_en: string | Date;
  anulado_en?: string | null;
  motivo_anulacion?: string | null;
  datos: {
    estudiante: { nombres: string; apellidos: string; identificacion: string };
    programa: string;
    cohorte: string;
    expediente: string;
    conceptos: { concepto: string; tipo: string; importe: string }[];
    total: string;
    metodo_pago: string;
    referencia: string;
    fecha_pago: string;
  };
};
const money = (value: string) =>
  `C$ ${value.split(".")[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${(value.split(".")[1] || "00").padEnd(2, "0")}`;
const safe = (text: unknown) =>
  String(text ?? "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\xff]/g, "?");
const escaped = (value: unknown) => safe(value).replace(/[\\()]/g, "\\$&");
const characterWidths = new Map<string, number>();
for (const [letters, widths] of [
  [
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    [
      667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
      667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
    ],
  ],
  [
    "abcdefghijklmnopqrstuvwxyz",
    [
      556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
      556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
    ],
  ],
] as const)
  [...letters].forEach((letter, index) =>
    characterWidths.set(letter, widths[index]!),
  );
function textWidth(value: string) {
  return (
    [...value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")].reduce(
      (sum, letter) =>
        sum +
        (characterWidths.get(letter) ??
          (/\d/.test(letter) ? 556 : letter === " " ? 278 : 750)),
      0,
    ) / 100
  );
}
function wrap(value: unknown, width = 78) {
  const maxWidth = width * 5.5,
    rows: string[] = [];
  let row = "";
  for (let word of safe(value).split(/\s+/)) {
    while (textWidth(word) > maxWidth) {
      if (row) {
        rows.push(row);
        row = "";
      }
      let end = 1;
      while (end < word.length && textWidth(word.slice(0, end + 1)) <= maxWidth)
        end++;
      rows.push(word.slice(0, end));
      word = word.slice(end);
    }
    const candidate = (row + " " + word).trim();
    if (textWidth(candidate) > maxWidth) {
      rows.push(row);
      row = word;
    } else row = candidate;
  }
  if (row || !rows.length) rows.push(row);
  return rows;
}
export function receiptPdf(receipt: Receipt): Buffer {
  const pages: string[][] = [];
  let operations: string[] = [],
    y = 0;
  const folio = `CI-${String(receipt.numero).padStart(8, "0")}`;
  function text(
    value: unknown,
    x: number,
    at: number,
    size = 10,
    bold = false,
    color = "0.09 0.17 0.23",
  ) {
    operations.push(
      `${color} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${at} Td (${escaped(value)}) Tj ET`,
    );
  }
  function newPage() {
    operations = [];
    pages.push(operations);
    text(
      "UNCSM - Educación Permanente y Posgrado",
      42,
      801,
      11,
      true,
      "0.01 0.329 0.565",
    );
    text("COMPROBANTE INTERNO DE PAGO", 42, 777, 16, true, "0.01 0.329 0.565");
    text(folio, 42, 755, 12, true);
    text(
      `Emisión: ${new Intl.DateTimeFormat("es-NI", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Managua" }).format(new Date(receipt.emitido_en))}`,
      285,
      755,
      10,
    );
    operations.push("0.8 0.68 0.48 RG 42 742 m 553 742 l S");
    y = 718;
    if (receipt.anulado_en) {
      text(
        "ANULADO - Se conserva para consulta y auditoría",
        42,
        y,
        12,
        true,
        "0.7 0.14 0.09",
      );
      y -= 20;
    }
  }
  function lines(value: unknown, bold = false, width = 78) {
    for (const line of wrap(value, width)) {
      if (y < 90) newPage();
      text(line, 42, y, 10, bold);
      y -= 15;
    }
  }
  newPage();
  lines(
    `Estudiante: ${receipt.datos.estudiante.nombres} ${receipt.datos.estudiante.apellidos}`,
    true,
    68,
  );
  lines(`Identificación: ${receipt.datos.estudiante.identificacion}`);
  lines(`Programa: ${receipt.datos.programa}`, false, 68);
  lines(
    `Cohorte: ${receipt.datos.cohorte}   Expediente: ${receipt.datos.expediente}`,
  );
  lines(`Referencia: ${receipt.datos.referencia}`);
  lines(`Método: ${receipt.datos.metodo_pago.replace(/_/g, " ")}`);
  lines(
    `Fecha del pago: ${new Intl.DateTimeFormat("es-NI", { dateStyle: "medium", timeZone: "America/Managua" }).format(new Date(receipt.datos.fecha_pago))}`,
  );
  y -= 10;
  text("Concepto cobrado", 42, y, 10, true);
  text("Importe", 458, y, 10, true);
  y -= 22;
  for (const item of receipt.datos.conceptos) {
    const rows = wrap(
      `${item.tipo === "MATRICULA" ? "Matrícula: " : "Académico: "}${item.concepto}`,
      60,
    );
    if (y - rows.length * 15 < 95) {
      newPage();
      text("Conceptos (continuación)", 42, y, 10, true);
      y -= 24;
    }
    text(money(item.importe), 458, y, 10, true);
    for (const row of rows) {
      text(row, 42, y);
      y -= 15;
    }
    y -= 10;
  }
  if (y < 150) newPage();
  y -= 5;
  operations.push(`0.86 0.9 0.92 RG 42 ${y} m 553 ${y} l S`);
  y -= 24;
  text("TOTAL PAGADO", 42, y, 12, true);
  text(money(receipt.datos.total), 430, y, 12, true);
  y -= 28;
  if (receipt.anulado_en)
    lines(`Motivo de anulación: ${receipt.motivo_anulacion || ""}`, false, 68);
  pages.forEach((page, index) => {
    operations = page;
    text("Comprobante interno de pago. No es factura fiscal.", 42, 48, 9);
    text(
      "Documento asociado al pago registrado; no habilita pagos electrónicos.",
      42,
      34,
      8,
    );
    text(`${index + 1} / ${pages.length}`, 515, 34, 9);
  });
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ")}] >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];
  for (const [index, page] of pages.entries()) {
    const stream = page.join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + index * 2} 0 R >>`,
    );
    objects.push(
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    );
  }
  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n%âãÏÓ\n", "latin1")],
    offsets = [0];
  let length = parts[0]!.length;
  for (const [index, object] of objects.entries()) {
    offsets.push(length);
    const part = Buffer.from(
      `${index + 1} 0 obj\n${object}\nendobj\n`,
      "latin1",
    );
    parts.push(part);
    length += part.length;
  }
  parts.push(
    Buffer.from(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
        .join(
          "",
        )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`,
      "latin1",
    ),
  );
  return Buffer.concat(parts);
}
