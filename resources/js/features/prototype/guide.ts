import type { BadgeTone } from '@/components/ui/badge';

/** URL of the preview guide (/pratinjau/panduan, PrototypeGuideController). */
export const GUIDE_URL = '/pratinjau/panduan';

/** In-app URL of a guide document: the guide itself or a docs/fitur module doc. */
export function guideHref(slug: string, guideSlug: string): string {
    return slug === guideSlug ? GUIDE_URL : `${GUIDE_URL}/${slug}`;
}

/**
 * Owner decision of 6 Oct 2026 per preview module (docs/fitur/PANDUAN-PRATINJAU.md):
 * `next` = will be built with a real backend, `hold` = on hold until the
 * owner reopens it. Keyed by PrototypeModule.key; kept apart from modules.ts
 * so module agents can change their entries without touching this list.
 */
export type ModuleStatus = 'next' | 'hold';

export const MODULE_STATUS: Record<string, ModuleStatus> = {
    notes: 'next',
    meetings: 'next',
    automation: 'next',
    'mobile-app': 'hold',
    okr: 'next',
    fingerprint: 'hold',
    roles: 'next',
};

export const STATUS_BADGE: Record<
    ModuleStatus,
    { label: string; tone: BadgeTone }
> = {
    next: { label: 'Akan dibangun', tone: 'info' },
    hold: { label: 'Ditahan', tone: 'warning' },
};

/** Status badge of a module, or null when the module has no decision yet. */
export function moduleStatusBadge(
    key: string,
): { label: string; tone: BadgeTone } | null {
    const status = MODULE_STATUS[key];

    return status === undefined ? null : STATUS_BADGE[status];
}
