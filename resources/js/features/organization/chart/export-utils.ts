import { toIsoDay } from '@/lib/format';
import type { OrgChart, OrgDivision, OrgPerson, OrgTeam } from './types';

/** Pixel ratio of the exported PNG (print quality on A4/A3). */
export const EXPORT_SCALE = 2;

/** Longest canvas side every current browser can draw (Chrome, Safari, Firefox). */
export const MAX_CANVAS_SIDE = 16_384;

/**
 * Canvas area budget. iOS Safari refuses canvases above 4096² pixels; on
 * desktop we allow twice that (~128 MB of RGBA) so large charts stay sharp.
 */
export const MAX_CANVAS_AREA = {
    mobile: 16_777_216,
    desktop: 33_554_432,
} as const;

/** Below this pixel ratio small text (13–14px) becomes hard to read. */
export const READABLE_SCALE = 1;

export type ExportSize = {
    /** Pixel ratio actually used. */
    scale: number;
    /** True when `scale` is lower than requested because of the limits. */
    capped: boolean;
    /** Size of the resulting PNG in pixels. */
    width: number;
    height: number;
};

/**
 * The largest pixel ratio (at most `preferred`) that keeps a `width` × `height`
 * CSS-pixel chart within the canvas limits. Rounded down to 2 decimals so the
 * result never exceeds a limit.
 */
export function capExportScale(
    width: number,
    height: number,
    maxArea: number,
    preferred: number = EXPORT_SCALE,
): ExportSize {
    if (!(width > 0 && height > 0)) {
        throw new Error('Ukuran bagan tidak valid.');
    }

    const limit = Math.min(
        preferred,
        MAX_CANVAS_SIDE / width,
        MAX_CANVAS_SIDE / height,
        Math.sqrt(maxArea / (width * height)),
    );
    const scale = Math.floor(limit * 100) / 100;

    return {
        scale,
        capped: scale < preferred,
        width: Math.floor(width * scale),
        height: Math.floor(height * scale),
    };
}

/** "struktur-organisasi-2026-10-07.png" (calendar day in the office timezone). */
export function exportFileName(now: Date, extension = 'png'): string {
    return `struktur-organisasi-${toIsoDay(now)}.${extension}`;
}

function withoutAvatar(person: OrgPerson): OrgPerson {
    return { ...person, avatar: null };
}

function printableTeam(team: OrgTeam): OrgTeam {
    return {
        ...team,
        lead: team.lead ? withoutAvatar(team.lead) : null,
        members: team.members.map(withoutAvatar),
    };
}

function printableDivision(division: OrgDivision): OrgDivision {
    return {
        ...division,
        head: division.head ? withoutAvatar(division.head) : null,
        teams: division.teams.map(printableTeam),
        members: division.members.map(withoutAvatar),
        children: division.children.map(printableDivision),
    };
}

/**
 * The chart as it goes into the PNG: profile photos replaced by initials.
 * Photos are hosted by Google (other origin; the CSP only lets the page
 * fetch its own origin), and initials keep the export deterministic.
 */
export function printableChart(chart: OrgChart): OrgChart {
    return {
        ...chart,
        board: chart.board ? printableDivision(chart.board) : null,
        divisions: chart.divisions.map(printableDivision),
        unassigned: chart.unassigned.map(withoutAvatar),
    };
}

/** The parts of CSSOM rules/sheets read by {@link rootCustomProperties}. */
export type CssRuleLike = {
    selectorText?: string;
    style?: {
        readonly length: number;
        readonly [index: number]: string;
        getPropertyValue(name: string): string;
    };
    cssRules?: ArrayLike<CssRuleLike>;
    /** Present on @media and @import: skipped. */
    media?: unknown;
    /** Present on @layer blocks (and @keyframes, which hold no :root). */
    name?: string;
};

export type CssSheetLike = { readonly cssRules: ArrayLike<CssRuleLike> };

function isRootSelector(selector: string): boolean {
    return selector.split(',').some((part) => part.trim() === ':root');
}

function collect(
    rules: ArrayLike<CssRuleLike>,
    layered: boolean,
    into: { layered: Map<string, string>; unlayered: Map<string, string> },
): void {
    for (let index = 0; index < rules.length; index++) {
        const rule = rules[index];

        if (rule.media !== undefined) {
            continue;
        }

        if (rule.selectorText !== undefined && rule.style) {
            if (!isRootSelector(rule.selectorText)) {
                continue;
            }

            const target = layered ? into.layered : into.unlayered;

            for (let i = 0; i < rule.style.length; i++) {
                const name = rule.style[i];

                if (name.startsWith('--')) {
                    target.set(name, rule.style.getPropertyValue(name).trim());
                }
            }

            continue;
        }

        if (rule.cssRules) {
            collect(
                rule.cssRules,
                layered || typeof rule.name === 'string',
                into,
            );
        }
    }
}

/**
 * Custom properties declared on `:root` outside media queries: the light
 * ("Terang") theme of Arus at desktop type sizes. Set on a wrapper inside a
 * `.dark` page they re-create the light theme for that subtree, so the PNG
 * export is always print-friendly. Unlayered rules win over `@layer` ones,
 * later rules over earlier ones (the CSS cascade). Cross-origin sheets whose
 * rules cannot be read are skipped.
 */
export function rootCustomProperties(
    sheets: Iterable<CssSheetLike>,
): Record<string, string> {
    const found = {
        layered: new Map<string, string>(),
        unlayered: new Map<string, string>(),
    };

    for (const sheet of sheets) {
        let rules: ArrayLike<CssRuleLike>;

        try {
            rules = sheet.cssRules;
        } catch {
            continue;
        }

        collect(rules, false, found);
    }

    return Object.fromEntries([...found.layered, ...found.unlayered]);
}
