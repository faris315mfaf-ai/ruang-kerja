#!/usr/bin/env node
/**
 * Project skills live once in .agents/skills (read by Codex and other
 * agents) and are mirrored to .claude/skills (read by Claude Code). Edit
 * only .agents/skills, then run:
 *
 *   node scripts/sync-agent-skills.mjs          # copy .agents/skills → .claude/skills
 *   node scripts/sync-agent-skills.mjs --check  # CI: fail when the copies differ
 *
 * Copies instead of symlinks: Windows checkouts often have symlinks off.
 */
import {
    cpSync,
    existsSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
} from 'node:fs';
import { join, relative } from 'node:path';

const SOURCE = '.agents/skills';
const TARGET = '.claude/skills';
const check = process.argv.includes('--check');

/** Every file under `root`, as paths relative to `root`. */
function files(root, dir = root) {
    if (!existsSync(dir)) {
        return [];
    }

    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);

        return statSync(path).isDirectory()
            ? files(root, path)
            : [relative(root, path)];
    });
}

const source = files(SOURCE).sort();
const target = files(TARGET).sort();
const differs =
    source.length !== target.length ||
    source.some(
        (file, index) =>
            file !== target[index] ||
            !readFileSync(join(SOURCE, file)).equals(
                readFileSync(join(TARGET, file)),
            ),
    );

if (check) {
    if (differs) {
        console.error(
            `${TARGET} tidak sama dengan ${SOURCE}. Jalankan: node scripts/sync-agent-skills.mjs`,
        );
        process.exit(1);
    }

    console.log(`${TARGET} sama dengan ${SOURCE} (${source.length} berkas).`);
    process.exit(0);
}

rmSync(TARGET, { recursive: true, force: true });
cpSync(SOURCE, TARGET, { recursive: true });
console.log(`${source.length} berkas disalin dari ${SOURCE} ke ${TARGET}.`);
