import { Head } from '@inertiajs/react';
import { Hand, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Fab } from '@/components/mobile/fab';
import { Panel } from '@/components/ui/panel';
import { QUICK_CREATED } from '@/features/mobile-app/fixtures';
import {
    FlowSteps,
    MobileSimBar,
    OptionGroup,
    PREVIEW_STATE_OPTIONS,
    StageSkeleton,
} from '@/features/mobile-app/phone-stage';
import {
    QUICK_ACTIONS,
    QUICK_FLOW,
    QuickAddPanel,
} from '@/features/mobile-app/quick-add-panel';
import type {
    PreviewState,
    QuickActionKey,
    QuickCreated,
} from '@/features/mobile-app/types';
import { usePreviewState } from '@/features/mobile-app/use-preview-state';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

const LONG_PRESS_MS = 500;

function CreatedList({ items }: { items: QuickCreated[] }) {
    if (items.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={Sparkles}
                title="Belum ada yang dibuat"
                description="Tugas, catatan, dan pengajuan dari aksi cepat muncul di sini."
            />
        );
    }

    return (
        <ul className="flex flex-col divide-y divide-divider">
            {items.map((item) => {
                const action = QUICK_ACTIONS.find((a) => a.key === item.kind);
                const Icon = action?.icon ?? Sparkles;

                return (
                    <li
                        key={item.id}
                        className="flex min-h-[64px] items-center gap-3 py-2"
                    >
                        <span
                            aria-hidden
                            className={cn(
                                'flex size-10 shrink-0 items-center justify-center rounded-[12px] text-on-brand',
                                action?.tile ?? 'bg-grad-aksi',
                            )}
                        >
                            <Icon className="size-5" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-[16px] font-bold">
                                {item.title}
                            </span>
                            <span className="truncate text-[14px] text-text-muted">
                                {item.meta}
                            </span>
                        </span>
                        <span className="shrink-0 text-[13px] text-text-muted">
                            {formatRelative(
                                item.created_at,
                                '2026-10-05T00:55:00Z',
                            )}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

function QuickAddScreen({
    state,
    onStateChange,
}: {
    state: PreviewState;
    onStateChange: (next: PreviewState) => void;
}) {
    const breakpoint = useBreakpoint();
    const [items, setItems] = useState<QuickCreated[]>(
        state === 'kosong' ? [] : QUICK_CREATED,
    );
    const [open, setOpen] = useState(false);
    const [initial, setInitial] = useState<QuickActionKey | null>(null);
    const [step, setStep] = useState(0);
    const press = useRef<number | null>(null);
    const longPressed = useRef(false);

    const onCreated = (item: QuickCreated) => {
        setItems((current) => [item, ...current]);
        setStep(3);
        setOpen(false);
    };

    const controls = (
        <OptionGroup
            label="Keadaan"
            value={state}
            onChange={onStateChange}
            options={PREVIEW_STATE_OPTIONS.map((option) => ({
                ...option,
                label:
                    option.value === 'kosong'
                        ? 'Belum ada item'
                        : option.value === 'galat'
                          ? 'Gagal menyimpan'
                          : option.label,
            }))}
        />
    );

    const tips = (
        <ul className="flex flex-col gap-3 text-[16px] leading-6 text-text-muted">
            <li className="flex gap-3">
                <Hand
                    aria-hidden
                    className="mt-0.5 size-5 shrink-0 text-link"
                />
                Tekan lama tombol + untuk langsung membuat tugas baru.
            </li>
            <li className="flex gap-3">
                <Hand
                    aria-hidden
                    className="mt-0.5 size-5 shrink-0 text-link"
                />
                Sapu lembar ke bawah untuk menutup tanpa menyimpan.
            </li>
        </ul>
    );

    if (breakpoint === 'mobile') {
        const startPress = () => {
            longPressed.current = false;
            press.current = window.setTimeout(() => {
                longPressed.current = true;
                setInitial('task');
                setStep(4);
                setOpen(true);
            }, LONG_PRESS_MS);
        };
        const cancelPress = () => {
            if (press.current) {
                window.clearTimeout(press.current);
            }
        };

        return (
            <div className="flex flex-col gap-4 pb-24">
                <MobileSimBar
                    controls={controls}
                    flow={QUICK_FLOW}
                    activeStep={step}
                />
                <p className="text-[17px] leading-[26px] text-text-muted">
                    Satu tombol + di pojok kanan bawah membuka lembar aksi
                    cepat, bukan menu bertingkat.
                </p>
                <section className="rounded-[22px] border border-border bg-surface px-4 pt-3.5 pb-2 shadow-card">
                    <h2 className="pb-1 text-[18px] font-extrabold">
                        Baru dibuat
                    </h2>
                    <CreatedList items={items} />
                </section>
                <section className="rounded-[22px] border border-border bg-surface p-4 shadow-card">
                    <h2 className="pb-2 text-[18px] font-extrabold">Gestur</h2>
                    {tips}
                </section>
                <Fab
                    label="Buat cepat"
                    onClick={() => {
                        if (longPressed.current) {
                            return;
                        }

                        setInitial(null);
                        setStep(1);
                        setOpen(true);
                    }}
                    onPointerDown={startPress}
                    onPointerUp={cancelPress}
                    onPointerLeave={cancelPress}
                    onContextMenu={(event) => event.preventDefault()}
                />
                <BottomSheet
                    open={open}
                    onOpenChange={setOpen}
                    title="Buat cepat"
                    description="Sapu ke bawah untuk menutup"
                >
                    <QuickAddPanel
                        key={`${open}-${initial}`}
                        state={state}
                        initial={initial}
                        onCreated={onCreated}
                    />
                </BottomSheet>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <PrototypeBanner phase="Fase 3" />
            <header className="flex flex-col gap-2">
                <p className="text-overline text-link">
                    Aplikasi ponsel · F3-1
                </p>
                <h1 className="text-h1 tracking-[-0.02em]">Aksi cepat</h1>
                <p className="max-w-[720px] text-body-lg text-text-muted">
                    Di ponsel, tombol + membuka lembar bawah berisi aksi yang
                    paling sering dipakai. Di desktop, panel yang sama tampil di
                    samping.
                </p>
            </header>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
                <div className="flex min-w-0 flex-col gap-5">
                    <Panel title="Baru dibuat">
                        <CreatedList items={items} />
                    </Panel>
                    <Panel title="Simulasi">{controls}</Panel>
                    <Panel title="Alur">
                        <FlowSteps steps={QUICK_FLOW} active={step} />
                    </Panel>
                    <Panel title="Gestur di ponsel">{tips}</Panel>
                </div>
                <Panel
                    title="Buat cepat"
                    className="lg:sticky lg:top-[calc(var(--menu-bar-height,64px)+24px)]"
                >
                    <QuickAddPanel state={state} onCreated={onCreated} />
                </Panel>
            </div>
        </div>
    );
}

/** /pratinjau/ponsel/aksi-cepat — MQuickAdd: + button & quick actions sheet. */
export default function MobileAppQuickAddPage() {
    const breakpoint = useBreakpoint();
    const [state, setState] = usePreviewState();

    return (
        <>
            <Head title="Aksi cepat" />
            {breakpoint === null ? (
                <StageSkeleton />
            ) : (
                <QuickAddScreen
                    key={state}
                    state={state}
                    onStateChange={setState}
                />
            )}
        </>
    );
}

MobileAppQuickAddPage.layout = {
    breadcrumbs: [
        { title: 'Aplikasi ponsel', href: '/pratinjau/ponsel' },
        { title: 'Aksi cepat', href: '/pratinjau/ponsel/aksi-cepat' },
    ],
    title: 'Aksi cepat',
    back: '/pratinjau/ponsel',
};
