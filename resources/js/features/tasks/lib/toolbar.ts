import { cn, focusRing } from '@/lib/utils';

/**
 * Toolbar control of the task views (DBoard "Filter", "Tampilan"): 40px,
 * radius 12, surface with a hairline border, semibold 15px.
 */
export const toolbarControl = cn(
    'inline-flex h-10 shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-3.5 text-[15px] font-semibold text-text transition-colors duration-120 ease-brand hover:bg-surface-2 [&_svg]:size-[18px] [&_svg]:shrink-0',
    focusRing,
);
