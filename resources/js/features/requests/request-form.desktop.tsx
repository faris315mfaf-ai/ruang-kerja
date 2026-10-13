import { Link } from '@inertiajs/react';
import { ChevronLeft, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/format';
import { formatDays } from '@/lib/requests';
import { cn, focusRing } from '@/lib/utils';
import { index as requestsIndex } from '@/routes/requests';
import type { FormCategory, RequestDetail } from '@/types/requests';
import { DeviceDraftNotice } from './device-draft-notice';
import { CategoryFields } from './form-fields';
import { categoryLockReason } from './locks';
import { RequestSummary } from './request-summary';
import { RevisionBanner } from './revision-banner';
import type { RequestFormState } from './use-request-form';

/** Second line of a category card ("Saldo 12 hari", "Surat bila > 1 hari"). */
export function categoryHint(category: FormCategory): string {
    const first =
        category.types.find((type) => type.eligible) ?? category.types[0];

    switch (category.value) {
        case 'leave':
            // Staff get no balance (keputusan pemilik 6 Okt 2026).
            return first?.balance
                ? `Saldo ${formatDays(first.balance.available)} hari`
                : first?.annual_quota_days
                  ? 'Memotong saldo cuti'
                  : 'Hari kerja';
        case 'permit':
            return 'Per jam atau hari';
        case 'sick':
            return first?.requires_attachment_after_days !== null &&
                first?.requires_attachment_after_days !== undefined
                ? `Surat bila > ${first.requires_attachment_after_days} hari`
                : 'Tidak memotong cuti';
        case 'overtime':
            return 'Perlu penugasan';
        case 'correction':
            return first?.max_backdate_days !== null &&
                first?.max_backdate_days !== undefined
                ? `Maks. ${first.max_backdate_days} hari lalu`
                : 'Jam masuk/pulang';
        case 'procurement':
            return 'Atasan, lalu Direksi';
        default:
            return 'Absen dari lokasi lain';
    }
}

type Props = {
    state: RequestFormState;
    categories: FormCategory[];
    request: RequestDetail | null;
    substitutes: { id: string; name: string; avatar: string | null }[];
    limits: { reason: number; max_files: number; max_kilobytes: number };
    today: string;
    savedAt: string | null;
};

export function RequestFormDesktop({
    state,
    categories,
    request,
    substitutes,
    limits,
    today,
    savedAt,
}: Props) {
    const { form, category, setCategory, submit, locked, sendBlocked } = state;
    const editing = request !== null;

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                submit('submit');
            }}
            className="flex flex-col gap-6"
        >
            <header className="flex flex-col gap-2">
                <Button
                    asChild
                    variant="quiet"
                    className="-ml-3 self-start text-[16px]"
                >
                    <Link href={requestsIndex()}>
                        <ChevronLeft aria-hidden strokeWidth={2.2} />
                        Pengajuan saya
                    </Link>
                </Button>
                <h1 className="text-display text-text">
                    {editing
                        ? `Ubah pengajuan${request.number ? ` ${request.number}` : ''}`
                        : 'Ajukan baru'}
                </h1>
                <p className="text-body-lg text-text-muted">
                    Pilih jenis, isi detail, lalu kirim. Penyetuju akan
                    memutuskan secara berurutan.
                </p>
            </header>

            {request && <RevisionBanner request={request} />}
            <DeviceDraftNotice state={state} />

            <div className="flex flex-wrap items-start gap-5">
                <section
                    aria-label="Detail pengajuan"
                    className="flex min-w-0 flex-[999_1_620px] flex-col gap-6 rounded-panel border border-border bg-surface p-6 shadow-card lg:p-7"
                >
                    <div className="flex flex-col gap-3">
                        <span
                            id="kategori-label"
                            className="text-[16px] font-bold text-text"
                        >
                            Jenis pengajuan
                        </span>
                        <div
                            role="radiogroup"
                            aria-labelledby="kategori-label"
                            className="grid grid-cols-2 gap-2.5 md:grid-cols-3"
                        >
                            {categories.map((item) => {
                                const active = item.value === category;
                                const lockReason = categoryLockReason(item);

                                if (lockReason && !active) {
                                    return (
                                        <div
                                            key={item.value}
                                            role="radio"
                                            aria-checked={false}
                                            aria-disabled
                                            title={lockReason}
                                            className="flex min-h-[76px] cursor-not-allowed flex-col gap-1 rounded-lg border border-dashed border-border-strong bg-surface-2 px-3.5 py-3 text-left text-text-muted"
                                        >
                                            <span className="flex items-center gap-1.5 text-[17px] leading-6 font-bold">
                                                <Lock
                                                    className="size-4 shrink-0"
                                                    aria-hidden
                                                />
                                                {item.label}
                                                <span className="sr-only">
                                                    (dikunci)
                                                </span>
                                            </span>
                                            <span className="line-clamp-2 text-[14px] leading-5 font-medium">
                                                {lockReason}
                                            </span>
                                        </div>
                                    );
                                }

                                return (
                                    <button
                                        key={item.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        disabled={editing}
                                        onClick={() => setCategory(item.value)}
                                        className={cn(
                                            'flex min-h-[76px] flex-col gap-1 rounded-lg px-3.5 py-3 text-left transition-[background-color,border-color,box-shadow] duration-120 ease-brand disabled:cursor-not-allowed',
                                            focusRing,
                                            active
                                                ? 'bg-primary bg-grad-aksi text-on-brand shadow-button'
                                                : 'border border-border bg-surface text-text hover:border-border-strong disabled:opacity-50',
                                        )}
                                    >
                                        <span className="text-[17px] leading-6 font-bold">
                                            {item.label}
                                        </span>
                                        <span
                                            className={cn(
                                                'truncate text-[14px] font-medium',
                                                active
                                                    ? 'text-on-brand'
                                                    : 'text-text-muted',
                                            )}
                                        >
                                            {categoryHint(item)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <CategoryFields
                        state={state}
                        substitutes={substitutes}
                        limits={limits}
                    />
                </section>

                <aside
                    className="flex min-w-0 flex-[1_1_360px] flex-col gap-4 lg:sticky lg:top-[calc(var(--menu-bar-height)+20px)]"
                    aria-label="Ringkasan pengajuan"
                >
                    <section className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-6 shadow-float">
                        <h2 className="text-h3 text-text">Ringkasan</h2>
                        <RequestSummary state={state} today={today} />
                    </section>
                    <Button
                        type="submit"
                        size="xl"
                        className="w-full text-[18px] font-extrabold"
                        disabled={
                            form.processing || locked || sendBlocked !== null
                        }
                    >
                        {request?.status === 'revision_requested'
                            ? 'Kirim ulang'
                            : 'Kirim pengajuan'}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-full"
                        disabled={form.processing || locked}
                        onClick={() => submit('draft')}
                    >
                        Simpan sebagai draf
                    </Button>
                    {savedAt && (
                        <p className="text-center text-meta text-text-muted">
                            Draf tersimpan {formatTime(savedAt)}
                        </p>
                    )}
                </aside>
            </div>
        </form>
    );
}
