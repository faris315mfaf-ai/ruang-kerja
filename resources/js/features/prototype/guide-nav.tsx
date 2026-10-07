import { Link } from '@inertiajs/react';
import { BookOpen, ChevronRight, FileText } from 'lucide-react';
import type { DocListItem } from '@/features/docs/types';
import { cn, focusRing } from '@/lib/utils';
import { guideHref } from './guide';

type Props = {
    documents: DocListItem[];
    guideSlug: string;
    currentSlug: string;
    /** `sidebar`: compact desktop list; `mobile`: full-width rows ≥ 48px. */
    variant: 'sidebar' | 'mobile';
};

/** The guide and the module docs of docs/fitur, guide first. */
export function GuideNav({
    documents,
    guideSlug,
    currentSlug,
    variant,
}: Props) {
    const mobile = variant === 'mobile';

    return (
        <nav
            aria-label="Dokumen panduan"
            className={cn(
                'flex flex-col gap-2',
                !mobile &&
                    'rounded-panel border border-border bg-surface p-4 shadow-card',
            )}
        >
            <p className="px-2 text-overline text-text-muted">
                {mobile ? 'Dokumen lain' : 'Panduan & modul'}
            </p>
            <ul
                className={cn(
                    'flex flex-col',
                    mobile &&
                        'divide-y divide-divider overflow-hidden rounded-[22px] border border-border bg-surface',
                )}
            >
                {documents.map((doc) => {
                    const current = doc.slug === currentSlug;
                    const Icon = doc.slug === guideSlug ? BookOpen : FileText;

                    return (
                        <li key={doc.slug}>
                            <Link
                                href={guideHref(doc.slug, guideSlug)}
                                prefetch
                                aria-current={current ? 'page' : undefined}
                                className={cn(
                                    'flex items-center gap-2.5 text-text transition-colors duration-120 ease-brand',
                                    mobile
                                        ? 'min-h-13 px-4 text-[16px] font-semibold hover:bg-surface-2/60 focus-visible:ring-inset'
                                        : 'min-h-10 rounded-control px-2 text-[15px] font-medium hover:bg-surface-2',
                                    current &&
                                        (mobile
                                            ? 'bg-link-soft text-link'
                                            : 'bg-link-soft font-semibold text-link hover:bg-link-soft'),
                                    focusRing,
                                )}
                            >
                                <Icon
                                    aria-hidden
                                    className="size-[18px] shrink-0"
                                    strokeWidth={2}
                                />
                                <span className="min-w-0 flex-1 truncate">
                                    {doc.title}
                                </span>
                                {mobile && (
                                    <ChevronRight
                                        aria-hidden
                                        className="size-[18px] shrink-0 text-text-subtle"
                                        strokeWidth={2.4}
                                    />
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
