// Resume un lcov.info en Markdown (para el resumen del job de CI).
// Uso: node scripts/coverage-summary.mjs coverage/lcov.info
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'coverage/lcov.info';
let text;
try {
  text = readFileSync(file, 'utf8');
} catch {
  console.log(`_No se encontró ${file}._`);
  process.exit(0);
}

const totals = { files: 0, lines: [0, 0], branches: [0, 0], functions: [0, 0] };
const add = (key, found, hit) => {
  totals[key][0] += found;
  totals[key][1] += hit;
};
for (const record of text.split('end_of_record')) {
  const value = (tag) => Number(record.match(new RegExp(`^${tag}:(\\d+)`, 'm'))?.[1] ?? 0);
  if (!record.includes('SF:')) continue;
  totals.files += 1;
  add('lines', value('LF'), value('LH'));
  add('branches', value('BRF'), value('BRH'));
  add('functions', value('FNF'), value('FNH'));
}
const pct = ([found, hit]) => (found ? `${((hit / found) * 100).toFixed(1)}%` : '—');

console.log('### Cobertura (pruebas unitarias)');
console.log('');
console.log('| Líneas | Ramas | Funciones | Módulos medidos |');
console.log('| --- | --- | --- | --- |');
console.log(`| ${pct(totals.lines)} | ${pct(totals.branches)} | ${pct(totals.functions)} | ${totals.files} |`);
console.log('');
console.log('_Node sólo mide los módulos que cargan las pruebas: es la cobertura de lo ejercitado, no de todo `src/`._');
