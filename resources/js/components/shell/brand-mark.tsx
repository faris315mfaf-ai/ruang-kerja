import { usePage } from '@inertiajs/react';
import { cn } from '@/lib/utils';

type Props = {
    className?: string;
    /** Show the app & company name next to the mark. */
    withName?: boolean;
};

export function BrandMark({ className, withName = false }: Props) {
    const { branding } = usePage().props;

    return (
        <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
            {branding.logo ? (
                <img
                    src={branding.logo}
                    alt=""
                    className="size-8 shrink-0 rounded-md object-contain"
                />
            ) : (
                <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-md bg-(image:--brand-gradient) text-xs font-semibold text-on-brand"
                >
                    {branding.shortName}
                </span>
            )}
            {withName && (
                <span className="grid min-w-0 leading-tight">
                    <span className="truncate text-sm font-semibold text-text">
                        {branding.name}
                    </span>
                    {branding.companyName && (
                        <span className="truncate text-[11px] text-text-muted">
                            {branding.companyName}
                        </span>
                    )}
                </span>
            )}
        </div>
    );
}
