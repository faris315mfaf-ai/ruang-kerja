import { router, useForm } from '@inertiajs/react';
import { ListChecks, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import InputError from '@/components/input-error';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { fieldClasses, Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/lib/format';
import { requestJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import { groupChecklist, hiringUrls, isFinal, ROLE_LABELS } from './lib';
import type { CandidateProfileProps, ChecklistEntry } from './types';
import { errorMessage } from './use-autosave';

function ChecklistRow({
    item,
    onChange,
}: {
    item: ChecklistEntry;
    onChange: (item: ChecklistEntry) => void;
}) {
    const [noteOpen, setNoteOpen] = useState(false);
    const [note, setNote] = useState(item.note ?? '');
    const [busy, setBusy] = useState(false);
    const checked = item.checked_at !== null;

    const send = (nextChecked: boolean, nextNote: string) => {
        const previous = item;

        onChange({
            ...item,
            checked_at: nextChecked
                ? (item.checked_at ?? new Date().toISOString())
                : null,
            note: nextNote.trim() === '' ? null : nextNote.trim(),
        });
        setBusy(true);
        requestJson<{ checked_at: string | null; note: string | null }>(
            hiringUrls.checklistItem(item.id),
            { method: 'PATCH', body: { checked: nextChecked, note: nextNote } },
        )
            .then((saved) => {
                onChange({
                    ...item,
                    checked_at: saved.checked_at,
                    note: saved.note,
                });
                router.reload({ only: ['checklist', 'blockers'] });
            })
            .catch((error: unknown) => {
                onChange(previous);
                toast.error(errorMessage(error));
            })
            .finally(() => setBusy(false));
    };

    return (
        <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start gap-3">
                <Checkbox
                    id={`check-${item.id}`}
                    checked={checked}
                    disabled={!item.can_check || busy}
                    onCheckedChange={(state) => send(state === true, note)}
                    className="mt-0.5"
                    aria-describedby={`check-${item.id}-meta`}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <label
                        htmlFor={`check-${item.id}`}
                        className={cn(
                            'text-[16px] leading-6 font-semibold',
                            checked
                                ? 'text-text-muted line-through'
                                : 'text-text',
                            item.can_check && 'cursor-pointer',
                        )}
                    >
                        {item.label}
                    </label>
                    <span
                        id={`check-${item.id}-meta`}
                        className="text-meta text-text-muted"
                    >
                        {item.required ? 'Wajib' : 'Opsional'}
                        {checked && item.checked_at
                            ? ` · dicentang ${item.checked_by ? `${item.checked_by.name}, ` : ''}${formatDateTime(item.checked_at)}`
                            : ''}
                    </span>
                    {item.note && !noteOpen && (
                        <span className="text-meta break-words whitespace-pre-wrap text-text">
                            Catatan: {item.note}
                        </span>
                    )}
                </div>
                {item.can_check && (
                    <Button
                        type="button"
                        variant="quiet"
                        size="sm"
                        onClick={() => setNoteOpen((open) => !open)}
                        aria-expanded={noteOpen}
                    >
                        Catatan
                    </Button>
                )}
                {item.can_delete && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Hapus butir ${item.label}`}
                        onClick={() =>
                            router.delete(hiringUrls.checklistItem(item.id), {
                                preserveScroll: true,
                                onError: (errors) =>
                                    toast.error(
                                        Object.values(errors)[0] ??
                                            'Gagal menghapus butir.',
                                    ),
                            })
                        }
                    >
                        <Trash2 aria-hidden />
                    </Button>
                )}
            </div>
            {noteOpen && item.can_check && (
                <div className="flex flex-col gap-2 pl-9">
                    <Label htmlFor={`note-${item.id}`} className="sr-only">
                        Catatan untuk {item.label}
                    </Label>
                    <Textarea
                        id={`note-${item.id}`}
                        value={note}
                        maxLength={2000}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Catatan (opsional)"
                        className="min-h-16"
                    />
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                                send(checked, note);
                                setNoteOpen(false);
                            }}
                        >
                            Simpan catatan
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="quiet"
                            onClick={() => setNoteOpen(false)}
                        >
                            Batal
                        </Button>
                    </div>
                </div>
            )}
        </li>
    );
}

function AddItemForm({
    candidateId,
    reviewers,
}: {
    candidateId: string;
    reviewers: CandidateProfileProps['reviewers'];
}) {
    const form = useForm({ label: '', reviewer_id: '', required: true });
    const options = [
        ...reviewers.interviewers.map((person) => ({
            id: person.id,
            label: `${person.name} · Pewawancara`,
        })),
        ...reviewers.approvers
            .filter(
                (person) =>
                    !reviewers.interviewers.some(
                        (other) => other.id === person.id,
                    ),
            )
            .map((person) => ({
                id: person.id,
                label: `${person.name} · Penyetuju akhir`,
            })),
    ];

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                form.transform((data) => ({
                    ...data,
                    reviewer_id: data.reviewer_id || null,
                }));
                form.post(hiringUrls.checklist(candidateId), {
                    preserveScroll: true,
                    onSuccess: () => form.reset(),
                });
            }}
        >
            <p className="text-label text-text">Tambah butir</p>
            <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="checklist-label" className="sr-only">
                        Butir checklist
                    </Label>
                    <Input
                        id="checklist-label"
                        value={form.data.label}
                        maxLength={200}
                        placeholder="Mis. Cek referensi kerja"
                        onChange={(event) =>
                            form.setData('label', event.target.value)
                        }
                        required
                    />
                    <InputError message={form.errors.label} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="checklist-reviewer" className="sr-only">
                        Pemeriksa
                    </Label>
                    <select
                        id="checklist-reviewer"
                        value={form.data.reviewer_id}
                        onChange={(event) =>
                            form.setData('reviewer_id', event.target.value)
                        }
                        className={cn(fieldClasses, 'h-control')}
                    >
                        <option value="">HR</option>
                        {options.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <InputError message={form.errors.reviewer_id} />
                </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex min-h-11 items-center gap-2.5 text-[15px] text-text">
                    <Checkbox
                        checked={form.data.required}
                        onCheckedChange={(state) =>
                            form.setData('required', state === true)
                        }
                    />
                    Wajib sebelum Keputusan akhir
                </label>
                <Button
                    type="submit"
                    variant="tonal"
                    disabled={form.processing}
                >
                    <Plus aria-hidden />
                    Tambah butir
                </Button>
            </div>
        </form>
    );
}

/**
 * Tab Checklist: HR items and one group per reviewer. Everyone ticks only
 * their own items (HR items: any HR); HR adds and removes items.
 */
export function ChecklistTab({
    candidate,
    checklist,
    reviewers,
    can,
    blockers,
}: Pick<
    CandidateProfileProps,
    'candidate' | 'checklist' | 'reviewers' | 'can' | 'blockers'
>) {
    const [items, setItems] = useState(checklist);

    useEffect(() => setItems(checklist), [checklist]);

    const groups = groupChecklist(items);
    const update = (next: ChecklistEntry) =>
        setItems((current) =>
            current.map((item) => (item.id === next.id ? next : item)),
        );

    return (
        <div className="flex flex-col gap-5">
            {!isFinal(candidate.stage) &&
                candidate.stage !== 'final_review' && (
                    <p
                        className={cn(
                            'rounded-lg border px-5 py-3.5 text-[15px]',
                            blockers.before_final > 0
                                ? 'border-warning-soft bg-warning-soft text-warning'
                                : 'border-success-soft bg-success-soft text-success',
                        )}
                    >
                        {blockers.before_final > 0
                            ? `${blockers.before_final} butir wajib HR & pewawancara belum dicentang. Kandidat baru bisa masuk Keputusan akhir setelah semuanya selesai.`
                            : 'Checklist wajib HR & pewawancara lengkap. Kandidat siap masuk Keputusan akhir.'}
                    </p>
                )}
            {groups.length === 0 ? (
                <EmptyState
                    icon={ListChecks}
                    title="Belum ada butir checklist"
                />
            ) : (
                groups.map((group) => (
                    <Panel
                        key={group.key}
                        title={group.title}
                        action={
                            <Badge variant="label" className="h-7">
                                {ROLE_LABELS[group.role]}
                            </Badge>
                        }
                    >
                        <ul className="flex flex-col divide-y divide-divider">
                            {group.items.map((item) => (
                                <ChecklistRow
                                    key={item.id}
                                    item={item}
                                    onChange={update}
                                />
                            ))}
                        </ul>
                    </Panel>
                ))
            )}
            {can.manage && !isFinal(candidate.stage) && (
                <Panel title="Butir tambahan">
                    <AddItemForm
                        candidateId={candidate.id}
                        reviewers={reviewers}
                    />
                </Panel>
            )}
        </div>
    );
}
