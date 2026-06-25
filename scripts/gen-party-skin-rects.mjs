import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("scripts/party-skin-rects.json", "utf8"));
let out = 'import type { PartySkinCellRect } from "./partySkinSheets";\n\n';
out += "/** Per-sheet tight portrait crops (generated from sprite analysis). */\n";
out += "export const PARTY_SKIN_GRID_RECTS: readonly (readonly PartySkinCellRect[])[] = [\n";
for (const sheet of data) {
  out += "  [\n";
  for (const r of sheet.rects) {
    out += `    { sx: ${r.sx}, sy: ${r.sy}, sw: ${r.sw}, sh: ${r.sh} },\n`;
  }
  out += "  ],\n";
}
out += "] as const;\n\n";
out += `export function partySkinTrimRect(sheetIndex: number, localIndex: number): PartySkinCellRect | undefined {\n`;
out += `  return PARTY_SKIN_GRID_RECTS[sheetIndex]?.[localIndex];\n`;
out += `}\n`;
fs.writeFileSync("src/game/partySkinRects.ts", out);
console.log("wrote src/game/partySkinRects.ts");
