import type { ReactNode } from 'react';
import InputError from '@/components/input-error';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

/** Radix Select cannot hold an empty value; this stands for "none". */
export const NONE = '__none__';

export function Field({
    id,
    label,
    hint,
    error,
    children,
}: {
    id: string;
    label: string;
    hint?: ReactNode;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            {children}
            {hint && !error && (
                <p className="text-meta text-text-muted">{hint}</p>
            )}
            <InputError message={error} />
        </div>
    );
}

export type SelectOption = {
    value: string;
    label: string;
    description?: string | null;
};

export function SelectField({
    id,
    value,
    onChange,
    options,
    placeholder,
    noneLabel,
    invalid,
}: {
    id: string;
    value: string | null;
    onChange: (value: string | null) => void;
    options: SelectOption[];
    placeholder: string;
    /** When set, an extra first item clears the value. */
    noneLabel?: string;
    invalid?: boolean;
}) {
    return (
        <Select
            value={value ?? (noneLabel ? NONE : undefined)}
            onValueChange={(next) => onChange(next === NONE ? null : next)}
        >
            <SelectTrigger
                id={id}
                className="w-full"
                aria-invalid={invalid || undefined}
            >
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
                {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        <span className="truncate">{option.label}</span>
                        {option.description && (
                            <span className="truncate text-meta text-text-muted">
                                {option.description}
                            </span>
                        )}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
