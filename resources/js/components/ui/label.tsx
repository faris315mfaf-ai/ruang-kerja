import * as LabelPrimitive from '@radix-ui/react-label';
import * as React from 'react';

import { cn } from '@/lib/utils';

/** Field label: 15/22 semibold (Tipografi "label"). */
function Label({
    className,
    ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
    return (
        <LabelPrimitive.Root
            data-slot="label"
            className={cn(
                'text-[15px] leading-[22px] font-semibold text-text select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
                className,
            )}
            {...props}
        />
    );
}

export { Label };
