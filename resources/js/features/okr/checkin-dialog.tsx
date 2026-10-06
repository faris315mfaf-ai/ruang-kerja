import type { FormEvent } from 'react';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatKrValue, parseKrNumber } from './lib';
import { Field, formIdFor, ResponsiveFormDialog } from './parts';
import type { KeyResult } from './types';

const TITLE = 'Check-in progres';

/** Weekly check-in of a key result: new value, confidence, note. */
export function CheckinDialog({
    open,
    onOpenChange,
    mobile,
    keyResult,
    processing,
    onSave,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mobile: boolean;
    keyResult: KeyResult | null;
    processing: boolean;
    onSave: (
        value: number,
        confidence: number | null,
        note: string,
    ) => Promise<boolean>;
}) {
    const id = useId();
    const [value, setValue] = useState('');
    const [confidence, setConfidence] = useState('7');
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && keyResult) {
            setValue(String(keyResult.current_value).replace('.', ','));
            setConfidence('7');
            setNote('');
            setError(null);
        }
    }, [open, keyResult]);

    if (!keyResult) {
        return null;
    }

    const format = (n: number) =>
        formatKrValue(n, keyResult.unit, keyResult.unit_label);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const parsed = parseKrNumber(value);

        if (parsed === null) {
            setError('Isi nilai berupa angka.');
            document.getElementById(`${id}-value`)?.focus();

            return;
        }

        if (await onSave(parsed, Number(confidence), note)) {
            onOpenChange(false);
        }
    };

    return (
        <ResponsiveFormDialog
            open={open}
            onOpenChange={onOpenChange}
            mobile={mobile}
            title={TITLE}
            description={keyResult.title}
            onSubmit={submit}
            actions={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Batal
                    </Button>
                    <Button
                        type="submit"
                        form={formIdFor(TITLE)}
                        disabled={processing}
                    >
                        {processing && <Spinner />}
                        Simpan check-in
                    </Button>
                </>
            }
        >
            <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-divider text-center">
                {[
                    ['Awal', keyResult.start_value],
                    ['Saat ini', keyResult.current_value],
                    ['Target', keyResult.target_value],
                ].map(([label, n]) => (
                    <div
                        key={label}
                        className="flex flex-col gap-0.5 bg-surface px-2 py-3"
                    >
                        <dt className="text-[13px] font-semibold text-text-muted">
                            {label}
                        </dt>
                        <dd className="text-[15px] font-bold tnum">
                            {format(n as number)}
                        </dd>
                    </div>
                ))}
            </dl>

            <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                <Field
                    id={`${id}-value`}
                    label="Nilai terbaru"
                    error={error ?? undefined}
                    hint="Desimal memakai koma"
                >
                    <Input
                        id={`${id}-value`}
                        inputMode="decimal"
                        autoComplete="off"
                        value={value}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={`${id}-value-hint`}
                        onChange={(event) => {
                            setValue(event.target.value);
                            setError(null);
                        }}
                    />
                </Field>
                <Field id={`${id}-confidence`} label="Keyakinan">
                    <Select value={confidence} onValueChange={setConfidence}>
                        <SelectTrigger
                            id={`${id}-confidence`}
                            className="w-full"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Array.from({ length: 10 }, (_, i) =>
                                String(10 - i),
                            ).map((level) => (
                                <SelectItem key={level} value={level}>
                                    {level}/10
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            </div>

            <Field id={`${id}-note`} label="Catatan (opsional)">
                <Textarea
                    id={`${id}-note`}
                    value={note}
                    rows={3}
                    maxLength={500}
                    placeholder="Apa yang berubah minggu ini? Ada hambatan?"
                    onChange={(event) => setNote(event.target.value)}
                />
            </Field>
        </ResponsiveFormDialog>
    );
}
