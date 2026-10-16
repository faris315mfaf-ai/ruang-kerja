import { Search, UserRoundCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { SegmentedTabs } from '@/components/ui/tabs';
import { useSearch } from '@/features/search/use-search';
import { cn } from '@/lib/utils';
import briefingRoutes from '@/routes/briefings';
import { submitBriefingForm } from './api';
import {
    candidateFromResult,
    delegateSelectionError,
    shortPeriodLabel,
    type DelegateCandidate,
} from './briefing-state';
import type {
    BriefingCardData,
    BriefingPeriodInfo,
    BriefingPeriodValue,
} from './types';

/** Minimum before the people provider searches (PeopleSearchProvider). */
const MIN_QUERY = 2;

/**
 * "Delegasikan" (HR / Super Admin): pick a period that can still be handed
 * over and a colleague from the company people search — one appointment for
 * today; re-delegating replaces the previous target.
 */
export function BriefingDelegateDialog({
    briefing,
    periods,
    open,
    onOpenChange,
    mobile = false,
}: {
    briefing: BriefingCardData;
    /** Still delegatable periods (not finished, no note yet). */
    periods: BriefingPeriodInfo[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mobile?: boolean;
}) {
    const viewerId = usePage().props.auth.user?.id;
    const [period, setPeriod] = useState<BriefingPeriodValue | null>(
        periods[0]?.value ?? null,
    );
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<DelegateCandidate | null>(null);
    const [processing, setProcessing] = useState(false);
    const { groups, loading, error } = useSearch(query, 'people', open);

    // Fresh state every time the dialog opens.
    useEffect(() => {
        if (open) {
            setPeriod(periods[0]?.value ?? null);
            setQuery('');
            setSelected(null);
        }
    }, [open, periods]);

    const candidates = useMemo(
        () =>
            (groups.find((group) => group.key === 'people')?.items ?? [])
                .map(candidateFromResult)
                .filter(
                    (candidate): candidate is DelegateCandidate =>
                        candidate !== null && candidate.id !== viewerId,
                ),
        [groups, viewerId],
    );

    const existing = period !== null ? briefing.delegations[period] : undefined;
    const selectionError = delegateSelectionError(period, selected?.id ?? null);
    const confirmDisabled = processing || selectionError !== null;
    const searching = query.trim().length >= MIN_QUERY;

    const confirm = async () => {
        if (confirmDisabled || period === null || selected === null) {
            return;
        }

        setProcessing(true);
        const ok = await submitBriefingForm(
            briefingRoutes.delegate(),
            { user_id: selected.id, period },
            'Delegasi gagal disimpan.',
        );
        setProcessing(false);

        if (ok) {
            onOpenChange(false);
        }
    };

    const statusText = error
        ? 'Pencarian gagal dimuat. Coba lagi.'
        : !searching
          ? 'Ketik minimal 2 huruf nama karyawan.'
          : loading
            ? 'Mencari karyawan…'
            : candidates.length === 0
              ? 'Tidak ada karyawan dengan nama itu.'
              : selected
                ? `Dipilih: ${selected.name}.`
                : 'Pilih karyawan yang akan mencatat.';

    const body = (
        <div className="flex flex-col gap-5">
            {periods.length > 1 && (
                <div className="flex flex-col gap-2">
                    <Label>Periode briefing</Label>
                    <SegmentedTabs
                        label="Periode briefing"
                        semantics="radio"
                        value={period ?? periods[0].value}
                        onValueChange={setPeriod}
                        options={periods.map((item) => ({
                            value: item.value,
                            label: shortPeriodLabel(item.value),
                        }))}
                        className="w-full [&>button]:flex-1"
                    />
                </div>
            )}

            <div className="flex flex-col gap-2">
                <Label htmlFor="briefing-delegate-search">Cari karyawan</Label>
                <div className="relative">
                    <Search
                        aria-hidden
                        className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-text-subtle"
                    />
                    <Input
                        id="briefing-delegate-search"
                        type="search"
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setSelected(null);
                        }}
                        placeholder="Ketik nama karyawan…"
                        className="pl-10"
                        autoComplete="off"
                    />
                </div>
                <p role="status" className="text-[14px] text-text-muted">
                    {statusText}
                </p>
            </div>

            {searching && (
                <ul
                    aria-label="Hasil pencarian karyawan"
                    className="flex max-h-72 flex-col gap-1 overflow-y-auto"
                >
                    {loading
                        ? Array.from({ length: 3 }, (_, index) => (
                              <li
                                  key={index}
                                  className="flex min-h-14 items-center gap-3 px-2"
                              >
                                  <Skeleton className="size-9 rounded-full" />
                                  <span className="flex flex-1 flex-col gap-1.5">
                                      <Skeleton className="h-4 w-36" />
                                      <Skeleton className="h-3 w-24" />
                                  </span>
                              </li>
                          ))
                        : candidates.map((candidate) => {
                              const active = selected?.id === candidate.id;

                              return (
                                  <li key={candidate.id}>
                                      <button
                                          type="button"
                                          aria-pressed={active}
                                          onClick={() => setSelected(candidate)}
                                          className={cn(
                                              'flex min-h-14 w-full items-center gap-3 rounded-control px-2 text-left transition-colors duration-120 ease-brand outline-none hover:bg-surface-2/60 focus-visible:ring-[3px] focus-visible:ring-ring',
                                              active && 'bg-link-soft/70',
                                          )}
                                      >
                                          <UserAvatar
                                              name={candidate.name}
                                              src={candidate.avatar}
                                              className="size-9 text-[13px]"
                                          />
                                          <span className="flex min-w-0 flex-1 flex-col">
                                              <span className="truncate text-[16px] font-semibold text-text">
                                                  {candidate.name}
                                              </span>
                                              {candidate.note && (
                                                  <span className="truncate text-[14px] text-text-muted">
                                                      {candidate.note}
                                                  </span>
                                              )}
                                          </span>
                                          {active && (
                                              <UserRoundCheck
                                                  aria-hidden
                                                  className="size-5 shrink-0 text-link"
                                              />
                                          )}
                                      </button>
                                  </li>
                              );
                          })}
                </ul>
            )}

            {existing && period !== null && (
                <p className="rounded-control bg-surface-2 px-3.5 py-2.5 text-[14px] leading-5 text-text-muted">
                    Periode {shortPeriodLabel(period)} sudah didelegasikan ke{' '}
                    <b className="text-text">{existing.to.name}</b> — memilih
                    orang lain menggantikannya.
                </p>
            )}
        </div>
    );

    const action = (
        <Button
            onClick={() => void confirm()}
            disabled={confirmDisabled}
            size={mobile ? 'lg' : 'default'}
            className={cn(mobile && 'w-full')}
        >
            {processing && <Spinner />}
            Delegasikan pencatatan
        </Button>
    );

    if (mobile) {
        return (
            <BottomSheet
                open={open}
                onOpenChange={onOpenChange}
                title="Delegasikan briefing"
                description="Orang yang ditunjuk mencatat briefing hari ini menggantikan Anda."
                footer={action}
            >
                {body}
            </BottomSheet>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delegasikan briefing</DialogTitle>
                    <DialogDescription>
                        Orang yang ditunjuk mencatat briefing hari ini
                        menggantikan Anda.
                    </DialogDescription>
                </DialogHeader>
                {body}
                <DialogFooter>
                    <Button variant="quiet" onClick={() => onOpenChange(false)}>
                        Batal
                    </Button>
                    {action}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
