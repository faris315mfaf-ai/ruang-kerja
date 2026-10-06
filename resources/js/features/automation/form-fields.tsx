import type { ReactNode } from 'react';
import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** 17px on phones (no iOS zoom), 16px from tablet up; 48/44px tall. */
export const FIELD_SIZE = 'h-12 text-[17px] md:h-11 md:text-[16px]';

export type Option = { value: string; label: ReactNode; group?: string };

function FieldError({ id, error }: { id: string; error?: string }) {
    if (!error) {
        return null;
    }

    return (
        <p id={id} role="alert" className="text-meta font-semibold text-danger">
            {error}
        </p>
    );
}

export function SelectField({
    label,
    hideLabel = false,
    value,
    onChange,
    options,
    placeholder = 'Pilih…',
    error,
    className,
    disabled,
}: {
    label: string;
    hideLabel?: boolean;
    value: string | null;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    error?: string;
    className?: string;
    disabled?: boolean;
}) {
    const id = useId();
    const groups = [...new Set(options.map((o) => o.group ?? ''))];

    return (
        <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
            <Label htmlFor={id} className={cn(hideLabel && 'sr-only')}>
                {label}
            </Label>
            <Select
                value={value ?? ''}
                onValueChange={onChange}
                disabled={disabled}
            >
                <SelectTrigger
                    id={id}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className={cn('w-full', FIELD_SIZE)}
                >
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {groups.map((group) =>
                        group === '' ? (
                            options
                                .filter((o) => !o.group)
                                .map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))
                        ) : (
                            <SelectGroup key={group}>
                                <SelectLabel>{group}</SelectLabel>
                                {options
                                    .filter((o) => o.group === group)
                                    .map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </SelectItem>
                                    ))}
                            </SelectGroup>
                        ),
                    )}
                </SelectContent>
            </Select>
            <FieldError id={`${id}-error`} error={error} />
        </div>
    );
}

export function TextField({
    label,
    value,
    onChange,
    error,
    placeholder,
    type = 'text',
    hint,
    className,
    inputClassName,
    min,
    max,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    placeholder?: string;
    type?: 'text' | 'date' | 'number';
    hint?: ReactNode;
    className?: string;
    inputClassName?: string;
    min?: string | number;
    max?: string | number;
}) {
    const id = useId();

    return (
        <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type={type}
                value={value}
                min={min}
                max={max}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={
                    error ? `${id}-error` : hint ? `${id}-hint` : undefined
                }
                className={cn(FIELD_SIZE, inputClassName)}
            />
            {error ? (
                <FieldError id={`${id}-error`} error={error} />
            ) : (
                hint && (
                    <p id={`${id}-hint`} className="text-meta text-text-muted">
                        {hint}
                    </p>
                )
            )}
        </div>
    );
}
