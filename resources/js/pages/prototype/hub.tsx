import { Head, Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PrototypeModule } from '@/features/prototype/modules';
import { PROTOTYPE_MODULES } from '@/features/prototype/modules';
import { cn, focusRing } from '@/lib/utils';

function ModuleCard({ module }: { module: PrototypeModule }) {
    const Icon = module.icon;

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
