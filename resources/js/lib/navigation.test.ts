import { describe, expect, it } from 'vitest';
import { adminNavItems, mainNavItems, mainNavItemsFor } from './navigation';

const titles = (roles: string[]) =>
    adminNavItems(roles).map((item) => item.title);

describe('navigation', () => {
    it('shows the org chart to everyone', () => {
        expect(
            mainNavItems.some((item) => item.href === '/organisasi/struktur'),
        ).toBe(true);
    });

    it('gives HR the organization and request admin but not the audit log', () => {
        expect(titles(['hr'])).toEqual([
            'Karyawan',
            'Organisasi',
            'Lokasi & shift',
            'Jenis pengajuan',
            'Saldo cuti',
        ]);
    });

    it('gives Super Admin the organization admin and the audit log', () => {
        expect(titles(['super_admin'])).toEqual([
            'Karyawan',
            'Organisasi',
            'Lokasi & shift',
            'Audit log',
            'Jenis pengajuan',
            'Saldo cuti',
        ]);
    });

    it('gives other roles no organization admin', () => {
        expect(titles(['direksi'])).toEqual([]);
        expect(titles(['kepala_divisi'])).toEqual(['Anggota divisi']);
        expect(titles(['anggota'])).toEqual([]);
    });

    it('marks admin CRUD screens as desktop only', () => {
        const items = adminNavItems(['super_admin']);

        expect(
            items.filter((item) => item.desktopOnly).map((item) => item.href),
        ).toEqual([
            '/admin/organisasi',
            '/admin/absensi',
            '/admin/audit',
            '/admin/pengajuan',
            '/admin/saldo-cuti',
        ]);
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
