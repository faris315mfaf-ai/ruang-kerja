import { cn } from '@/lib/utils';
import type { DocTocItem } from './types';

/** Table of contents (h2/h3) linking to the heading ids of the article. */
export function DocToc({
    items,
    className,
}: {
    items: DocTocItem[];
    className?: string;
}) {
    if (items.length === 0) {
        return null;
    }

    return (
        <ol className={cn('space-y-0.5 text-[14px]', className)}>
            {items.map((item) => (
                <li key={item.id}>
                    <a
                        href={`#${item.id}`}
                        className={cn(
                            'block min-h-8 rounded-sm py-1.5 pr-2 leading-5 text-text-muted transition-colors duration-120 ease-brand hover:bg-surface-2 hover:text-text',
                            item.level === 3 ? 'pl-5' : 'pl-2',
                        )}
                    >
                        {item.text}
                    </a>
                </li>
            ))}
        </ol>
    );
}
