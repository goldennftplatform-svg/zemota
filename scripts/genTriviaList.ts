/**
 * Regenerates docs/TRIVIA-LIST.txt — a proofreadable printout of the live
 * trivia bank with the correct choice marked. Run after content changes:
 *   npm run validate:content && npx tsx scripts/genTriviaList.ts
 */
import { writeFileSync } from "node:fs";
import { TRIVIA_BANK } from "../src/game/trivia";

const letters = ["a", "b", "c", "d", "e"];
const lines: string[] = [];
lines.push(`OREGON TRAIL TRIVIA - COMPLETE BANK (${TRIVIA_BANK.length} QUESTIONS)`);
lines.push("Correct answer shown in brackets after its choice.");
lines.push("-".repeat(73));

TRIVIA_BANK.forEach((t, i) => {
  lines.push("");
  lines.push(`${i + 1}. ${t.q}`);
  lines.push("");
  t.choices.forEach((c, j) => {
    const mark = j === t.answer ? "  [CORRECT]" : "";
    lines.push(`   ${letters[j]}) ${c}${mark}`);
  });
  lines.push("");
  lines.push(`   Teach: ${t.teach}`);
  lines.push("");
  lines.push("-".repeat(73));
});

writeFileSync(new URL("../docs/TRIVIA-LIST.txt", import.meta.url), lines.join("\n") + "\n", "utf8");
console.log(`Wrote docs/TRIVIA-LIST.txt with ${TRIVIA_BANK.length} questions.`);