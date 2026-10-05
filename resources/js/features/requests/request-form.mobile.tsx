import { ChipScroller } from '@/components/mobile/chip-scroller';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/format';
import type {
    FormCategory,
    RequestCategory,
    RequestDetail,
} from '@/types/requests';
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

/** MFormPengajuan: category chips, fields, summary card, bottom action bar. */
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

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                submit('submit');
            }}
            className="space-y-5 pb-24"
        >
            {savedAt && (
                <p className="flex items-center gap-1.5 text-[13px] text-text-muted">
                    <span
                        className="size-1.5 rounded-full bg-success"
                        aria-hidden
                    />{' '}
                    Draf {formatTime(savedAt)}
                </p>
            )}

            {request && <RevisionBanner request={request} />}

            {request === null && (
                <ChipScroller<RequestCategory>
                    label="Kategori pengajuan"
                    value={category}
                    onChange={setCategory}
                    chips={categories.map((item) => ({
                        value: item.value,
                        label: item.label,
                    }))}
                    className="[&>button]:h-11 [&>button]:px-4 [&>button]:text-[15px]"
                />
            )}

            <CategoryFields
                state={state}
                substitutes={substitutes}
                limits={limits}
                mobile
            />

            <section
                className="rounded-xl border border-border bg-surface p-4 shadow-card"
                aria-label="Ringkasan pengajuan"
            >
                <p className="mb-3 text-[13px] text-text-muted">Ringkasan</p>
                <RequestSummary state={state} today={today} mobile />
            </section>

            <div className="glass fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))] z-30 flex gap-3 border-x-0 border-b-0 px-4 py-3">
                <Button
                    type="button"
                    variant="outline"
                    className="h-12 flex-1 text-base"
                    disabled={form.processing}
                    onClick={() => submit('draft')}
                >
                    Simpan draf
                </Button>
                <Button
                    type="submit"
                    className="h-12 flex-[1.4] text-base"
                    disabled={form.processing}
                >
                    {request?.status === 'revision_requested'
                        ? 'Kirim ulang'
                        : 'Kirim pengajuan'}
                </Button>
            </div>
        </form>
    );
}
