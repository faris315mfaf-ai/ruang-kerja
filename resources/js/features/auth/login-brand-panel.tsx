import { usePage } from '@inertiajs/react';
import { CircleCheck, LayoutGrid, MapPin } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
    {
        icon: MapPin,
        title: 'Absensi GPS, selfie, atau QR',
        description:
            'Check-in dari ponsel di lokasi kantor, lapangan, atau saat WFH.',
    },
    {
        icon: CircleCheck,
        title: 'Workspace & tugas tim',
        description:
            'Board, tenggat, komentar, dan dokumen untuk divisi, tim, dan proyek.',
    },
    {
        icon: LayoutGrid,
        title: 'Dashboard berbasis hasil kerja',
        description:
            'Pantau tugas selesai dan tenggat, bukan sekadar jam duduk.',
    },
];

/** Desktop left panel of the login page (mockup `Login`). */
export function LoginBrandPanel({ companyName }: { companyName: string }) {
    const { branding } = usePage().props;

    return (
        <aside className="relative hidden h-svh flex-col justify-between overflow-hidden bg-linear-to-br from-brand-50 via-surface-2 to-accent-blue/10 p-16 lg:sticky lg:top-0 lg:flex dark:from-brand-700/25 dark:via-background dark:to-accent-blue/10">
            {/* Guests get no company in `branding`; the name comes from the DB. */}
            <div className="flex items-center gap-3">
                {branding.logo ? (
                    <img
                        src={branding.logo}
                        alt=""
                        className="size-10 rounded-lg object-contain"
                    />
                ) : (
                    <span
                        aria-hidden
                        className="flex size-10 items-center justify-center rounded-lg bg-(image:--brand-gradient) text-sm font-semibold text-on-brand shadow-card"
                    >
                        {branding.shortName}
                    </span>
                )}
                <span className="grid leading-tight">
                    <span className="font-semibold text-text">
                        {branding.name}
                    </span>
                    <span className="text-xs text-text-muted">
                        {companyName}
                    </span>
                </span>
            </div>

            <div className="max-w-xl space-y-8">
                <div className="space-y-4">
                    <h2 className="text-4xl leading-tight font-semibold tracking-tight text-text">
                        Absensi, tugas, dan kolaborasi tim dalam satu tempat
                    </h2>
                    <p className="text-base text-text-muted">
                        Aplikasi kerja internal untuk seluruh karyawan{' '}
                        {companyName}.
                    </p>
                </div>

                <ul className="space-y-5">
                    {FEATURES.map(({ icon: Icon, title, description }) => (
                        <li key={title} className="flex gap-4">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-primary shadow-card">
                                <Icon className="size-5" aria-hidden />
                            </span>
                            <span className="space-y-0.5">
                                <span className="block font-medium text-text">
                                    {title}
                                </span>
                                <span className="block text-sm text-text-muted">
                                    {description}
                                </span>
                            </span>
                        </li>
                    ))}
                </ul>

                {/* Decorative preview of the app; not interactive. */}
                <div aria-hidden className="max-w-sm space-y-2.5 select-none">
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm shadow-card">
                        <span className="size-2 rounded-full bg-success" />
                        <span className="font-medium text-text">
                            Check-in berhasil
                        </span>
                        <span className="ml-auto text-xs text-text-muted">
                            <span className="font-mono">07.41</span> · Kantor
                            Pusat
                        </span>
                    </div>
                    <div className="ml-6 flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm shadow-card">
                        <span className="size-3 rounded-full border-2 border-warning" />
                        <span className="font-mono text-xs text-text-muted">
                            PLQ-21
                        </span>
                        <span className="truncate text-text">
                            Landing page produk baru
                        </span>
                        <span className="ml-auto text-xs text-text-muted">
                            4/7
                        </span>
                    </div>
                </div>
            </div>

            <p className="text-xs text-text-muted">
                Aplikasi internal {companyName} · hanya untuk karyawan terdaftar
            </p>
        </aside>
    );
}
