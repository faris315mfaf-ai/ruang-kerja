import { Lock } from 'lucide-react';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/format';
import type {
    FormCategory,
    RequestCategory,
    RequestDetail,
} from '@/types/requests';
import { DeviceDraftNotice } from './device-draft-notice';
import { CategoryFields } from './form-fields';
import { categoryLockReason } from './locks';
import { RequestSummary } from './request-summary';
import { RevisionBanner } from './revision-banner';
import type { RequestFormState } from './use-request-form';

type Props = {
    state: RequestFormState;
    categories: FormCategory[];
    request: RequestDetail | null;
    substitutes: { id: string; name: string; avatar: string | null }[];
    limits: { reason: number; max_files: number; max_kilobytes: number };
    today: string;
    savedAt: string | null;
};

/** "Disetujui oleh Dimas Pratama, lalu HR" (skipped steps left out). */
function flowSentence(state: RequestFormState): string | null {
    const steps = (state.preview?.flow ?? []).filter(
        (step) => step.status !== 'skipped',
    );

    if (steps.length === 0) {
        return null;
    }

    const names = steps.map((step) => step.approver?.name ?? step.label);

    return `Disetujui oleh ${names.join(', lalu ')}`;
}

/** MSFormPengajuan: category chips, fields, summary card, glass action bar. */
export function RequestFormMobile({
    state,
    categories,
    request,
    substitutes,
    limits,
    today,
    savedAt,
}: Props) {
    const { form, category, setCategory, submit, locked, sendBlocked } = state;
    const flow = flowSentence(state);
    // Locked categories (cuti & lembur, keputusan pemilik 6 Okt 2026) are not
    // chips: they are listed below with their lock reason.
    const open = categories.filter((item) => !categoryLockReason(item));
    const lockedCategories = categories.filter((item) =>
        categoryLockReason(item),
    );

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                submit('submit');
            }}
            className="flex flex-col gap-3.5 pb-44"
        >
            {savedAt && (
                <p className="flex items-center gap-1.5 text-meta text-text-muted">
                    <span
                        className="size-2 rounded-full bg-success"
                        aria-hidden
                    />{' '}
                    Draf tersimpan {formatTime(savedAt)}
                </p>
            )}

            {request && <RevisionBanner request={request} />}
            <DeviceDraftNotice state={state} mobile />

            {request === null && (
                <ChipScroller<RequestCategory>
                    label="Kategori pengajuan"
                    value={category}
                    onChange={setCategory}
                    chips={open.map((item) => ({
                        value: item.value,
                        label: item.label,
                    }))}
                    className="[&>button]:h-11 [&>button]:px-4 [&>button]:text-[16px] [&>button]:font-bold"
                />
            )}

            {request === null && lockedCategories.length > 0 && (
                <ul
                    aria-label="Jenis yang dikunci"
                    className="flex flex-col gap-1.5"
                >
                    {lockedCategories.map((item) => (
                        <li
                            key={item.value}
                            className="flex items-start gap-2.5 rounded-[14px] border border-dashed border-border-strong bg-surface-2 px-3.5 py-2.5 text-[15px] leading-[21px] text-text-muted"
                        >
                            <Lock
                                className="mt-0.5 size-4 shrink-0"
                                aria-hidden
                            />
                            <span>
                                <b className="font-bold text-text">
                                    {item.label}
                                </b>{' '}
                                · {categoryLockReason(item)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <CategoryFields
                state={state}
                substitutes={substitutes}
                limits={limits}
                mobile
            />

            <section
                className="flex flex-col gap-3 rounded-[18px] border border-border bg-surface px-4 py-3.5"
                aria-label="Ringkasan pengajuan"
            >
                <RequestSummary state={state} today={today} mobile />
            </section>

            <div className="glass fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))] z-30 flex flex-col gap-2 border-x-0 border-b-0 px-4 pt-3.5 pb-3">
                {flow && (
                    <p className="text-center text-[14px] text-text-muted">
                        {flow}
                    </p>
                )}
                <div className="flex gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="flex-1"
                        disabled={form.processing || locked}
                        onClick={() => submit('draft')}
                    >
                        Simpan draf
                    </Button>
                    <Button
                        type="submit"
                        size="lg"
                        className="flex-[1.6] text-[18px] font-extrabold"
                        disabled={
                            form.processing || locked || sendBlocked !== null
                        }
                    >
                        {request?.status === 'revision_requested'
                            ? 'Kirim ulang'
                            : 'Kirim pengajuan'}
                    </Button>
                </div>
            </div>
        </form>
    );
}
