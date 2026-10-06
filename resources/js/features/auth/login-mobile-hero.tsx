import { usePage } from '@inertiajs/react';

/**
 * Night aurora behind the phone login (design MLogin: teal top-left, blue
 * right, violet bottom over the night background). Tokens only.
 */
export const MOBILE_LOGIN_BACKGROUND = [
    'radial-gradient(420px 360px at 0% 0%, color-mix(in srgb, var(--fill-teal) 55%, transparent), transparent 70%)',
    'radial-gradient(420px 360px at 100% 30%, color-mix(in srgb, var(--accent-blue) 55%, transparent), transparent 70%)',
    'radial-gradient(360px 300px at 50% 100%, color-mix(in srgb, var(--fill-violet) 45%, transparent), transparent 70%)',
].join(', ');

/** Brand header of the phone login (design MLogin). */
export function LoginMobileHero({ companyName }: { companyName: string }) {
    const { branding } = usePage().props;

    return (
        <header className="flex flex-col gap-3.5 px-6 pt-14">
            {branding.logo ? (
                <img
                    src={branding.logo}
                    alt=""
                    className="size-16 rounded-[20px] object-contain shadow-glow"
                />
            ) : (
                <span
                    aria-hidden
                    className="flex size-16 items-center justify-center rounded-[20px] bg-grad-merek text-[22px] font-extrabold text-on-brand shadow-glow"
                >
                    {branding.shortName}
                </span>
            )}
            <span className="text-label font-bold text-text-muted">
                {branding.name} · {companyName}
            </span>
            <p className="text-[34px] leading-[42px] font-extrabold tracking-[-0.02em] text-text">
                Selamat datang kembali
            </p>
            <p className="text-body text-text-muted">
                Absen, kerja, dan pantau proyek dalam satu tempat. Masuk dengan
                email kantor dan kata sandi Anda.
            </p>
        </header>
    );
}
