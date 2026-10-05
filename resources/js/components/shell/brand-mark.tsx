import { usePage } from '@inertiajs/react';
import { cn } from '@/lib/utils';

type Props = {
    className?: string;
    /** Show the app & company name next to the mark. */
    withName?: boolean;
    /** sm 34px (menu bar) · md 44px (auth) · lg 52px (rail). */
    size?: 'sm' | 'md' | 'lg';
};

const SIZES = {
    sm: 'size-[34px] rounded-[10px] text-[14px]',
    md: 'size-11 rounded-[13px] text-[17px]',
    lg: 'size-13 rounded-[16px] text-[17px]',
} as const;

/** App identity: logo, or the initials on the gradient merek (MenuBar / Main.dc.html). */
export function BrandMark({ className, withName = false, size = 'md' }: Props) {
    const { branding } = usePage().props;

    return (
        <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
            {branding.logo ? (
                <img
                    src={branding.logo}
                    alt=""
                    className={cn('shrink-0 object-contain', SIZES[size])}
                />
            ) : (
                <span
                    aria-hidden
                    className={cn(
                        'flex shrink-0 items-center justify-center bg-grad-merek font-extrabold text-on-brand shadow-(--dock-letter-shadow)',
                        SIZES[size],
                    )}
                >
                    {branding.shortName}
                </span>
            )}
            {withName && (
                <span className="grid min-w-0 leading-tight">
                    <span className="truncate text-[17px] font-bold tracking-[-0.01em] text-text">
                        {branding.name}
                    </span>
                    {/* Hidden while config/branding.php still has the
                        "[Nama Perusahaan]" placeholder (guest pages). */}
                    {branding.companyName &&
                        !branding.companyName.startsWith('[') && (
                            <span className="truncate text-meta text-text-muted">
                                {branding.companyName}
                            </span>
                        )}
                </span>
            )}
        </div>
    );
}
