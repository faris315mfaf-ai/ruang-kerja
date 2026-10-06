import { Link } from '@inertiajs/react';
import { Check, SlidersHorizontal, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import { appBarIconButton } from '@/components/mobile/app-bar';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { AppShellSkeleton } from '@/components/shell/app-shell-skeleton';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import AppLayout from '@/layouts/app-layout';
import { cn, focusRing } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';
import { PhoneFrame } from './phone-frame';
import type { PreviewState } from './types';

// --- Layout for OS-level screens -------------------------------------------------

type OsLayoutMeta = {
    title: string;
    breadcrumbs: BreadcrumbItem[];
    back: string;
};

function PhoneOsShell({
    meta,
    children,
}: {
    meta: OsLayoutMeta;
    children: ReactNode;
}) {
    const breakpoint = useBreakpoint();

    if (breakpoint === null) {
        return <AppShellSkeleton />;
    }

    // Phones show the simulated OS screen edge to edge, without app chrome.
    if (breakpoint === 'mobile') {
        return <>{children}</>;
    }

    return (
        <AppLayout
            breadcrumbs={meta.breadcrumbs}
            title={meta.title}
            back={meta.back}
        >
            {children}
        </AppLayout>
    );
}

/**
 * `Page.layout` for screens that imitate the phone OS (lock screen, widget,
 * biometric login): the normal app shell on desktop/tablet, nothing on
 * phones so the screen can be full-bleed.
 */
export function phoneOsLayout(meta: OsLayoutMeta) {
    return (page: ReactNode) => <PhoneOsShell meta={meta}>{page}</PhoneOsShell>;
}

// --- Simulation controls ---------------------------------------------------------

export type Option<T extends string> = { value: T; label: string };

/** Wrapping single-choice chips (44px) for simulation switches. */
export function OptionGroup<T extends string>({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: T;
    onChange: (value: T) => void;
    options: Option<T>[];
}) {
    const id = useId();

    return (
        <div className="flex flex-col gap-2">
            <span id={id} className="text-[15px] font-semibold text-text-muted">
                {label}
            </span>
            <div
                role="radiogroup"
                aria-labelledby={id}
                className="flex flex-wrap gap-2"
            >
                {options.map((option) => {
                    const active = option.value === value;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => onChange(option.value)}
                            className={cn(
                                'flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[15px] font-bold transition-colors duration-120 ease-brand',
                                focusRing,
                                active
                                    ? 'bg-primary bg-grad-aksi text-on-brand'
                                    : 'border border-border-strong bg-surface text-text hover:bg-surface-2',
                            )}
                        >
                            {active && (
                                <Check
                                    aria-hidden
                                    className="size-4"
                                    strokeWidth={3}
                                />
                            )}
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export const PREVIEW_STATE_OPTIONS: Option<PreviewState>[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'kosong', label: 'Kosong' },
    { value: 'galat', label: 'Galat' },
];

/** Numbered flow of a screen; `active` highlights where the simulation is. */
export function FlowSteps({
    steps,
    active,
}: {
    steps: string[];
    active?: number;
}) {
    return (
        <ol className="flex flex-col gap-3">
            {steps.map((step, index) => {
                const done = active !== undefined && index < active;
                const current = index === active;

                return (
                    <li
                        key={step}
                        aria-current={current ? 'step' : undefined}
                        className="flex items-start gap-3"
                    >
                        <span
                            aria-hidden
                            className={cn(
                                'flex size-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold tnum',
                                current
                                    ? 'bg-primary bg-grad-aksi text-on-brand'
                                    : done
                                      ? 'bg-success-soft text-success'
                                      : 'bg-surface-2 text-text-muted',
                            )}
                        >
                            {done ? (
                                <Check className="size-4" strokeWidth={3} />
                            ) : (
                                index + 1
                            )}
                        </span>
                        <span
                            className={cn(
                                'pt-0.5 text-[16px] leading-6',
                                current
                                    ? 'font-bold text-text'
                                    : 'text-text-muted',
                            )}
                        >
                            {step}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

// --- Desktop / tablet stage ------------------------------------------------------

type StageProps = {
    overline: string;
    title: string;
    lead: ReactNode;
    /** Simulation switches (state, scenario). */
    controls?: ReactNode;
    flow: string[];
    activeStep?: number;
    /** "Catatan aplikasi Expo": what the native build must do. */
    notes?: string[];
    /** Optional notice above the explanation (e.g. "Tersedia di aplikasi ponsel"). */
    notice?: ReactNode;
    frameLabel: string;
    screen: ReactNode;
};

/**
 * Desktop/tablet preview of a phone screen: explanation + simulation
 * controls on the left, the screen in a 390×844 phone frame on the right
 * (stacked on tablet).
 */
export function PhoneStage({
    overline,
    title,
    lead,
    controls,
    flow,
    activeStep,
    notes,
    notice,
    frameLabel,
    screen,
}: StageProps) {
    return (
        <div className="flex flex-col gap-6">
            <PrototypeBanner phase="Fase 3" />
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_410px] lg:gap-x-10">
                <header className="flex flex-col gap-2 lg:col-start-1">
                    <p className="text-overline text-link">{overline}</p>
                    <h1 className="text-h1 tracking-[-0.02em]">{title}</h1>
                    <div className="max-w-[640px] text-body-lg text-text-muted">
                        {lead}
                    </div>
                </header>
                {notice && <div className="lg:col-start-1">{notice}</div>}
                {controls && (
                    <Panel title="Simulasi" className="lg:col-start-1">
                        <div className="flex flex-col gap-5">{controls}</div>
                    </Panel>
                )}
                <div className="flex justify-center lg:sticky lg:top-[calc(var(--menu-bar-height,64px)+24px)] lg:col-start-2 lg:row-span-6 lg:row-start-1">
                    <PhoneFrame label={frameLabel}>{screen}</PhoneFrame>
                </div>
                <Panel title="Alur" className="lg:col-start-1">
                    <FlowSteps steps={flow} active={activeStep} />
                </Panel>
                {notes && notes.length > 0 && (
                    <Panel
                        title="Catatan untuk aplikasi Expo"
                        className="lg:col-start-1"
                    >
                        <ul className="flex list-disc flex-col gap-2 pl-5 text-[16px] leading-6 text-text-muted marker:text-text-subtle">
                            {notes.map((note) => (
                                <li key={note}>{note}</li>
                            ))}
                        </ul>
                    </Panel>
                )}
            </div>
        </div>
    );
}

// --- Phone: full-bleed OS screen -------------------------------------------------

/**
 * Phone version of an OS-level preview: a slim glass strip (close, title,
 * simulation sheet, prototype banner) above the full-screen simulation.
 */
export function MobileSimChrome({
    title,
    back,
    controls,
    flow,
    activeStep,
    children,
}: {
    title: string;
    back: string;
    controls?: ReactNode;
    flow: string[];
    activeStep?: number;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className="flex h-svh flex-col bg-preview-dark">
            <div className="glass z-40 flex shrink-0 flex-col gap-2 border-x-0 border-t-0 px-4 pt-[calc(env(safe-area-inset-top)+8px)] pb-2.5 text-text">
                <div className="flex items-center gap-3">
                    <Link
                        href={back}
                        aria-label="Tutup pratinjau"
                        className={cn(appBarIconButton, 'size-11')}
                    >
                        <X
                            className="size-[22px]"
                            strokeWidth={2.2}
                            aria-hidden
                        />
                    </Link>
                    <p className="min-w-0 flex-1 truncate text-[17px] font-bold">
                        {title}
                    </p>
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        aria-label="Simulasi & alur"
                        className={cn(appBarIconButton, 'size-11')}
                    >
                        <SlidersHorizontal
                            className="size-[20px]"
                            strokeWidth={2.2}
                            aria-hidden
                        />
                    </button>
                </div>
                <PrototypeBanner
                    phase="Fase 3"
                    className="rounded-[14px] px-2.5 py-1 text-[13px] leading-[18px]"
                />
            </div>
            <div className="relative min-h-0 flex-1">{children}</div>
            <BottomSheet
                open={open}
                onOpenChange={setOpen}
                title="Simulasi & alur"
                description="Ubah skenario lalu tutup lembar ini untuk mencobanya."
            >
                <div className="flex flex-col gap-6 pb-2">
                    {controls}
                    <div className="flex flex-col gap-3">
                        <p className="text-overline text-text-muted">Alur</p>
                        <FlowSteps steps={flow} active={activeStep} />
                    </div>
                </div>
            </BottomSheet>
        </div>
    );
}

/** Skeleton while the breakpoint is unknown (SSR / hydration). */
export function StageSkeleton() {
    return (
        <div className="flex flex-col gap-4" aria-busy>
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-[420px] w-full" />
        </div>
    );
}

// --- Phone: app screens inside the normal shell -----------------------------------

/**
 * Phone version of an app-feature preview (face check-in, integrity…): the
 * prototype banner with a "Simulasi" button that opens the same switches as
 * the desktop stage in a bottom sheet.
 */
export function MobileSimBar({
    controls,
    flow,
    activeStep,
}: {
    controls?: ReactNode;
    flow: string[];
    activeStep?: number;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className="flex items-start justify-between gap-3">
            <PrototypeBanner
                phase="Fase 3"
                className="rounded-[14px] px-2.5 py-1 text-[13px] leading-[18px]"
            />
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Simulasi & alur"
                className={cn(appBarIconButton, 'size-11')}
            >
                <SlidersHorizontal
                    className="size-[20px]"
                    strokeWidth={2.2}
                    aria-hidden
                />
            </button>
            <BottomSheet
                open={open}
                onOpenChange={setOpen}
                title="Simulasi & alur"
                description="Ubah skenario lalu tutup lembar ini untuk mencobanya."
            >
                <div className="flex flex-col gap-6 pb-2">
                    {controls}
                    <div className="flex flex-col gap-3">
                        <p className="text-overline text-text-muted">Alur</p>
                        <FlowSteps steps={flow} active={activeStep} />
                    </div>
                </div>
            </BottomSheet>
        </div>
    );
}
