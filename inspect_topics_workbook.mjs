import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const filePath = "C:/Users/94522/Desktop/话题明细表.xlsx";
const input = await FileBlob.load(filePath);
const workbook = await SpreadsheetFile.importXlsx(input);

const summary = await workbook.inspect({
  kind: "sheet",
  include: "id,name",
  maxChars: 4000,
});
console.log("=== SHEETS ===");
console.log(summary.ndjson);

for (const ws of workbook.worksheets.items) {
  const used = ws.getUsedRange();
  const address = used ? used.address : "A1";
  const preview = await workbook.inspect({
    kind: "table",
    sheetId: ws.name,
    range: address,
    include: "values",
    tableMaxRows: 8,
    tableMaxCols: 12,
    tableMaxCellChars: 80,
    maxChars: 12000,
  });
  console.log(`=== SHEET ${ws.name} ===`);
  console.log(preview.ndjson);
}
