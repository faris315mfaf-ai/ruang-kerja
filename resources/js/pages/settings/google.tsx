import { Head } from '@inertiajs/react';
import Heading from '@/components/heading';
import { GoogleConnectionCard } from '@/features/drive/google-connection-card';
import type { GoogleSettingsData } from '@/features/drive/types';
import { google as googleSettings } from '@/routes/settings';

type Props = {
    google: GoogleSettingsData;
};

export default function GoogleSettings({ google }: Props) {
    return (
        <>
            <Head title="Akun Google" />

            <h1 className="sr-only">Akun Google</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Akun Google"
                    description="Hubungkan akun Google kantor untuk memilih file dari Drive sebagai lampiran."
                />
                <GoogleConnectionCard google={google} />
            </div>
        </>
    );
}

GoogleSettings.layout = {
    breadcrumbs: [
        {
            title: 'Akun Google',
            href: googleSettings(),
        },
    ],
    title: 'Akun Google',
    back: '/menu',
};
