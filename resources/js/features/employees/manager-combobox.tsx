import { Command } from 'cmdk';
import { Check, ChevronDown, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { cn } from '@/lib/utils';
import type { ManagerOption } from './types';

type Props = {
    id?: string;
    value: string | null;
    onChange: (value: string | null) => void;
    options: ManagerOption[];
    /** The employee being edited cannot be their own manager. */
    excludeId?: string | null;
    invalid?: boolean;
};

/**
 * Searchable "atasan langsung" picker (cmdk). Cycles are validated on the
 * server (ValidManager); this only hides the employee themselves.
 */
export function ManagerCombobox({
    id,
    value,
    onChange,
    options,
    excludeId,
    invalid,
}: Props) {
    const [open, setOpen] = useState(false);
    const container = useRef<HTMLDivElement>(null);
    const listId = useId();
    const selected = options.find((option) => option.id === value) ?? null;

    useEffect(() => {
        if (!open) return;

        const close = (event: PointerEvent) => {
            if (!container.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener('pointerdown', close);

        return () => document.removeEventListener('pointerdown', close);
    }, [open]);

    return (
        <div ref={container} className="relative">
            <button
                id={id}
                type="button"
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-invalid={invalid || undefined}
                onClick={() => setOpen((current) => !current)}
                className="flex h-11 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:h-10 md:text-sm"
            >
                {selected ? (
                    <>
                        <UserAvatar
                            name={selected.name}
                            src={selected.avatar_url}
                            className="size-6"
                        />
                        <span className="truncate text-text">
                            {selected.name}
                        </span>
                        {selected.position && (
                            <span className="ml-auto truncate text-xs text-text-muted">
                                {selected.position}
                            </span>
                        )}
                    </>
                ) : (
                    <span className="text-text-subtle">
                        Tanpa atasan langsung
                    </span>
                )}
                <ChevronDown
                    aria-hidden
                    className={cn(
                        'size-4 shrink-0 text-text-muted',
                        !selected?.position && 'ml-auto',
                    )}
                />
            </button>

            {open && (
                <Command
                    id={listId}
                    label="Pilih atasan langsung"
                    className="glass absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg shadow-card"
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            event.stopPropagation();
                            setOpen(false);
                        }
                    }}
                >
                    <Command.Input
                        autoFocus
                        placeholder="Cari nama atau jabatan…"
                        className="h-10 w-full border-b border-border bg-transparent px-3 text-base text-text outline-none placeholder:text-text-subtle md:text-sm"
                    />
                    <Command.List className="max-h-64 overflow-y-auto p-1">
                        <Command.Empty className="px-3 py-6 text-center text-sm text-text-muted">
                            Tidak ada karyawan aktif yang cocok.
                        </Command.Empty>
                        {value !== null && (
                            <Command.Item
                                value="__none__ tanpa atasan"
                                onSelect={() => {
                                    onChange(null);
                                    setOpen(false);
                                }}
                                className="flex h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-text-muted data-[selected=true]:bg-surface-2"
                            >
                                <X aria-hidden className="size-4" />
                                Kosongkan atasan
                            </Command.Item>
                        )}
                        {options
                            .filter((option) => option.id !== excludeId)
                            .map((option) => (
                                <Command.Item
                                    key={option.id}
                                    value={`${option.name} ${option.position ?? ''} ${option.id}`}
                                    onSelect={() => {
                                        onChange(option.id);
                                        setOpen(false);
                                    }}
                                    className="flex h-10 cursor-pointer items-center gap-2 rounded-md px-2 text-sm data-[selected=true]:bg-surface-2"
                                >
                                    <UserAvatar
                                        name={option.name}
                                        src={option.avatar_url}
                                        className="size-6"
                                    />
                                    <span className="truncate text-text">
                                        {option.name}
                                    </span>
                                    <span className="ml-auto truncate text-xs text-text-muted">
                                        {option.position}
                                    </span>
                                    {option.id === value && (
                                        <Check
                                            aria-hidden
                                            className="size-4 shrink-0 text-primary"
                                        />
                                    )}
                                </Command.Item>
                            ))}
                    </Command.List>
                </Command>
            )}
        </div>
    );
}
