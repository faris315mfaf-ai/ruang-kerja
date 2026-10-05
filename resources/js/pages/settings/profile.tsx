import { Head, Link, usePage } from '@inertiajs/react';
import { Info, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import Heading from '@/components/heading';
import { ThemeSegmented } from '@/components/shell/theme-segmented';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { primaryRoleLabel } from '@/lib/roles';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';

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

const EMPTY = '—';

export default function Profile({ profile, canManageCredentials }: Props) {
    const { auth } = usePage().props;
    const roleLabel = primaryRoleLabel(auth.roles);
    const subtitle = [profile.position, roleLabel].filter(Boolean).join(' · ');

    const rows: { label: string; value: ReactNode }[] = [
        { label: 'Nama', value: profile.name },
        { label: 'Email', value: profile.email },
        { label: 'Divisi', value: profile.division ?? EMPTY },
        { label: 'Tim', value: profile.team ?? EMPTY },
        { label: 'Jabatan', value: profile.position ?? EMPTY },
        {
            label: 'Atasan langsung',
            value: profile.manager ? (
                <span className="flex flex-col">
                    <span>{profile.manager.name}</span>
                    <span className="text-xs text-text-muted">
                        {profile.manager.email}
                    </span>
                </span>
            ) : (
                EMPTY
            ),
        },
        { label: 'Mode kerja', value: profile.workMode },
        {
            label: 'Bergabung',
            value: profile.joinedAt ? formatDate(profile.joinedAt) : EMPTY,
        },
    ];

    return (
        <>
            <Head title="Profil" />

            <h1 className="sr-only">Profil</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Profil"
                    description="Data karyawan Anda di perusahaan"
                />

                <div className="flex items-center gap-3">
                    <UserAvatar
                        name={profile.name}
                        src={auth.user?.avatar}
                        className="size-12 text-sm"
                    />
                    <div className="min-w-0">
                        <p className="truncate font-semibold text-text">
                            {profile.name}
                        </p>
                        <p className="truncate text-sm text-text-muted">
                            {subtitle || profile.email}
                        </p>
                    </div>
                </div>

                <dl
                    className="divide-y divide-border rounded-lg border border-border bg-surface shadow-card"
                    data-test="profile-data"
                >
                    {rows.map((row) => (
                        <div
                            key={row.label}
                            className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4"
                        >
                            <dt className="text-sm text-text-muted">
                                {row.label}
                            </dt>
                            <dd className="min-w-0 text-sm break-words text-text">
                                {row.value}
                            </dd>
                        </div>
                    ))}
                </dl>

                <p className="flex items-start gap-2 text-sm text-text-muted">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                    Data ini dikelola HR. Hubungi HR bila ada yang perlu
                    diperbaiki.
                </p>
            </div>

            <div className="space-y-4">
                <Heading
                    variant="small"
                    title="Tampilan"
                    description="Pilih tema terang, gelap, atau ikuti sistem"
                />
                <ThemeSegmented />
            </div>

            {canManageCredentials && (
                <div className="space-y-4">
                    <Heading
                        variant="small"
                        title="Keamanan Super Admin"
                        description="Kata sandi darurat dan autentikasi dua faktor (TOTP)"
                    />
                    <Button variant="outline" asChild className="min-h-11">
                        <Link href={editSecurity()}>
                            <ShieldCheck aria-hidden />
                            Buka pengaturan keamanan
                        </Link>
                    </Button>
                </div>
            )}
        </>
    );
}

Profile.layout = {
    breadcrumbs: [
        {
            title: 'Profil',
            href: edit(),
        },
    ],
};
