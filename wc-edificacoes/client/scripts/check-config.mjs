/**
 * Lista os dados da empresa que ainda estão provisórios (marcados com PREENCHER em
 * src/config/site.ts). Roda antes de cada build — não bloqueia, só avisa.
 *   npm run check:config            → avisa
 *   npm run check:config -- --strict → falha se houver pendências (use antes de entregar)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/config/site.ts");
const pending = fs.readFileSync(file, "utf8").split("\n")
  .map((line, i) => ({ line: i + 1, text: line.trim() }))
  .filter((l) => /PREENCHER/.test(l.text) && !l.text.startsWith("*"));

if (pending.length === 0) {
  console.log("✔ Dados da empresa completos (src/config/site.ts).");
} else {
  console.warn(`\n⚠ ${pending.length} dado(s) da empresa ainda provisório(s) em src/config/site.ts:`);
  for (const p of pending) console.warn(`  linha ${p.line}: ${p.text.replace(/\s*\/\/\s*PREENCHER:?\s*/, "  ← ")}`);
  console.warn("");
  if (process.argv.includes("--strict")) process.exit(1);
}
