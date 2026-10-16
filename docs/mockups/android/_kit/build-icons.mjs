#!/usr/bin/env node
// Builds _kit/icons.js from lucide-react (all icons) so static mockups can use
// <i data-i="calendar-days"></i>. Run: node docs/mockups/android/_kit/build-icons.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '../../../../node_modules/lucide-react/dist/esm/icons');
const out = {};

for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const src = readFileSync(join(dir, file), 'utf8');
    const m = src.match(/const __iconNode = (\[[\s\S]*?\]);\nconst /);
    if (!m) continue;
    // The icon node is a JS array literal from a trusted lucide build file; evaluating it is intentional here.
    // oxlint-disable-next-line typescript/no-implied-eval
    const nodes = Function(`return ${m[1]}`)();
    out[file.replace(/\.js$/, '')] = nodes
        .map(([tag, attrs]) => {
            const a = Object.entries(attrs)
                .filter(([k]) => k !== 'key')
                .map(([k, v]) => `${k}="${v}"`)
                .join(' ');
            return `<${tag} ${a}/>`;
        })
        .join('');
}

writeFileSync(join(here, 'icons.js'), `window.RK_ICONS=${JSON.stringify(out)};\n`);
console.log(Object.keys(out).length, 'icons');
