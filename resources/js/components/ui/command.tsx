import { Command as CommandPrimitive } from 'cmdk';
import { SearchIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

function Command({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
    return (
        <CommandPrimitive
            data-slot="command"
            className={cn(
                'flex h-full w-full flex-col overflow-hidden rounded-md text-text',
                className,
            )}
            {...props}
        />
    );
}

function CommandInput({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
    return (
        <div
            data-slot="command-input-wrapper"
            className="flex h-13 items-center gap-3 border-b border-border px-4"
        >
            <SearchIcon
                aria-hidden
                className="size-4.5 shrink-0 text-text-muted"
            />
            <CommandPrimitive.Input
                data-slot="command-input"
                className={cn(
                    'flex h-11 w-full bg-transparent text-[15px] text-text outline-hidden placeholder:text-text-subtle disabled:cursor-not-allowed disabled:opacity-50',
                    className,
                )}
                {...props}
            />
        </div>
    );
}

function CommandList({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
    return (
        <CommandPrimitive.List
            data-slot="command-list"
            className={cn(
                'max-h-[min(460px,60vh)] scroll-py-2 overflow-x-hidden overflow-y-auto',
                className,
            )}
            {...props}
        />
    );
}

function CommandEmpty(
    props: React.ComponentProps<typeof CommandPrimitive.Empty>,
) {
    return (
        <CommandPrimitive.Empty
            data-slot="command-empty"
            className="py-10 text-center text-sm text-text-muted"
            {...props}
        />
    );
}

function CommandGroup({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
    return (
        <CommandPrimitive.Group
            data-slot="command-group"
            className={cn(
                'overflow-hidden px-2 py-1.5 text-text [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-[.04em] [&_[cmdk-group-heading]]:text-text-muted [&_[cmdk-group-heading]]:uppercase',
                className,
            )}
            {...props}
        />
    );
}

function CommandSeparator({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
    return (
        <CommandPrimitive.Separator
            data-slot="command-separator"
            className={cn('mx-2 h-px bg-border', className)}
            {...props}
        />
    );
}

function CommandItem({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
    return (
        <CommandPrimitive.Item
            data-slot="command-item"
            className={cn(
                "relative flex min-h-9 cursor-default items-center gap-3 rounded-md border-l-2 border-transparent px-2 py-1.5 text-[13px] outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:border-primary data-[selected=true]:bg-surface-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                className,
            )}
            {...props}
        />
    );
}

function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
    return (
        <kbd
            className={cn(
                'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border px-1 font-mono text-[11px] text-text-muted',
                className,
            )}
            {...props}
        />
    );
}

export {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    Kbd,
};
