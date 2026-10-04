import { Head } from '@inertiajs/react';
import Heading from '@/components/heading';
import { ThemeSegmented } from '@/components/shell/theme-segmented';
import { edit as editAppearance } from '@/routes/appearance';

export default function Appearance() {
    return (
        <>
            <Head title="Pengaturan tampilan" />

            <h1 className="sr-only">Pengaturan tampilan</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Tampilan"
                    description="Atur tampilan aplikasi untuk akun Anda"
                />
                <ThemeSegmented />
            </div>
        </>
    );
}

Appearance.layout = {
    breadcrumbs: [
        {
            title: 'Pengaturan tampilan',
            href: editAppearance(),
        },
    ],
};
