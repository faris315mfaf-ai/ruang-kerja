import { Head } from '@inertiajs/react';
import { Panel } from '@/components/ui/panel';
import { ThemeChoice } from '@/features/settings/theme-picker';
import { edit as editAppearance } from '@/routes/appearance';
import { edit as editProfile } from '@/routes/profile';

/** Settings › Tampilan (SPengaturan "Tampilan" card, MSPengaturan segmented). */
export default function Appearance() {
    return (
        <>
            <Head title="Pengaturan tampilan" />
            <h1 className="hidden md:sr-only md:block">Pengaturan tampilan</h1>

            <Panel
                title="Tampilan"
                className="max-w-[640px]"
                bodyClassName="gap-4"
            >
                <p className="text-label font-normal text-text-muted">
                    Pilih tema terang, gelap, atau ikuti sistem. Disimpan ke
                    akun Anda dan berlaku di semua perangkat.
                </p>
                <ThemeChoice />
            </Panel>
        </>
    );
}

Appearance.layout = {
    breadcrumbs: [
        { title: 'Pengaturan', href: editProfile() },
        { title: 'Tampilan', href: editAppearance() },
    ],
    title: 'Tampilan',
    back: '/menu',
};
