import { Plus, X } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    MAX_WORK_POINT_LENGTH,
    MAX_WORK_POINTS,
    POINTS_COPY,
} from '../work-points';
import type { PointsKind } from '../work-points';
import { resizeRowIds } from './plan-row-ids';

/**
 * Numbered points of the day: "Rencana kerja" at check-in, "Laporan kerja" at
 * check-out. Required (at least one non-blank point), up to 8 × 300 chars.
 */
export function WorkPointsEditor({
    kind,
    points,
    onChange,
    error,
    disabled = false,
}: {
    kind: PointsKind;
    points: string[];
    onChange: (next: string[]) => void;
    error: string | null;
    disabled?: boolean;
}) {
    const copy = POINTS_COPY[kind];
    const id = useId();
    const labelId = `${id}-label`;
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    // Stable row keys: removing a point must not move focus/IME state onto
    // the next input (index keys would).
    const [rowIds, setRowIds] = useState<string[]>(() =>
        resizeRowIds([], points.length),
    );

    if (rowIds.length !== points.length) {
        // Points reset from outside (new attempt): adjust during render.
        setRowIds(resizeRowIds(rowIds, points.length));
    }

    return (
        <div
            role="group"
            aria-labelledby={labelId}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            className="space-y-1.5"
        >
            <div>
                <p
                    id={labelId}
                    className="text-[15px] leading-[22px] font-semibold text-text"
                >
                    {copy.title}{' '}
                    <span className="font-normal text-text-muted">(wajib)</span>
                </p>
                <p id={hintId} className="text-meta text-text-muted">
                    {copy.hint}
                </p>
            </div>
            <ul className="space-y-1.5">
                {points.map((point, index) => (
                    <li
                        key={rowIds[index] ?? index}
                        className="flex items-center gap-1.5"
                    >
                        <span
                            aria-hidden
                            className="w-5 shrink-0 text-right text-[15px] font-bold text-text-muted tnum"
                        >
                            {index + 1}.
                        </span>
                        <Input
                            value={point}
                            onChange={(event) =>
                                onChange(
                                    points.map((value, i) =>
                                        i === index
                                            ? event.target.value
                                            : value,
                                    ),
                                )
                            }
                            maxLength={MAX_WORK_POINT_LENGTH}
                            enterKeyHint="next"
                            placeholder={
                                index === 0
                                    ? copy.placeholder
                                    : copy.placeholderNext
                            }
                            aria-label={`${copy.itemLabel} ${index + 1}`}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? errorId : undefined}
                            className="h-11"
                        />
                        {points.length > 1 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    setRowIds(
                                        rowIds.filter((_, i) => i !== index),
                                    );
                                    onChange(
                                        points.filter((_, i) => i !== index),
                                    );
                                }}
                                disabled={disabled}
                                aria-label={`Hapus poin ${index + 1}`}
                                className="size-11 shrink-0 text-text-muted"
                            >
                                <X aria-hidden />
                            </Button>
                        )}
                    </li>
                ))}
            </ul>
            {points.length < MAX_WORK_POINTS && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange([...points, ''])}
                    disabled={disabled}
                    className="min-h-11 text-text-muted"
                >
                    <Plus aria-hidden />
                    Tambah poin
                </Button>
            )}
            {error && (
                <p
                    id={errorId}
                    role="alert"
                    className="text-[15px] text-danger"
                >
                    {error}
                </p>
            )}
        </div>
    );
}
