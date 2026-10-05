import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';
import { fieldClasses } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Arus field as a native <select> (Komponen "Input & formulir": 44px, radius
 * 12, strong border): keyboard & screen-reader friendly, supports an empty
 * value ("Semua …"), and opens the OS picker on phones. `size="sm"` = 36px
 * for dense editors (flow steps).
 */
export function NativeSelect({
    className,
    selectClassName,
    size = 'default',
    children,
    ...props
}: Omit<ComponentProps<'select'>, 'size'> & {
    size?: 'default' | 'sm';
    selectClassName?: string;
}) {
    return (
        <div className={cn('relative min-w-0', className)}>
            <select
                className={cn(
                    fieldClasses,
                    'appearance-none pr-10',
                    size === 'sm' ? 'h-9 rounded-[10px] text-[15px]' : 'h-11',
                    selectClassName,
                )}
                {...props}
            >
                {children}
            </select>
            <ChevronDown
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-text-muted"
            />
        </div>
    );
}
