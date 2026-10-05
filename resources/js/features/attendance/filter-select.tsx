import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const ALL = '__all__';

/**
 * Arus select for a list filter ("Semua lokasi", "Semua divisi"). `null`
 * means no filter; Radix Select cannot hold an empty value, hence the
 * sentinel.
 */
export function FilterSelect({
    label,
    allLabel,
    value,
    onChange,
    options,
    size = 'default',
    className,
}: {
    /** Accessible name ("Lokasi"). */
    label: string;
    allLabel: string;
    value: string | null;
    onChange: (value: string | null) => void;
    options: { id: string; name: string }[];
    size?: 'sm' | 'default';
    className?: string;
}) {
    return (
        <Select
            value={value ?? ALL}
            onValueChange={(next) => onChange(next === ALL ? null : next)}
        >
            <SelectTrigger
                aria-label={label}
                size={size}
                className={cn('min-w-44', className)}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={ALL}>{allLabel}</SelectItem>
                {options.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                        {option.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
