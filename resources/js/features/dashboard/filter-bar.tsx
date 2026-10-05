import { Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { DashboardFilterState, PeriodPresetKey } from '@/types/dashboard';
import { useDashboardFilters, withQuery } from './use-dashboard-filters';

const ALL = '__all';

type SegmentedProps<T extends string> = {
    label: string;
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    className?: string;
};

/** Segmented control (radiogroup), mockup Main "Minggu ini · Bulan ini · Kuartal". */
export function Segmented<T extends string>({
    label,
    options,
    value,
    onChange,
    className,
}: SegmentedProps<T>) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className={cn(
                'inline-flex rounded-lg border border-border bg-surface-2 p-0.5',
                className,
            )}
        >
            {options.map((option) => {
                const active = option.value === value;

                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            'h-9 flex-1 rounded-md px-3 text-sm whitespace-nowrap transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                            active
                                ? 'bg-surface font-medium text-text shadow-card'
                                : 'text-text-muted hover:text-text',
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

type Props = {
    filters: DashboardFilterState;
    exportUrl: string;
    /** Division/team selects (not on "Saya"). */
    withScope?: boolean;
    /** Presets offered (mobile shows two). */
    presets?: PeriodPresetKey[];
    className?: string;
};

/**
 * Period (minggu ini / bulan ini / kuartal / kustom), division and team
 * filters + "Ekspor" (Excel of the current view and filter).
 */
export function FilterBar({
    filters,
    exportUrl,
    withScope = true,
    presets,
    className,
}: Props) {
    const { current, apply, query } = useDashboardFilters(filters);
    const [custom, setCustom] = useState(current.periode === 'kustom');
    const [from, setFrom] = useState(filters.period.from);
    const [to, setTo] = useState(filters.period.to);
    const options = filters.presets.filter(
        (preset) => !presets || presets.includes(preset.value),
    );
    const teams = filters.teams.filter(
        (team) => !current.divisi || team.division_id === current.divisi,
    );

    return (
        <div className={cn('flex flex-wrap items-center gap-2', className)}>
            <Segmented
                label="Periode"
                options={options}
                value={custom ? 'kustom' : current.periode}
                onChange={(value) => {
                    if (value === 'kustom') {
                        setCustom(true);

                        return;
                    }

                    setCustom(false);
                    apply({ periode: value });
                }}
            />
            {custom && (
                <form
                    className="flex items-center gap-1.5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        apply({ periode: 'kustom', dari: from, sampai: to });
                    }}
                >
                    <label className="sr-only" htmlFor="dashboard-from">
                        Dari tanggal
                    </label>
                    <Input
                        id="dashboard-from"
                        type="date"
                        value={from}
                        max={to}
                        onChange={(event) => setFrom(event.target.value)}
                        className="h-9 w-38"
                    />
                    <span className="text-text-muted">–</span>
                    <label className="sr-only" htmlFor="dashboard-to">
                        Sampai tanggal
                    </label>
                    <Input
                        id="dashboard-to"
                        type="date"
                        value={to}
                        min={from}
                        onChange={(event) => setTo(event.target.value)}
                        className="h-9 w-38"
                    />
                    <Button type="submit" size="sm" variant="outline">
                        Terapkan
                    </Button>
                </form>
            )}
            {withScope && filters.divisions.length > 1 && (
                <Select
                    value={current.divisi ?? ALL}
                    onValueChange={(value) =>
                        apply({ divisi: value === ALL ? null : value })
                    }
                >
                    <SelectTrigger className="h-9 w-44" aria-label="Divisi">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>Semua divisi</SelectItem>
                        {filters.divisions.map((division) => (
                            <SelectItem key={division.id} value={division.id}>
                                {division.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
            {withScope && teams.length > 0 && (
                <Select
                    value={current.tim ?? ALL}
                    onValueChange={(value) =>
                        apply({ tim: value === ALL ? null : value })
                    }
                >
                    <SelectTrigger className="h-9 w-40" aria-label="Tim">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>Semua tim</SelectItem>
                        {teams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                                {team.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
            <Button asChild variant="outline" size="sm" className="h-9">
                <a href={withQuery(exportUrl, query)} download>
                    <Download aria-hidden />
                    Ekspor
                </a>
            </Button>
        </div>
    );
}
