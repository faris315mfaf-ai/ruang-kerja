import { usePage } from '@inertiajs/react';

const FEATURES = [
    'Check-in GPS & QR',
    'Board tugas realtime',
    'Portofolio proyek',
] as const;

/**
 * Two soft glows over the action gradient (DLogin left panel). Built from
 * tokens with color-mix so the panel keeps the same look in both themes.
 */
const PANEL_BACKGROUND = [
    'radial-gradient(600px 400px at 85% 15%, color-mix(in srgb, var(--accent-blue) 55%, transparent), transparent 70%)',
    'radial-gradient(600px 500px at 10% 90%, color-mix(in srgb, var(--brand-400) 45%, transparent), transparent 70%)',
    'var(--grad-aksi)',
].join(', ');

/** Desktop/tablet left panel of the login page (design DLogin). */
export function LoginBrandPanel({ companyName }: { companyName: string }) {
    const { branding } = usePage().props;

    return (
        <aside
            className="flex min-h-[420px] flex-col justify-between gap-10 px-10 py-14 text-on-brand lg:sticky lg:top-0 lg:h-svh lg:px-16"
            style={{ backgroundImage: PANEL_BACKGROUND }}
        >
            {/* Guests get no company in `branding`; the name comes from the DB. */}
            <div className="flex items-center gap-3">
                {branding.logo ? (
                    <img
                        src={branding.logo}
                        alt=""
                        className="size-11 rounded-[13px] bg-on-brand/20 object-contain"
                    />
                ) : (
                    <span
                        aria-hidden
                        className="flex size-11 items-center justify-center rounded-[13px] border border-on-brand/35 bg-on-brand/20 text-[17px] font-extrabold"
                    >
                        {branding.shortName}
                    </span>
                )}
                <span className="grid leading-tight">
                    <span className="text-[20px] font-bold">
                        {branding.name}
                    </span>
                    <span className="text-meta text-on-brand/85">
                        {companyName}
                    </span>
                </span>
            </div>

            <div className="flex max-w-[560px] flex-col gap-5">
                <p className="text-[40px] leading-[48px] font-extrabold tracking-[-0.03em] xl:text-[52px] xl:leading-[60px]">
                    Absen, kerja, dan pantau proyek dalam satu tempat.
                </p>
                <p className="text-[19px] leading-[30px]">
                    Satu akun kantor untuk semua karyawan. Data lokasi hanya
                    direkam saat check-in dan check-out.
                </p>
            </div>

            <ul className="flex flex-wrap gap-3" aria-label="Fitur utama">
                {FEATURES.map((feature) => (
                    <li
                        key={feature}
                        className="inline-flex h-10 items-center rounded-full border border-on-brand/30 bg-on-brand/15 px-4 text-[16px] font-semibold"
                    >
                        {feature}
                    </li>
                ))}
            </ul>
        </aside>
    );
}
