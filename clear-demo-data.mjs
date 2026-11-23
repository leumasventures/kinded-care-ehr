// Run from the frontend project folder:  node clear-demo-data.mjs
// Empties every built-in demo record (patients, doctors, nurses' vitals, appointments, admissions, lab orders,
// drugs and dispensing, invoices, payments, accounts, payroll, duty roster, clinical notes, prescriptions).
// Settings, the price list and the app's code are left alone.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const dir = "src/types";
if (!existsSync(dir)) {
  console.error("Run this from the frontend project folder (the one that contains src/).");
  process.exit(1);
}

// Index just past the end of the JS statement/block that starts at `from`, tracking strings, comments and brackets.
function scanTo(src, from, stop) {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (c === "/" && n === "/") { i = src.indexOf("\n", i); if (i < 0) return src.length; continue; }
    if (c === "/" && n === "*") { i = src.indexOf("*/", i) + 1; continue; }
    if (c === '"' || c === "'") { for (i++; src[i] !== c; i++) if (src[i] === "\\") i++; continue; }
    if (c === "`") {
      for (i++; src[i] !== "`"; i++) {
        if (src[i] === "\\") i++;
        else if (src[i] === "$" && src[i + 1] === "{") { i = scanTo(src, i + 2, "}") ; }
      }
      continue;
    }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) { if (depth === 0 && stop === c) return i; depth--; }
    else if (c === ";" && depth === 0 && stop === ";") return i;
  }
  throw new Error("could not find the end of a block");
}

const bodies = {
  accounts: "return { accounts: [], txns: [], employees: [], runs: [] };",
  roster: "return [];",
  records: "return { notes: [], prescriptions: [], administrations: [] };",
};

let changed = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
  const path = join(dir, f);
  let src = readFileSync(path, "utf8");
  const before = src;

  // export const seedXxx: Type[] = <anything>;   ->   = [];
  const re = /export const (seed[A-Za-z]+)(\s*:\s*[^=\n]+?)?\s*=\s*/g;
  let m;
  const edits = [];
  while ((m = re.exec(src))) {
    const start = m.index + m[0].length;
    const end = scanTo(src, start, ";");
    edits.push([start, end]);
    re.lastIndex = end;
  }
  for (const [s, e] of edits.reverse()) src = src.slice(0, s) + "[]" + src.slice(e);

  // function seed(): Type { ... }   (accounts, roster, records)
  const fn = /function seed\(\)\s*:\s*[^{]+\{/.exec(src);
  const key = f.replace(".ts", "");
  if (fn && bodies[key]) {
    const open = fn.index + fn[0].length;
    const close = scanTo(src, open, "}");
    src = src.slice(0, open) + "\n  " + bodies[key] + "\n" + src.slice(close);
  }

  if (src !== before) {
    writeFileSync(path, src);
    changed++;
    console.log("cleared demo data in", path);
  }
}
console.log(changed ? `\nDone: ${changed} files changed. Now run: npm run build` : "Nothing to change (already empty).");
