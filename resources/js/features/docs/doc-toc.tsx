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
        <ol className={cn('space-y-0.5 text-[13px]', className)}>
            {items.map((item) => (
                <li key={item.id}>
                    <a
                        href={`#${item.id}`}
                        className={cn(
                            'block min-h-7 rounded-md py-1 pr-2 leading-5 text-text-muted transition-colors duration-150 ease-brand hover:bg-surface-2 hover:text-text',
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
