import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { CheckIcon, MinusIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/** 24px, radius 7: empty = 2px strong border, checked = gradient aksi + white check. */
function Checkbox({
    className,
    ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
    return (
        <CheckboxPrimitive.Root
            data-slot="checkbox"
            className={cn(
                'peer size-6 shrink-0 rounded-[7px] border-2 border-border-strong bg-surface text-on-brand transition-[background-color,border-color,box-shadow] duration-120 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger data-[state=checked]:border-0 data-[state=checked]:bg-primary data-[state=checked]:bg-grad-aksi data-[state=indeterminate]:border-0 data-[state=indeterminate]:bg-primary data-[state=indeterminate]:bg-grad-aksi',
                className,
            )}
            {...props}
        >
            <CheckboxPrimitive.Indicator
                data-slot="checkbox-indicator"
                className="group flex items-center justify-center text-current transition-none"
            >
                {props.checked === 'indeterminate' ? (
                    <MinusIcon className="size-4" strokeWidth={3} />
                ) : (
                    <CheckIcon className="size-4" strokeWidth={3} />
                )}
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    );
}

export { Checkbox };
