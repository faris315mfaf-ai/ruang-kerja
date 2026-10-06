import { Head, Link } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { ThemeChoice } from '@/features/settings/theme-picker';
import { ReadonlyField } from '@/features/settings/readonly-field';
import { formatDate } from '@/lib/format';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import { google as googleSettings } from '@/routes/settings';

type ProfileData = {
    name: string;
    email: string;
    division: string | null;
    team: string | null;
    position: string | null;
    manager: { name: string; email: string } | null;
    workMode: string;
    joinedAt: string | null;
};

type Props = {
    profile: ProfileData;
    canManageCredentials: boolean;
};

/**
 * Settings › Profil (design SPengaturan / MSPengaturan): employee data held by
 * HR (read only) on the left, appearance and shortcuts to Google & privacy on
 * the right. The gradient identity card comes from the settings layout.
 */
export default function Profile({ profile, canManageCredentials }: Props) {
    const fields = [
        { label: 'Nama', value: profile.name },
        { label: 'Email', value: profile.email },
        { label: 'Divisi', value: profile.division },
        { label: 'Tim', value: profile.team },
        { label: 'Jabatan', value: profile.position },
        {
            label: 'Atasan langsung',
            value: profile.manager?.name ?? null,
            hint: profile.manager?.email,
        },
        { label: 'Mode kerja', value: profile.workMode },
        {
            label: 'Bergabung',
            value: profile.joinedAt ? formatDate(profile.joinedAt) : null,
        },
    ];

    return (
        <>
            <Head title="Profil" />
            <h1 className="hidden md:sr-only md:block">Profil</h1>

            <div className="flex flex-wrap items-start gap-5">
                <div className="flex min-w-0 flex-[1.4_1_560px] flex-col gap-5">
                    <Panel title="Data pribadi" bodyClassName="gap-4">
                        <dl
                            className="grid gap-4 sm:grid-cols-2"
                            data-test="profile-data"
                        >
                            {fields.map((field) => (
                                <ReadonlyField key={field.label} {...field} />
                            ))}
                        </dl>
                        <p className="text-label font-normal text-text-muted">
                            Jabatan, divisi, atasan, dan mode kerja diatur HR.
                            Hubungi HR bila ada yang perlu diperbaiki.
                        </p>
                    </Panel>

                    {canManageCredentials && (
                        <Panel
                            title="Kata sandi & keamanan"
                            bodyClassName="gap-3"
                        >
                            <p className="text-label font-normal text-text-muted">
                                Ganti kata sandi yang Anda pakai untuk masuk.
                                Super Admin juga mengatur autentikasi dua faktor
                                (TOTP) di sini.
                            </p>
                            <Button
                                variant="outline"
                                asChild
                                className="self-start"
                            >
                                <Link href={editSecurity()}>
                                    <ShieldCheck aria-hidden />
                                    Buka pengaturan keamanan
                                </Link>
                            </Button>
                        </Panel>
                    )}
                </div>

                <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-5">
                    <Panel title="Tampilan">
                        <ThemeChoice />
                    </Panel>

                    <Panel title="Data saya & privasi" bodyClassName="gap-3">
                        <p className="text-label font-normal text-text-muted">
                            Lihat dan unduh data Anda, atau atur persetujuan
                            lokasi &amp; selfie untuk absensi.
                        </p>
                        <Button asChild className="self-start">
                            <Link href="/privasi">Privasi &amp; data saya</Link>
                        </Button>
                    </Panel>

                    <Panel title="Akun Google" bodyClassName="gap-3">
                        <p className="text-label font-normal text-text-muted">
                            Hubungkan akun Google kantor untuk memilih file dari
                            Drive sebagai lampiran.
                        </p>
                        <Button
                            variant="outline"
                            asChild
                            className="self-start"
                        >
                            <Link href={googleSettings()}>
                                Atur akun Google
                            </Link>
                        </Button>
                    </Panel>
                </div>
            </div>
        </>
    );
}

Profile.layout = {
    breadcrumbs: [
        { title: 'Pengaturan', href: edit() },
        { title: 'Profil', href: edit() },
    ],
    title: 'Profil',
    back: '/menu',
};
