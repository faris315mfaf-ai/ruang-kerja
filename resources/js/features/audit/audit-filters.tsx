import { RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { actionOptions } from './labels';
import type { AuditFilters, AuditOptions } from './types';

const ALL = '__all__';

type Props = {
    filters: AuditFilters;
    options: AuditOptions;
    onChange: (filters: AuditFilters) => void;
};

function FilterSelect({
    id,
    label,
    value,
    placeholder,
    onChange,
    children,
}: {
    id: string;
    label: string;
    value: string | null;
    placeholder: string;
    onChange: (value: string | null) => void;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-1.5">
            <Label
                htmlFor={id}
                className="text-meta font-semibold text-text-muted"
            >
                {label}
            </Label>
            <Select
                value={value ?? ALL}
                onValueChange={(next) => onChange(next === ALL ? null : next)}
            >
                <SelectTrigger id={id} className="w-52">
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                    <SelectItem value={ALL}>{placeholder}</SelectItem>
                    <SelectSeparator />
                    {children}
                </SelectContent>
            </Select>
        </div>
    );
}

/** Aktor, aksi, subjek, and date range filters of the audit log. */
export function AuditFilterBar({ filters, options, onChange }: Props) {
    const set = (patch: Partial<AuditFilters>) =>
        onChange({ ...filters, ...patch });
    const active = Object.values(filters).some((value) => value !== null);

    return (
        <div className="flex flex-wrap items-end gap-3">
            <FilterSelect
                id="filter-actor"
                label="Aktor"
                value={filters.aktor}
                placeholder="Semua aktor"
                onChange={(aktor) => set({ aktor })}
            >
                {options.actors.map((actor) => (
                    <SelectItem key={actor.value} value={actor.value}>
                        {actor.label}
                    </SelectItem>
                ))}
            </FilterSelect>

            <FilterSelect
                id="filter-action"
                label="Aksi"
                value={filters.aksi}
                placeholder="Semua aksi"
                onChange={(aksi) => set({ aksi })}
            >
                {actionOptions(options.actions).map((option) => (
                    <SelectItem
                        key={option.value}
                        value={option.value}
                        className={option.group ? 'font-medium' : 'pl-5'}
                    >
                        {option.label}
                    </SelectItem>
                ))}
            </FilterSelect>

            <FilterSelect
                id="filter-subject"
                label="Subjek"
                value={filters.subjek}
                placeholder="Semua subjek"
                onChange={(subjek) => set({ subjek })}
            >
                {options.subjects.map((subject) => (
                    <SelectItem key={subject.value} value={subject.value}>
                        {subject.label}
                    </SelectItem>
                ))}
            </FilterSelect>

            <div className="grid gap-1.5">
                <Label
                    htmlFor="filter-from"
                    className="text-meta font-semibold text-text-muted"
                >
                    Dari tanggal
                </Label>
                <DateInput
                    id="filter-from"
                    value={filters.dari ?? ''}
                    max={filters.sampai ?? undefined}
                    onChange={(value) => set({ dari: value || null })}
                    className="w-60"
                />
            </div>

            <div className="grid gap-1.5">
                <Label
                    htmlFor="filter-to"
                    className="text-meta font-semibold text-text-muted"
                >
                    Sampai tanggal
                </Label>
                <DateInput
                    id="filter-to"
                    value={filters.sampai ?? ''}
                    min={filters.dari ?? undefined}
                    onChange={(value) => set({ sampai: value || null })}
                    className="w-60"
                />
            </div>

            {active && (
                <Button
                    type="button"
                    variant="quiet"
                    onClick={() =>
                        onChange({
                            aktor: null,
                            aksi: null,
                            subjek: null,
                            dari: null,
                            sampai: null,
                        })
                    }
                >
                    <RotateCcw />
                    Atur ulang
                </Button>
            )}
        </div>
    );
}
