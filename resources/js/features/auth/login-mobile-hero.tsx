import { usePage } from '@inertiajs/react';
import { Building2 } from 'lucide-react';

/** Brand header of the mobile login (mockup `MLogin`); hidden on desktop. */
export function LoginMobileHero({ companyName }: { companyName: string }) {
    const { branding } = usePage().props;

    return (
        <header className="flex flex-col items-center gap-4 px-4 pt-16 pb-10 text-center lg:hidden">
            {branding.logo ? (
                <img
                    src={branding.logo}
                    alt=""
                    className="size-14 rounded-2xl object-contain"
                />
            ) : (
                <span
                    aria-hidden
                    className="flex size-14 items-center justify-center rounded-2xl bg-(image:--brand-gradient) text-xl font-semibold text-on-brand shadow-card"
                >
                    {branding.shortName}
                </span>
            )}
            <div className="space-y-1.5">
                <p className="text-2xl font-semibold text-text">
                    {branding.name}
                </p>
                <p className="mx-auto max-w-xs text-base text-text-muted">
                    Absensi, tugas, dan kolaborasi tim dalam satu tempat
                </p>
            </div>
            <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm text-text-muted">
                <Building2 className="size-4 shrink-0" aria-hidden />
                <span className="truncate">
                    Aplikasi internal {companyName}
                </span>
            </span>
        </header>
    );
}
