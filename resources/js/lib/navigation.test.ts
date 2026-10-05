import { describe, expect, it } from 'vitest';
import { adminNavItems, mainNavItems } from './navigation';

const titles = (roles: string[]) =>
    adminNavItems(roles).map((item) => item.title);

describe('navigation', () => {
    it('shows the org chart to everyone', () => {
        expect(
            mainNavItems.some((item) => item.href === '/organisasi/struktur'),
        ).toBe(true);
    });

    it('gives HR the organization admin but not the audit log', () => {
        expect(titles(['hr'])).toEqual([
            'Karyawan',
            'Organisasi',
            'Lokasi & shift',
        ]);
    });

    it('gives Super Admin the organization admin and the audit log', () => {
        expect(titles(['super_admin'])).toEqual([
            'Karyawan',
            'Organisasi',
            'Lokasi & shift',
            'Audit log',
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
        ).toEqual(['/admin/organisasi', '/admin/absensi', '/admin/audit']);
    });
});
