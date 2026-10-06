import { router, useForm } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    Lock,
    MessageSquareText,
    Pencil,
    Plus,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import InputError from '@/components/input-error';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { fieldClasses } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { hiringUrls } from './lib';
import type { PositionSettingsProps } from './types';

type Question = PositionSettingsProps['questions'][number];

function QuestionForm({
    initial,
    submitLabel,
    onSubmit,
    onCancel,
    idPrefix,
    processing,
    errors,
}: {
    initial: { prompt: string; guidance: string; max_score: number };
    submitLabel: string;
    onSubmit: (data: {
        prompt: string;
        guidance: string;
        max_score: number;
    }) => void;
    onCancel?: () => void;
    idPrefix: string;
    processing: boolean;
    errors: Partial<Record<'prompt' | 'guidance' | 'max_score', string>>;
}) {
    const [data, setData] = useState(initial);

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit(data);
            }}
        >
            <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${idPrefix}-prompt`}>Pertanyaan</Label>
                <Textarea
                    id={`${idPrefix}-prompt`}
                    value={data.prompt}
                    maxLength={2000}
                    onChange={(event) =>
                        setData({ ...data, prompt: event.target.value })
                    }
                    required
                />
                <InputError message={errors.prompt} />
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_10rem]">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${idPrefix}-guidance`}>
                        Panduan untuk pewawancara (opsional)
                    </Label>
                    <Textarea
                        id={`${idPrefix}-guidance`}
                        value={data.guidance}
                        maxLength={2000}
                        className="min-h-16"
                        onChange={(event) =>
                            setData({ ...data, guidance: event.target.value })
                        }
                    />
                    <InputError message={errors.guidance} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${idPrefix}-max`}>Poin maksimal</Label>
                    <select
                        id={`${idPrefix}-max`}
                        value={data.max_score}
                        onChange={(event) =>
                            setData({
                                ...data,
                                max_score: Number(event.target.value),
                            })
                        }
                        className={cn(fieldClasses, 'h-control')}
                    >
                        {Array.from(
                            { length: 10 },
                            (_, index) => index + 1,
                        ).map((value) => (
                            <option key={value} value={value}>
                                {value}
                            </option>
                        ))}
                    </select>
                    <InputError message={errors.max_score} />
                </div>
            </div>
            <div className="flex gap-2">
                <Button
                    type="submit"
                    variant="tonal"
                    disabled={processing || data.prompt.trim().length < 3}
                >
                    {submitLabel}
                </Button>
                {onCancel && (
                    <Button type="button" variant="quiet" onClick={onCancel}>
                        Batal
                    </Button>
                )}
            </div>
        </form>
    );
}

/**
 * Interview questions of a position: add, edit, move up/down, delete while
 * no answer or points refer to them (locked questions show a lock).
 */
export function QuestionList({
    positionId,
    questions,
}: {
    positionId: string;
    questions: Question[];
}) {
    const [editing, setEditing] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const form = useForm({ prompt: '', guidance: '', max_score: 5 });

    const move = (index: number, direction: -1 | 1) => {
        const ids = questions.map((question) => question.id);
        const target = index + direction;

        if (target < 0 || target >= ids.length) {
            return;
        }

        [ids[index], ids[target]] = [ids[target], ids[index]];
        router.put(
            hiringUrls.reorder(positionId),
            { ids },
            {
                preserveScroll: true,
                onError: (errors) =>
                    toast.error(
                        Object.values(errors)[0] ??
                            'Gagal mengurutkan pertanyaan.',
                    ),
            },
        );
    };

    const save = (
        question: Question | null,
        data: { prompt: string; guidance: string; max_score: number },
    ) => {
        form.transform(() => data);

        if (question === null) {
            form.post(hiringUrls.questions(positionId), {
                preserveScroll: true,
                onSuccess: () => setAdding(false),
            });
        } else {
            form.put(hiringUrls.question(question.id), {
                preserveScroll: true,
                onSuccess: () => setEditing(null),
            });
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {questions.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={MessageSquareText}
                    title="Belum ada pertanyaan"
                    description="Pertanyaan muncul di tab Wawancara setiap kandidat."
                />
            ) : (
                <ol className="flex flex-col divide-y divide-divider rounded-lg border border-border">
                    {questions.map((question, index) => (
                        <li
                            key={question.id}
                            className="flex flex-col gap-3 px-4 py-4"
                        >
                            {editing === question.id ? (
                                <QuestionForm
                                    idPrefix={`q-${question.id}`}
                                    initial={{
                                        prompt: question.prompt,
                                        guidance: question.guidance ?? '',
                                        max_score: question.max_score,
                                    }}
                                    submitLabel="Simpan pertanyaan"
                                    onSubmit={(data) => save(question, data)}
                                    onCancel={() => setEditing(null)}
                                    processing={form.processing}
                                    errors={form.errors}
                                />
                            ) : (
                                <div className="flex items-start gap-3">
                                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[15px] font-bold text-text-muted tnum">
                                        {index + 1}
                                    </span>
                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                        <p className="text-[16px] font-semibold break-words text-text">
                                            {question.prompt}
                                        </p>
                                        <p className="text-meta text-text-muted">
                                            Poin 1–{question.max_score}
                                            {question.guidance
                                                ? ` · ${question.guidance}`
                                                : ''}
                                        </p>
                                        {question.locked && (
                                            <p className="inline-flex items-center gap-1.5 text-meta text-text-muted">
                                                <Lock
                                                    aria-hidden
                                                    className="size-3.5"
                                                />
                                                Sudah dijawab; tidak bisa
                                                dihapus
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label="Pindah ke atas"
                                            disabled={index === 0}
                                            onClick={() => move(index, -1)}
                                        >
                                            <ArrowUp aria-hidden />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label="Pindah ke bawah"
                                            disabled={
                                                index === questions.length - 1
                                            }
                                            onClick={() => move(index, 1)}
                                        >
                                            <ArrowDown aria-hidden />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label="Ubah pertanyaan"
                                            onClick={() => {
                                                form.clearErrors();
                                                setEditing(question.id);
                                            }}
                                        >
                                            <Pencil aria-hidden />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label="Hapus pertanyaan"
                                            disabled={question.locked}
                                            onClick={() => {
                                                if (
                                                    window.confirm(
                                                        'Hapus pertanyaan ini?',
                                                    )
                                                ) {
                                                    router.delete(
                                                        hiringUrls.question(
                                                            question.id,
                                                        ),
                                                        {
                                                            preserveScroll: true,
                                                            onError: (errors) =>
                                                                toast.error(
                                                                    Object.values(
                                                                        errors,
                                                                    )[0] ??
                                                                        'Gagal menghapus pertanyaan.',
                                                                ),
                                                        },
                                                    );
                                                }
                                            }}
                                        >
                                            <Trash2 aria-hidden />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </li>
                    ))}
                </ol>
            )}
            {adding ? (
                <div className="rounded-lg border border-border p-4">
                    <QuestionForm
                        idPrefix="q-new"
                        initial={{ prompt: '', guidance: '', max_score: 5 }}
                        submitLabel="Tambah pertanyaan"
                        onSubmit={(data) => save(null, data)}
                        onCancel={() => setAdding(false)}
                        processing={form.processing}
                        errors={form.errors}
                    />
                </div>
            ) : (
                <div>
                    <Button
                        type="button"
                        variant="tonal"
                        onClick={() => {
                            form.clearErrors();
                            setAdding(true);
                        }}
                    >
                        <Plus aria-hidden />
                        Tambah pertanyaan
                    </Button>
                </div>
            )}
        </div>
    );
}
