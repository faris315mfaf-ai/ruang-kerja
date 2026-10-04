/*
 * Prints SVG path data for a string, read from a WOFF 1.0 font with TrueType
 * outlines. Used once to extract the "RK" letters embedded in
 * scripts/generate-icons.php, so the icons never depend on installed fonts.
 *
 * Run (Node 22, no dependencies):
 *   node scripts/glyphs.mjs node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff RK
 *
 * Output: JSON { unitsPerEm, d, bbox }. Coordinates are in font units with the
 * baseline at y = 0 and y pointing down (SVG orientation).
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const [fontPath, text] = process.argv.slice(2);

if (!fontPath || !text) {
    console.error('Usage: node scripts/glyphs.mjs <font.woff> <text>');
    process.exit(1);
}

const font = readFileSync(fontPath);

if (font.toString('ascii', 0, 4) !== 'wOFF') {
    throw new Error('Not a WOFF 1.0 file (WOFF2 is not supported).');
}

/** @type {Record<string, Buffer>} */
const tables = {};

for (let i = 0; i < font.readUInt16BE(12); i++) {
    const entry = 44 + i * 20;
    const tag = font.toString('ascii', entry, entry + 4);
    const offset = font.readUInt32BE(entry + 4);
    const compressed = font.readUInt32BE(entry + 8);
    const original = font.readUInt32BE(entry + 12);
    const raw = font.subarray(offset, offset + compressed);

    tables[tag] = compressed < original ? inflateSync(raw) : raw;
}

if (!tables.glyf) {
    throw new Error('Font has no glyf table (CFF outlines are not supported).');
}

const longLoca = tables.head.readInt16BE(50) === 1;
const numberOfHMetrics = tables.hhea.readUInt16BE(34);

function glyphOffset(glyph) {
    return longLoca
        ? tables.loca.readUInt32BE(glyph * 4)
        : tables.loca.readUInt16BE(glyph * 2) * 2;
}

function advanceWidth(glyph) {
    return tables.hmtx.readUInt16BE(Math.min(glyph, numberOfHMetrics - 1) * 4);
}

/** Maps a code point to a glyph id using a format 4 cmap subtable. */
function glyphFor(codePoint) {
    const cmap = tables.cmap;

    for (let i = 0; i < cmap.readUInt16BE(2); i++) {
        const offset = cmap.readUInt32BE(8 + i * 8);

        if (cmap.readUInt16BE(offset) !== 4) {
            continue;
        }

        const segments = cmap.readUInt16BE(offset + 6) / 2;
        const ends = offset + 14;
        const starts = ends + segments * 2 + 2;
        const deltas = starts + segments * 2;
        const rangeOffsets = deltas + segments * 2;

        for (let s = 0; s < segments; s++) {
            const start = cmap.readUInt16BE(starts + s * 2);

            if (
                codePoint < start ||
                codePoint > cmap.readUInt16BE(ends + s * 2)
            ) {
                continue;
            }

            const delta = cmap.readInt16BE(deltas + s * 2);
            const rangeOffset = cmap.readUInt16BE(rangeOffsets + s * 2);

            if (rangeOffset === 0) {
                return (codePoint + delta) & 0xffff;
            }

            const glyph = cmap.readUInt16BE(
                rangeOffsets + s * 2 + rangeOffset + (codePoint - start) * 2,
            );

            return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
        }
    }

    return 0;
}

/** Returns the contours of a simple glyph as lists of { x, y, on } points. */
function contoursOf(glyph) {
    const glyf = tables.glyf;
    let p = glyphOffset(glyph);

    if (glyphOffset(glyph + 1) === p) {
        return [];
    }

    const contourCount = glyf.readInt16BE(p);

    if (contourCount < 0) {
        throw new Error(`Glyph ${glyph} is composite (not supported).`);
    }

    p += 10;
    const endPoints = [];

    for (let i = 0; i < contourCount; i++, p += 2) {
        endPoints.push(glyf.readUInt16BE(p));
    }

    const pointCount = endPoints[endPoints.length - 1] + 1;
    p += 2 + glyf.readUInt16BE(p);

    const flags = [];

    while (flags.length < pointCount) {
        const flag = glyf.readUInt8(p++);
        flags.push(flag);

        if (flag & 8) {
            for (let repeat = glyf.readUInt8(p++); repeat > 0; repeat--) {
                flags.push(flag);
            }
        }
    }

    const readAxis = (shortBit, sameBit) => {
        const values = [];
        let value = 0;

        for (const flag of flags) {
            if (flag & shortBit) {
                const delta = glyf.readUInt8(p++);
                value += flag & sameBit ? delta : -delta;
            } else if (!(flag & sameBit)) {
                value += glyf.readInt16BE(p);
                p += 2;
            }

            values.push(value);
        }

        return values;
    };

    const xs = readAxis(2, 16);
    const ys = readAxis(4, 32);
    const contours = [];
    let first = 0;

    for (const last of endPoints) {
        const contour = [];

        for (let i = first; i <= last; i++) {
            contour.push({ x: xs[i], y: ys[i], on: (flags[i] & 1) === 1 });
        }

        contours.push(contour);
        first = last + 1;
    }

    return contours;
}

const round = (n) => String(Math.round(n * 100) / 100);

/** Converts a TrueType contour (quadratic B-splines) to SVG path data. */
function toPath(contour, dx) {
    const points = contour.map((pt) => ({ x: pt.x + dx, y: -pt.y, on: pt.on }));
    let start = points.findIndex((pt) => pt.on);

    if (start === -1) {
        const a = points[0];
        const b = points[points.length - 1];
        points.unshift({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true });
        start = 0;
    }

    const origin = points[start];
    let d = `M${round(origin.x)} ${round(origin.y)}`;
    let control = null;

    for (let i = 1; i <= points.length; i++) {
        const pt = points[(start + i) % points.length];

        if (pt.on) {
            d += control
                ? `Q${round(control.x)} ${round(control.y)} ${round(pt.x)} ${round(pt.y)}`
                : `L${round(pt.x)} ${round(pt.y)}`;
            control = null;
        } else if (control) {
            const midX = (control.x + pt.x) / 2;
            const midY = (control.y + pt.y) / 2;
            d += `Q${round(control.x)} ${round(control.y)} ${round(midX)} ${round(midY)}`;
            control = pt;
        } else {
            control = pt;
        }
    }

    return `${d}Z`;
}

let pen = 0;
let d = '';
const bbox = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
};

for (const char of text) {
    const glyph = glyphFor(char.codePointAt(0) ?? 0);

    if (glyph === 0) {
        throw new Error(`No glyph for "${char}".`);
    }

    for (const contour of contoursOf(glyph)) {
        d += toPath(contour, pen);

        for (const pt of contour) {
            bbox.minX = Math.min(bbox.minX, pt.x + pen);
            bbox.maxX = Math.max(bbox.maxX, pt.x + pen);
            bbox.minY = Math.min(bbox.minY, -pt.y);
            bbox.maxY = Math.max(bbox.maxY, -pt.y);
        }
    }

    pen += advanceWidth(glyph);
}

console.log(
    JSON.stringify({ unitsPerEm: tables.head.readUInt16BE(18), d, bbox }),
);
