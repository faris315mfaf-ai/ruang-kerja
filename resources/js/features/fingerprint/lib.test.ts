import { describe, expect, it } from 'vitest';
import { DEVICES, FINGERPRINT_NOW, MAPPINGS, PUNCHES } from './fixtures';
import {
    admsSettings,
    deviceStatus,
    mapPin,
    normalizeSerial,
    punchesToday,
    unmappedCount,
    validateDeviceDraft,
} from './lib';

describe('device status', () => {
    it('is online within 5 minutes of the last push', () => {
        expect(
            DEVICES.map((device) => deviceStatus(device, FINGERPRINT_NOW)),
        ).toEqual(['online', 'online', 'offline', 'pending']);
        expect(
            deviceStatus(
                { ...DEVICES[0], last_push_at: '2026-10-05T01:40:00Z' },
                FINGERPRINT_NOW,
            ),
        ).toBe('online');
        expect(
            deviceStatus(
                { ...DEVICES[0], last_push_at: '2026-10-05T01:39:59Z' },
                FINGERPRINT_NOW,
            ),
        ).toBe('offline');
    });
});

describe('ADMS settings', () => {
    it('derives server and port from the app URL', () => {
        expect(admsSettings('https://ruangkerja.test')).toEqual({
            server: 'ruangkerja.test',
            port: '443',
            https: true,
            endpoint: 'https://ruangkerja.test/iclock/cdata',
        });
        expect(admsSettings('http://localhost:8000/admin')).toMatchObject({
            server: 'localhost',
            port: '8000',
            https: false,
        });
    });
});

describe('add device form', () => {
    const draft = {
        serial_number: 'cqz 7232-460999',
        name: 'Ruang server',
        location_id: 'loc-hq',
        timezone: 'Asia/Jakarta' as const,
    };

    it('accepts a new serial (normalised)', () => {
        expect(normalizeSerial(draft.serial_number)).toBe('CQZ7232460999');
        expect(validateDeviceDraft(draft, DEVICES)).toEqual({});
    });

    it('rejects duplicates, bad serials and missing fields', () => {
        expect(
            validateDeviceDraft(
                { ...draft, serial_number: 'CQZ7232460123' },
                DEVICES,
            ),
        ).toEqual({
            serial_number: 'Mesin dengan nomor seri ini sudah terdaftar.',
        });
        expect(
            validateDeviceDraft(
                { ...draft, serial_number: 'AB#1', name: 'X', location_id: '' },
                DEVICES,
            ),
        ).toEqual({
            serial_number: 'Nomor seri 8–20 huruf/angka.',
            name: expect.any(String),
            location_id: 'Pilih lokasi kantor.',
        });
    });
});

describe('PIN mapping', () => {
    it('counts unmapped PINs and maps punches too', () => {
        expect(unmappedCount(MAPPINGS)).toBe(2);
        expect(unmappedCount(MAPPINGS, 'dev-lt2')).toBe(0);

        const tono = { id: 'u-tono', name: 'Tono Wibisono' };
        const next = mapPin(
            MAPPINGS,
            PUNCHES,
            { device_id: 'dev-lobi', pin: '1093' },
            tono,
        );

        expect(unmappedCount(next.mappings)).toBe(1);
        expect(next.punches.find((item) => item.pin === '1093')?.user).toEqual(
            tono,
        );
        // the same PIN on another device is a different person
        expect(
            next.mappings.find(
                (item) =>
                    item.device_id === 'dev-gudang' && item.pin === '2002',
            )?.user?.id,
        ).toBe('u-tono');
    });

    it('keeps only today punches (office date)', () => {
        const today = punchesToday(PUNCHES, FINGERPRINT_NOW);

        expect(today).toHaveLength(9);
        expect(today.every((item) => item.device_id !== 'dev-gudang')).toBe(
            true,
        );
    });
});
