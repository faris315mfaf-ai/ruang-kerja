import { Link } from '@inertiajs/react';
import {
    Building2,
    CalendarDays,
    Clock,
    FileClock,
    ShieldPlus,
    TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/format';
import { formatDays } from '@/lib/requests';
import { cn } from '@/lib/utils';
import { index as requestsIndex } from '@/routes/requests';
import type {
    FormCategory,
    RequestCategory,
    RequestDetail,
} from '@/types/requests';
import { CategoryFields } from './form-fields';
import { RequestSummary } from './request-summary';
import { RevisionBanner } from './revision-banner';
import type { RequestFormState } from './use-request-form';

export const categoryIcon: Record<RequestCategory, LucideIcon> = {
    leave: CalendarDays,
    permit: Clock,
    sick: ShieldPlus,
    overtime: TrendingUp,
    correction: FileClock,
    business_trip: Building2,
};

/** Second line of a category card ("Saldo 12 hari", "Surat bila > 1 hari"). */
export function categoryHint(category: FormCategory): string {
    const first =
        category.types.find((type) => type.eligible) ?? category.types[0];

    switch (category.value) {
        case 'leave':
            return first?.balance
                ? `Saldo ${formatDays(first.balance.available)} hari`
                : 'Tanpa saldo';
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
    const { form, category, setCategory, submit } = state;
    const editing = request !== null;

    return (
        <div className="mx-auto max-w-[1200px] space-y-6">
            <header>
                <h1 className="text-xl leading-7 font-semibold text-text">
                    {editing
                        ? `Ubah pengajuan${request.number ? ` ${request.number}` : ''}`
                        : 'Ajukan pengajuan'}
                </h1>
                <p className="text-sm text-text-muted">
                    Pilih jenis, isi detail, lalu kirim. Penyetuju akan
                    memutuskan secara berurutan.
                </p>
            </header>

            {request && <RevisionBanner request={request} />}

            <div
                role="radiogroup"
                aria-label="Kategori pengajuan"
                className="grid grid-cols-3 gap-3 xl:grid-cols-6"
            >
                {categories.map((item) => {
                    const Icon = categoryIcon[item.value];
                    const active = item.value === category;

                    return (
                        <button
                            key={item.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={editing}
                            onClick={() => setCategory(item.value)}
                            className={cn(
                                'flex items-center gap-3 rounded-lg border bg-surface p-3 text-left transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed',
                                active
                                    ? 'border-primary bg-brand-50 ring-1 ring-primary dark:bg-brand-500/10'
                                    : 'border-border hover:border-border-strong disabled:opacity-50',
                            )}
                        >
                            <span
                                className={cn(
                                    'flex size-9 shrink-0 items-center justify-center rounded-md',
                                    active
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-surface-2 text-text-muted',
                                )}
                            >
                                <Icon className="size-4.5" aria-hidden />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm font-medium text-text">
                                    {item.label}
                                </span>
                                <span
                                    className={cn(
                                        'block truncate text-xs',
                                        active
                                            ? 'text-primary'
                                            : 'text-text-muted',
                                    )}
                                >
                                    {categoryHint(item)}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,456px)]">
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit('submit');
                    }}
                    className="overflow-hidden rounded-xl border border-border bg-surface shadow-card"
                >
                    <div className="p-5">
                        <CategoryFields
                            state={state}
                            substitutes={substitutes}
                            limits={limits}
                        />
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-2/50 px-5 py-3">
                        <p className="text-[13px] text-text-muted">
                            {savedAt ? (
                                `Draf tersimpan ${formatTime(savedAt)}`
                            ) : (
                                <Link
                                    href={requestsIndex()}
                                    className="hover:underline"
                                >
                                    Kembali ke pengajuan saya
                                </Link>
                            )}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={form.processing}
                                onClick={() => submit('draft')}
                            >
                                Simpan draf
                            </Button>
                            <Button type="submit" disabled={form.processing}>
                                {request?.status === 'revision_requested'
                                    ? 'Kirim ulang'
                                    : 'Kirim pengajuan'}
                            </Button>
                        </div>
                    </div>
                </form>

                <aside
                    className="rounded-xl border border-border bg-surface p-5 shadow-card"
                    aria-label="Ringkasan pengajuan"
                >
                    <RequestSummary state={state} today={today} />
                </aside>
            </div>
        </div>
    );
}
