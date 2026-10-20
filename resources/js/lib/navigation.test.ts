import { describe, expect, it } from 'vitest';
import {
    activeTabIndex,
    tabNavItems,
    adminNavItems,
    attendanceNavItems,
    canSeeAutomationNav,
    canSeeManagement,
    canSeeRoleDashboardNav,
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
    it('shows the org chart to everyone but staff, in the organization group only', () => {
        for (const role of ROLES.filter((r) => r !== 'anggota')) {
            expect(organizationNavItems([role])[0]?.href).toBe(
                '/organisasi/struktur',
            );
        }

        // Keputusan pemilik 6 Okt 2026: no org chart for staff.
        expect(organizationNavItems(['anggota'])).toEqual([]);

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
        expect(orgTitles(['anggota'])).toEqual([]);
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
                '/manajemen',
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
            // Keputusan pemilik 20 Okt 2026: Manajemen only for Super Admin.
            direksi: [
                '/organisasi/struktur',
                '/portofolio',
                '/absensi/hari-ini',
            ],
            // Keputusan pemilik 6 Okt 2026: staff lose the org chart.
            anggota: [],
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
            'Absen pegawai',
            'Kedisiplinan',
        ]);
        expect(mobile(['kepala_divisi'])).toEqual([
            'Struktur organisasi',
            'Anggota divisi',
            'Absensi hari ini',
            'Kedisiplinan',
        ]);
        expect(mobile(['anggota'])).toEqual([]);
    });

    it('shows the attendance board to team leads and HR, the recap on desktop only', () => {
        const hrefs = (roles: string[]) =>
            attendanceNavItems(roles).map((item) => item.href);

        expect(hrefs(['hr'])).toEqual([
            '/absensi/hari-ini',
            '/absensi/pegawai',
            '/absensi/rekap',
            '/absensi/kedisiplinan',
            '/absensi/gaji',
        ]);
        expect(hrefs(['kepala_divisi'])).toEqual([
            '/absensi/hari-ini',
            '/absensi/rekap',
            '/absensi/kedisiplinan',
        ]);
        // Keputusan pemilik 20 Okt 2026: Direksi reads Gaji, never edits days.
        expect(hrefs(['direksi'])).toEqual([
            '/absensi/hari-ini',
            '/absensi/rekap',
            '/absensi/kedisiplinan',
            '/absensi/gaji',
        ]);
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

    it('shows Manajemen only to Super Admin, once, after Portofolio (keputusan pemilik 20 Okt 2026)', () => {
        const hrefs = (roles: string[]) =>
            mainNavItemsFor(roles).map((item) => item.href);

        expect(hrefs(['super_admin']).slice(0, 3)).toEqual([
            '/dashboard',
            '/portofolio',
            '/manajemen',
        ]);
        for (const role of ['direksi', 'hr', 'kepala_divisi', 'anggota']) {
            expect(hrefs([role])).not.toContain('/manajemen');
        }

        for (const roles of [['super_admin'], ROLES]) {
            expect(
                desktopHrefs(roles).filter(
                    (href) => href.href === '/manajemen',
                ),
            ).toHaveLength(1);
        }

        expect(ROLES.filter((role) => canSeeManagement([role]))).toEqual([
            'super_admin',
        ]);
    });

    it('hides Dashboard jabatan and Otomasi from everyone but Super Admin', () => {
        for (const role of ['direksi', 'hr', 'kepala_divisi', 'anggota']) {
            expect(canSeeRoleDashboardNav([role], true)).toBe(false);
            expect(canSeeAutomationNav([role], true)).toBe(false);
        }
        expect(canSeeRoleDashboardNav(['super_admin'], true)).toBe(true);
        expect(canSeeAutomationNav(['super_admin'], true)).toBe(true);
        expect(canSeeRoleDashboardNav(['super_admin'], false)).toBe(false);
        expect(canSeeAutomationNav(['super_admin'], undefined)).toBe(false);
    });

    it('finds the tab that owns the current page for the sliding pill', () => {
        expect(activeTabIndex('/dashboard', true)).toBe(0);
        expect(activeTabIndex('/tugas', true)).toBe(1);
        expect(activeTabIndex('/absensi/riwayat', true)).toBe(2);
        expect(activeTabIndex('/obrolan/abc', true)).toBe(3);
        expect(activeTabIndex('/menu', true)).toBe(4);
        expect(activeTabIndex('/inbox', true)).toBe(-1);
        expect(activeTabIndex('/persetujuan', true)).toBe(-1);
        expect(activeTabIndex('/menu/lain', true)).toBe(-1);
    });

    it('gives the fourth tab back to Inbox when Obrolan is off', () => {
        expect(tabNavItems(false).map((item) => item.title)).toEqual([
            'Beranda',
            'Tugas',
            'Absen',
            'Inbox',
            'Lainnya',
        ]);
        expect(activeTabIndex('/inbox', false)).toBe(3);
        expect(activeTabIndex('/obrolan', false)).toBe(-1);
        expect(tabNavItems(true).filter((item) => item.center)).toHaveLength(1);
    });

    it('swaps the raised centre button for Workspace after the check-in', () => {
        const items = tabNavItems(true, 'workspace');

        expect(items.map((item) => item.title)).toEqual([
            'Beranda',
            'Tugas',
            'Workspace',
            'Obrolan',
            'Lainnya',
        ]);
        expect(items[2]?.sheet).toBe('workspace');
        // The Workspace centre owns the workspace pages (/w/KEY) and /workspace.
        expect(activeTabIndex('/w/OPS', true, 'workspace')).toBe(2);
        expect(activeTabIndex('/workspace', true, 'workspace')).toBe(2);
        expect(activeTabIndex('/absensi', true, 'workspace')).toBe(-1);
        // Absen is no longer on the bar while Workspace holds the centre.
        expect(
            tabNavItems(true, 'workspace').some(
                (item) => item.href === '/absensi',
            ),
        ).toBe(false);
    });

    it('can drop the raised centre button entirely (null)', () => {
        const items = tabNavItems(true, null);

        expect(items).toHaveLength(4);
        expect(items.some((item) => item.center)).toBe(false);
        expect(activeTabIndex('/menu', true, null)).toBe(3);
    });
});
