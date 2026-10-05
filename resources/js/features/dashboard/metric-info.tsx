import { Info } from 'lucide-react';
import { useState } from 'react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { MetricDefinition } from '@/types/dashboard';

type Props = {
    definition: Pick<MetricDefinition, 'label' | 'definition'> | string;
    className?: string;
};

/**
 * Info icon with the metric definition (PRD M7: every metric explains its
 * formula). Opens on hover/focus and on tap, so it also works on phones.
 */
export function MetricInfo({ definition, className }: Props) {
    const [open, setOpen] = useState(false);
    const label =
        typeof definition === 'string' ? 'Definisi' : definition.label;
    const text =
        typeof definition === 'string' ? definition : definition.definition;

    return (
        <Tooltip open={open} onOpenChange={setOpen}>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-label={`Definisi ${label}`}
                    onClick={(event) => {
                        event.preventDefault();
                        setOpen((value) => !value);
                    }}
                    className={cn(
                        'relative inline-flex size-4 shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        // 44px touch target without changing the layout.
                        'after:absolute after:-inset-3.5 after:content-[""]',
                        className,
                    )}
                >
                    <Info className="size-3.5" strokeWidth={1.75} aria-hidden />
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-72 leading-5">
                {text}
            </TooltipContent>
        </Tooltip>
    );
}
