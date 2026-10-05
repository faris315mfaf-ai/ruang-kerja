import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Native radio in Arus style (Komponen "Hari penuh"): 24px circle, 2px
 * strong border; checked = 7px teal ring. Keeps native keyboard behaviour
 * and form submission.
 */
function Radio({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
    return (
        <input
            type="radio"
            data-slot="radio"
            className={cn(
                'peer size-6 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-border-strong bg-surface transition-[border-color,border-width,box-shadow] duration-120 ease-brand outline-none checked:border-[7px] checked:border-primary focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                className,
            )}
            {...props}
        />
    );
}

export { Radio };
