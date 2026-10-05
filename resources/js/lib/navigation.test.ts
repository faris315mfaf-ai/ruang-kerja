import { describe, expect, it } from 'vitest';
import {
    adminNavItems,
    attendanceNavItems,
    mainNavItems,
    mainNavItemsFor,
    organizationNavItems,
} from './navigation';

const titles = (roles: string[]) =>
    adminNavItems(roles).map((item) => item.title);
const orgTitles = (roles: string[]) =>
    organizationNavItems(roles).map((item) => item.title);

const ROLES = ['super_admin', 'direksi', 'hr', 'kepala_divisi', 'anggota'];

/** Every desktop destination: main tiles + Organisasi stack + Admin stack. */
const desktopHrefs = (roles: string[]) => [
    ...mainNavItemsFor(roles),
    ...organizationNavItems(roles),
    ...attendanceNavItems(roles),
    ...adminNavItems(roles),
];

describe('navigation', () => {
    it('shows the org chart to everyone, in the organization group only', () => {
        for (const role of ROLES) {
            expect(organizationNavItems([role])[0]?.href).toBe(
                '/organisasi/struktur',
            );
        }

        expect(
            mainNavItems.some((item) => item.href === '/organisasi/struktur'),
        ).toBe(false);
    });

    it('groups the organization admin and employees for HR & Super Admin', () => {
        expect(orgTitles(['hr'])).toEqual([
            'Struktur organisasi',
            'Kelola organisasi',
            'Karyawan',
        ]);
        expect(orgTitles(['super_admin'])).toEqual([
            'Struktur organisasi',
            'Kelola organisasi',
            'Karyawan',
        ]);
        expect(
            organizationNavItems(['super_admin']).map((item) => item.href),
        ).toEqual([
            '/organisasi/struktur',
            '/admin/organisasi',
            '/admin/karyawan',
        ]);
    });

    it('gives Kepala Divisi their division members and others only the chart', () => {
        expect(orgTitles(['kepala_divisi'])).toEqual([
            'Struktur organisasi',
            'Anggota divisi',
        ]);
        expect(orgTitles(['direksi'])).toEqual(['Struktur organisasi']);
        expect(orgTitles(['anggota'])).toEqual(['Struktur organisasi']);
    });

    it('gives HR the attendance and request admin but not the audit log', () => {
        expect(titles(['hr'])).toEqual([
            'Lokasi & shift',
            'Jenis pengajuan',
            'Saldo cuti',
        ]);
    });

    it('gives Super Admin the audit log and the documentation', () => {
        expect(titles(['super_admin'])).toEqual([
            'Lokasi & shift',
            'Audit log',
            'Jenis pengajuan',
            'Saldo cuti',
            'Dokumentasi',
        ]);
        expect(
            adminNavItems(['super_admin']).find(
                (item) => item.title === 'Dokumentasi',
            )?.href,
        ).toBe('/admin/dokumentasi');
    });

    it('shows the documentation to Super Admin only', () => {
        for (const role of ['direksi', 'hr', 'kepala_divisi', 'anggota']) {
            expect(titles([role])).not.toContain('Dokumentasi');
        }
    });

    it('gives other roles no admin entries', () => {
        expect(titles(['direksi'])).toEqual([]);
        expect(titles(['kepala_divisi'])).toEqual([]);
        expect(titles(['anggota'])).toEqual([]);
    });

    it('marks admin CRUD screens as desktop only', () => {
        expect(
            adminNavItems(['super_admin'])
                .filter((item) => item.desktopOnly)
                .map((item) => item.href),
        ).toEqual([
            '/admin/absensi',
            '/admin/audit',
            '/admin/pengajuan',
            '/admin/saldo-cuti',
            '/admin/dokumentasi',
        ]);
        expect(
            organizationNavItems(['super_admin'])
                .filter((item) => item.desktopOnly)
                .map((item) => item.href),
        ).toEqual(['/admin/organisasi']);
    });

    it('lists every desktop destination exactly once per role', () => {
        for (const roles of [...ROLES.map((role) => [role]), ROLES]) {
            const hrefs = desktopHrefs(roles).map((item) => item.href);

            expect(new Set(hrefs).size).toBe(hrefs.length);
        }
    });

    it('keeps every destination that was reachable before the regrouping', () => {
        const before: Record<string, string[]> = {
            super_admin: [
                '/organisasi/struktur',
                '/portofolio',
                '/absensi/hari-ini',
                '/absensi/rekap',
                '/admin/karyawan',
                '/admin/organisasi',
                '/admin/absensi',
                '/admin/audit',
                '/admin/pengajuan',
                '/admin/saldo-cuti',
            ],
            hr: [
                '/organisasi/struktur',
                '/absensi/hari-ini',
                '/admin/karyawan',
                '/admin/organisasi',
                '/admin/absensi',
                '/admin/pengajuan',
                '/admin/saldo-cuti',
            ],
            kepala_divisi: [
                '/organisasi/struktur',
                '/absensi/hari-ini',
                '/admin/karyawan',
            ],
            direksi: [
                '/organisasi/struktur',
                '/portofolio',
                '/absensi/hari-ini',
            ],
            anggota: ['/organisasi/struktur'],
        };

        for (const [role, hrefs] of Object.entries(before)) {
            const now = desktopHrefs([role]).map((item) => item.href);

            expect(now).toEqual(expect.arrayContaining(hrefs));
        }
    });

    it('keeps the mobile Menu rows (non desktop-only) the same', () => {
        const mobile = (roles: string[]) =>
            [
                ...organizationNavItems(roles),
                ...attendanceNavItems(roles),
                ...adminNavItems(roles),
            ]
                .filter((item) => !item.desktopOnly)
                .map((item) => item.title);

        expect(mobile(['super_admin'])).toEqual([
            'Struktur organisasi',
            'Karyawan',
            'Absensi hari ini',
        ]);
        expect(mobile(['kepala_divisi'])).toEqual([
            'Struktur organisasi',
            'Anggota divisi',
            'Absensi hari ini',
        ]);
        expect(mobile(['anggota'])).toEqual(['Struktur organisasi']);
    });

    it('shows the attendance board to team leads and HR, the recap on desktop only', () => {
        const hrefs = (roles: string[]) =>
            attendanceNavItems(roles).map((item) => item.href);

        expect(hrefs(['hr'])).toEqual(['/absensi/hari-ini', '/absensi/rekap']);
        expect(hrefs(['kepala_divisi'])).toEqual([
            '/absensi/hari-ini',
            '/absensi/rekap',
        ]);
        expect(hrefs(['direksi'])).toHaveLength(2);
        expect(hrefs(['anggota'])).toEqual([]);
        expect(
            attendanceNavItems(['hr']).find((item) => item.desktopOnly)?.href,
        ).toBe('/absensi/rekap');
    });

    it('adds Portofolio after Dashboard for Direksi and Super Admin only', () => {
        const hrefs = (roles: string[]) =>
            mainNavItemsFor(roles).map((item) => item.href);

        expect(hrefs(['direksi'])).toContain('/portofolio');
        expect(hrefs(['super_admin']).indexOf('/portofolio')).toBe(
            hrefs(['super_admin']).indexOf('/dashboard') + 1,
        );
        expect(hrefs(['kepala_divisi'])).not.toContain('/portofolio');
        expect(hrefs(['anggota'])).toEqual(
            mainNavItems.map((item) => item.href),
        );
    });
});
