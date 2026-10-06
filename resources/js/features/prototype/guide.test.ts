import { describe, expect, it } from 'vitest';
import {
    GUIDE_URL,
    MODULE_STATUS,
    guideHref,
    moduleStatusBadge,
} from './guide';
import { PROTOTYPE_MODULES } from './modules';

describe('guideHref', () => {
    it('serves the guide itself at /pratinjau/panduan', () => {
        expect(guideHref('panduan-pratinjau', 'panduan-pratinjau')).toBe(
            GUIDE_URL,
        );
    });

    it('serves module docs below the guide', () => {
        expect(guideHref('fitur-okr', 'panduan-pratinjau')).toBe(
            '/pratinjau/panduan/fitur-okr',
        );
    });
});

describe('module status', () => {
    it('has an owner decision for every preview module on the hub', () => {
        for (const module of PROTOTYPE_MODULES) {
            expect(MODULE_STATUS[module.key], module.key).toBeDefined();
        }
    });

    it('marks the mobile app and fingerprint machines as on hold', () => {
        expect(moduleStatusBadge('mobile-app')?.label).toBe('Ditahan');
        expect(moduleStatusBadge('fingerprint')?.label).toBe('Ditahan');
        expect(moduleStatusBadge('notes')?.label).toBe('Akan dibangun');
        expect(moduleStatusBadge('tidak-ada')).toBeNull();
    });
});
