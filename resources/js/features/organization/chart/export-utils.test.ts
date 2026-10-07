import { describe, expect, it } from 'vitest';
import type { CssRuleLike } from './export-utils';
import {
    capExportScale,
    EXPORT_SCALE,
    exportFileName,
    MAX_CANVAS_AREA,
    MAX_CANVAS_SIDE,
    printableChart,
    rootCustomProperties,
} from './export-utils';
import type { OrgChart, OrgPerson } from './types';

function person(name: string): OrgPerson {
    return {
        id: name,
        name,
        avatar: `https://lh3.googleusercontent.com/${name}`,
        position: 'Staf',
        level: 5,
        managerId: null,
        roles: [],
    };
}

function styleRule(
    selectorText: string,
    declarations: Record<string, string>,
): CssRuleLike {
    const names = Object.keys(declarations);

    return {
        selectorText,
        style: Object.assign([...names], {
            getPropertyValue: (name: string) => ` ${declarations[name]} `,
        }),
    };
}

describe('exportFileName', () => {
    it('uses the calendar day in the office timezone', () => {
        // 18:30 UTC on 6 Oct is already 7 Oct in Jakarta (UTC+7).
        expect(exportFileName(new Date('2026-10-06T18:30:00Z'))).toBe(
            'struktur-organisasi-2026-10-07.png',
        );
        expect(exportFileName(new Date('2026-10-07T03:00:00Z'), 'pdf')).toBe(
            'struktur-organisasi-2026-10-07.pdf',
        );
    });
});

describe('capExportScale', () => {
    it('keeps 2x for a chart that fits', () => {
        expect(capExportScale(1800, 1200, MAX_CANVAS_AREA.mobile)).toEqual({
            scale: EXPORT_SCALE,
            capped: false,
            width: 3600,
            height: 2400,
        });
    });

    it('lowers the ratio to stay within the area budget', () => {
        const size = capExportScale(4000, 3000, MAX_CANVAS_AREA.mobile);

        expect(size.capped).toBe(true);
        expect(size.scale).toBe(1.18);
        expect(size.width * size.height).toBeLessThanOrEqual(
            MAX_CANVAS_AREA.mobile,
        );
    });

    it('allows a bigger budget on desktop', () => {
        const mobile = capExportScale(4000, 3000, MAX_CANVAS_AREA.mobile);
        const desktop = capExportScale(4000, 3000, MAX_CANVAS_AREA.desktop);

        expect(desktop.scale).toBeGreaterThan(mobile.scale);
        expect(desktop.width * desktop.height).toBeLessThanOrEqual(
            MAX_CANVAS_AREA.desktop,
        );
    });

    it('never exceeds the longest canvas side', () => {
        const size = capExportScale(12000, 400, MAX_CANVAS_AREA.desktop);

        expect(size.capped).toBe(true);
        expect(size.width).toBeLessThanOrEqual(MAX_CANVAS_SIDE);
    });

    it('rejects an empty or unmeasured chart', () => {
        expect(() => capExportScale(0, 400, MAX_CANVAS_AREA.desktop)).toThrow();
        expect(() =>
            capExportScale(Number.NaN, 400, MAX_CANVAS_AREA.desktop),
        ).toThrow();
    });
});

describe('printableChart', () => {
    it('drops every profile photo and keeps the structure', () => {
        const chart: OrgChart = {
            companyName: 'PT Contoh',
            board: {
                id: 'board',
                name: 'Direksi',
                code: 'DIR',
                isBoard: true,
                head: person('Dina'),
                teams: [],
                members: [person('Eko')],
                size: 2,
                children: [],
            },
            divisions: [
                {
                    id: 'ops',
                    name: 'Operasional',
                    code: 'OPS',
                    isBoard: false,
                    head: person('Ani'),
                    teams: [
                        {
                            id: 't1',
                            name: 'Tim Gudang',
                            code: null,
                            lead: person('Budi'),
                            members: [person('Citra')],
                            size: 2,
                        },
                    ],
                    members: [],
                    size: 3,
                    children: [
                        {
                            id: 'sub',
                            name: 'Logistik',
                            code: 'LOG',
                            isBoard: false,
                            head: person('Fajar'),
                            teams: [],
                            members: [person('Gita')],
                            size: 2,
                            children: [],
                        },
                    ],
                },
            ],
            unassigned: [person('Hana')],
            stats: { divisions: 2, teams: 1, people: 9 },
        };

        const result = printableChart(chart);
        const avatars = JSON.stringify(result).match(/googleusercontent/g);

        expect(avatars).toBeNull();
        expect(result.divisions[0].children[0].members[0].name).toBe('Gita');
        expect(result.stats).toEqual(chart.stats);
        // The source chart is not mutated.
        expect(chart.unassigned[0].avatar).not.toBeNull();
    });
});

describe('rootCustomProperties', () => {
    it('collects :root custom properties outside media queries', () => {
        const sheet = {
            cssRules: [
                styleRule(':root', { '--bg': '#fff', color: 'red' }),
                styleRule('.dark', { '--bg': '#000' }),
                {
                    media: { mediaText: '(max-width: 767px)' },
                    cssRules: [styleRule(':root', { '--type-body': '17px' })],
                },
                styleRule(':root, .dark', { '--background': 'var(--bg)' }),
                styleRule(':root:has(nav)', { '--dock': '1' }),
                styleRule(':root', { '--type-body': '16px' }),
            ],
        };

        expect(rootCustomProperties([sheet])).toEqual({
            '--bg': '#fff',
            '--background': 'var(--bg)',
            '--type-body': '16px',
        });
    });

    it('lets unlayered rules win over @layer rules', () => {
        const sheet = {
            cssRules: [
                styleRule(':root', { '--font-sans': 'Figtree' }),
                {
                    name: 'theme',
                    cssRules: [
                        styleRule(':root, :host', {
                            '--font-sans': 'ui-sans-serif',
                            '--color-surface': 'var(--surface)',
                        }),
                    ],
                },
            ],
        };

        expect(rootCustomProperties([sheet])).toEqual({
            '--font-sans': 'Figtree',
            '--color-surface': 'var(--surface)',
        });
    });

    it('skips sheets whose rules cannot be read', () => {
        const blocked = {
            get cssRules(): CssRuleLike[] {
                throw new DOMException('cross-origin', 'SecurityError');
            },
        };

        expect(
            rootCustomProperties([
                blocked,
                { cssRules: [styleRule(':root', { '--x': '1' })] },
            ]),
        ).toEqual({ '--x': '1' });
    });
});
