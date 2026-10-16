// Menambah ikon Lucide ke registri src/ui/icons.ts.
// Pakai: node scripts/tambah-ikon.mjs nama-ikon [nama-ikon-lain …]   (nama kebab-case dari lucide.dev)
import fs from 'node:fs';

const BARREL = 'node_modules/lucide-react-native/dist/esm/lucide-react-native.mjs';
const TARGET = 'src/ui/icons.ts';

const pascal = (n) => n.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
const barrel = fs.readFileSync(BARREL, 'utf8');
const lama = fs.readFileSync(TARGET, 'utf8');

const nama = new Set([...lama.matchAll(/^ {2}'([a-z0-9-]+)': /gm)].map((m) => m[1]));
for (const baru of process.argv.slice(2)) {
  nama.add(baru);
}

const impor = [];
const entri = [];
const berkasKeId = new Map();
for (const n of [...nama].sort()) {
  const cocok = barrel.match(new RegExp(`export \\{[^}]*\\bdefault as ${pascal(n)}\\b[^}]*\\} from '\\./icons/([a-z0-9-]+)\\.mjs'`));
  if (!cocok) {
    console.error(`Ikon tidak ditemukan di lucide-react-native: ${n}`);
    process.exit(1);
  }
  let id = berkasKeId.get(cocok[1]);
  if (!id) {
    id = pascal(n);
    berkasKeId.set(cocok[1], id);
    impor.push(`import ${id} from 'lucide-react-native/icons/${cocok[1]}';`);
  }
  entri.push(`  '${n}': ${id},`);
}

const awal = lama.slice(0, lama.indexOf('import '));
fs.writeFileSync(
  TARGET,
  `${awal}${impor.join('\n')}
import type { LucideIcon } from 'lucide-react-native';

export const ICONS = {
${entri.join('\n')}
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;
`,
);
console.log(`${entri.length} ikon terdaftar.`);
