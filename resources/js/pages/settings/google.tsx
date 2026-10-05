import { Head } from '@inertiajs/react';
import { GoogleConnectionCard } from '@/features/drive/google-connection-card';
import type { GoogleSettingsData } from '@/features/drive/types';
import { edit as editProfile } from '@/routes/profile';
import { google as googleSettings } from '@/routes/settings';

type Props = {
    google: GoogleSettingsData;
};

/** Settings › Akun Google (SPengaturan "Akun Google" card). */
export default function GoogleSettings({ google }: Props) {
    return (
        <>
            <Head title="Akun Google" />
            <h1 className="hidden md:sr-only md:block">Akun Google</h1>

            <div className="max-w-[640px]">
                <GoogleConnectionCard google={google} />
            </div>
        </>
    );
}

GoogleSettings.layout = {
    breadcrumbs: [
        { title: 'Pengaturan', href: editProfile() },
        { title: 'Akun Google', href: googleSettings() },
    ],
    title: 'Akun Google',
    back: '/menu',
};
