// Script de Excel (Automatizar → Nuevo script).
// Copia la dirección del vínculo de cada celda de "Evidencias" a la columna
// "Enlace evidencias", que el tablero usa para que el código abra la carpeta.
// Si la columna no existe, la crea al final de la tabla. Las celdas de
// "Evidencias" sin vínculo conservan lo que ya tenga "Enlace evidencias".
function main(workbook: ExcelScript.Workbook) {
  const linkHeader = "Enlace evidencias";
  const isEvidence = (name: string) => name.trim().toLowerCase() === "evidencias";

  const table = workbook.getTables().find(t => t.getColumns().some(c => isEvidence(c.getName())));
  if (!table) throw new Error("No encontré una tabla con la columna Evidencias.");
  const evidence = table.getColumns().find(c => isEvidence(c.getName()))!;

  let linkColumn = table.getColumnByName(linkHeader);
  if (!linkColumn) linkColumn = table.addColumn(-1, undefined, linkHeader);

  const source = evidence.getRangeBetweenHeaderAndTotal();
  const target = linkColumn.getRangeBetweenHeaderAndTotal();
  const current = target.getValues();
  const next = current.map(row => [String(row[0] ?? "")]);
  let withLink = 0;
  let changed = 0;

  for (let i = 0; i < source.getRowCount(); i++) {
    const address = source.getCell(i, 0).getHyperlink()?.address ?? "";
    if (!address) continue;
    withLink++;
    if (next[i][0] !== address) { next[i][0] = address; changed++; }
  }

  // Solo escribe si algo cambió, para no disparar el flujo de Power Automate sin motivo.
  if (changed) target.setValues(next);
  const empty = next.filter(row => !row[0].trim()).length;
  console.log(`Tabla ${table.getName()}: ${withLink} vínculos encontrados, ${changed} actualizados, ${empty} filas sin vínculo.`);
}
