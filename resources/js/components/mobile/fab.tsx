import { Plus } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type Props = ComponentProps<'button'> & {
    label: string;
};

/**
 * Floating action button above the tab bar (MTugas "Tugas baru"): 60px,
 * radius 20, gradient aksi with glow; opens a quick-action sheet.
 */
export function Fab({ label, className, children, ...props }: Props) {
    return (
        <button
            type="button"
            aria-label={label}
            className={cn(
                'fixed right-[18px] z-30 flex size-15 items-center justify-center rounded-xl bg-primary bg-grad-aksi text-on-brand shadow-glow transition-transform duration-120 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring active:scale-95',
                'bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom)+12px)]',
                className,
            )}
            {...props}
        >
            {children ?? (
                <Plus className="size-7" strokeWidth={2.2} aria-hidden />
            )}
        </button>
    );
}
