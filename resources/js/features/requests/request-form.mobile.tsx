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
    const { form, category, setCategory, submit } = state;
    const flow = flowSentence(state);

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
                    chips={categories.map((item) => ({
                        value: item.value,
                        label: item.label,
                    }))}
                    className="scroll-px-4 [&>button]:h-11 [&>button]:px-4 [&>button]:text-[16px] [&>button]:font-bold"
                />
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
                        disabled={form.processing}
                        onClick={() => submit('draft')}
                    >
                        Simpan draf
                    </Button>
                    <Button
                        type="submit"
                        size="lg"
                        className="flex-[1.6] text-[18px] font-extrabold"
                        disabled={form.processing}
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
