import { Head, Link } from '@inertiajs/react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { GUIDE_URL, moduleStatusBadge } from '@/features/prototype/guide';
import type { PrototypeModule } from '@/features/prototype/modules';
import { PROTOTYPE_MODULES } from '@/features/prototype/modules';
import { cn, focusRing } from '@/lib/utils';

function ModuleCard({ module }: { module: PrototypeModule }) {
    const Icon = module.icon;
    const status = moduleStatusBadge(module.key);

    return (
        <article className="flex min-w-0 flex-col gap-4 rounded-panel border border-border bg-surface p-5 shadow-card md:p-6">
            <div className="flex items-start gap-3.5">
                <span
                    aria-hidden
                    className={cn(
                        'flex size-12 shrink-0 items-center justify-center rounded-lg text-on-brand',
                        module.gradient,
                    )}
                >
                    <Icon className="size-6" strokeWidth={1.9} />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-title font-bold">{module.title}</h3>
                        <Badge variant="status" tone="neutral">
                            {module.sprint}
                        </Badge>
                        {status && (
                            <Badge variant="status" tone={status.tone} dot>
                                {status.label}
                            </Badge>
                        )}
                    </div>
                    <p className="text-[15px] leading-[22px] text-text-muted">
                        {module.description}
                    </p>
                </div>
            </div>
            <ul className="flex flex-col divide-y divide-divider overflow-hidden rounded-lg border border-border">
                {module.screens.map((screen) => (
                    <li key={screen.href}>
                        <Link
                            href={screen.href}
                            prefetch
                            className={cn(
                                'flex min-h-12 items-center justify-between gap-3 px-4 text-[16px] font-semibold transition-colors duration-120 ease-brand hover:bg-surface-2/60',
                                focusRing,
                                'focus-visible:ring-inset',
                            )}
                        >
                            <span className="truncate">{screen.label}</span>
                            <ChevronRight
                                aria-hidden
                                className="size-[18px] shrink-0 text-text-subtle"
                                strokeWidth={2.4}
                            />
                        </Link>
                    </li>
                ))}
            </ul>
        </article>
    );
}

/** Entry to /pratinjau/panduan: what exists, what does not, how to use it. */
function GuideCard() {
    return (
        <Link
            href={GUIDE_URL}
            prefetch
            className={cn(
                'flex min-w-0 items-center gap-4 rounded-panel border border-border bg-surface p-5 shadow-card transition-colors duration-120 ease-brand hover:border-border-strong md:p-6',
                focusRing,
            )}
        >
            <span
                aria-hidden
                className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-grad-soft text-link"
            >
                <BookOpen className="size-6" strokeWidth={1.9} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-title font-bold">Panduan pratinjau</span>
                <span className="text-[15px] leading-[22px] text-text-muted">
                    Fitur yang sudah ada dan yang belum, cara memakai tiap
                    layar, status modul (akan dibangun atau ditahan), dan apa
                    yang dibutuhkan agar menjadi nyata.
                </span>
            </span>
            <ChevronRight
                aria-hidden
                className="size-5 shrink-0 text-text-subtle"
                strokeWidth={2.4}
            />
        </Link>
    );
}

/** /pratinjau — index of every Fase 2 & 3 front-end preview. */
export default function PrototypeHub() {
    const phases = ['Fase 2', 'Fase 3'] as const;

    return (
        <>
            <Head title="Pratinjau Fase 2 & 3" />
            <div className="flex flex-col gap-8">
                <header className="flex flex-col gap-3">
                    <p className="text-overline text-text-muted">Pratinjau</p>
                    <h1 className="text-display">Fitur berikutnya</h1>
                    <p className="max-w-2xl text-body-lg text-text-muted">
                        Alur layar Fase 2 dan Fase 3 untuk ditinjau sebelum
                        backend dibangun. Semua data di sini adalah contoh.
                    </p>
                </header>
                <GuideCard />
                {phases.map((phase) => (
                    <section
                        key={phase}
                        aria-labelledby={`hub-${phase}`}
                        className="flex flex-col gap-4"
                    >
                        <h2 id={`hub-${phase}`} className="text-h3">
                            {phase === 'Fase 2'
                                ? 'Fase 2 · Kolaborasi realtime'
                                : 'Fase 3 · Ponsel & perangkat'}
                        </h2>
                        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                            {PROTOTYPE_MODULES.filter(
                                (module) => module.phase === phase,
                            ).map((module) => (
                                <ModuleCard key={module.key} module={module} />
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </>
    );
}

PrototypeHub.layout = {
    breadcrumbs: [{ title: 'Pratinjau', href: '/pratinjau' }],
    title: 'Pratinjau',
};
