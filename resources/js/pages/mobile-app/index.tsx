import { Head, Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { StageSkeleton } from '@/features/mobile-app/phone-stage';
import {
    APP_SCREENS,
    OS_SCREENS,
    PRINCIPLES,
    SCREEN_STATES,
} from '@/features/mobile-app/screens';
import type { PhoneScreen } from '@/features/mobile-app/screens';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn, focusRing } from '@/lib/utils';

const STATE_TONE = {
    neutral: 'bg-surface-2 text-text-muted',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    info: 'bg-info-soft text-info',
} as const;

function ScreenCard({ screen, kind }: { screen: PhoneScreen; kind: string }) {
    return (
        <Link
            href={screen.href}
            prefetch
            className={cn(
                'group flex h-full flex-col gap-3 rounded-panel border border-border bg-surface p-5 shadow-card transition-colors duration-120 ease-brand hover:border-border-strong',
                focusRing,
            )}
        >
            <span className="flex items-start justify-between gap-3">
                <span
                    aria-hidden
                    className={cn(
                        'flex size-12 shrink-0 items-center justify-center rounded-[14px] text-on-brand',
                        screen.tile,
                    )}
                >
                    <screen.icon className="size-6" />
                </span>
                <Badge variant="label" tone={kind === 'os' ? 'info' : 'link'}>
                    {kind === 'os' ? 'Layar sistem' : 'Fitur aplikasi'}
                </Badge>
            </span>
            <span className="flex items-center gap-1 text-[19px] leading-6 font-bold text-text">
                {screen.title}
                <ChevronRight
                    aria-hidden
                    className="size-5 text-text-subtle transition-transform duration-120 ease-brand group-hover:translate-x-0.5"
                />
            </span>
            <span className="flex-1 text-[16px] leading-6 text-text-muted">
                {screen.description}
            </span>
            <span className="flex flex-wrap items-center gap-x-2 text-[14px] text-text-muted">
                <span className="font-mono font-semibold">{screen.href}</span>
                <span aria-hidden>·</span>
                <span>
                    {screen.sprint} · desain {screen.design}
                </span>
            </span>
        </Link>
    );
}

function Section({
    title,
    description,
    screens,
    kind,
}: {
    title: string;
    description: string;
    screens: PhoneScreen[];
    kind: 'os' | 'app';
}) {
    return (
        <section className="flex flex-col gap-4" aria-label={title}>
            <div className="flex flex-col gap-1">
                <h2 className="text-h3">{title}</h2>
                <p className="text-[16px] text-text-muted">{description}</p>
            </div>
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {screens.map((screen) => (
                    <li key={screen.href}>
                        <ScreenCard screen={screen} kind={kind} />
                    </li>
                ))}
            </ul>
        </section>
    );
}

/** /pratinjau/ponsel — every Fase 3 phone screen (F3-1, F3-2) + MFondasi rules. */
export default function MobileAppIndexPage() {
    const breakpoint = useBreakpoint();

    return (
        <>
            <Head title="Aplikasi ponsel" />
            {breakpoint === null ? (
                <StageSkeleton />
            ) : (
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-4">
                        <PrototypeBanner phase="Fase 3" />
                        {breakpoint !== 'mobile' && (
                            <header className="flex flex-col gap-2">
                                <p className="text-overline text-link">
                                    Fase 3 · F3-1 & F3-2
                                </p>
                                <h1 className="text-h1 tracking-[-0.02em]">
                                    Aplikasi ponsel
                                </h1>
                            </header>
                        )}
                        <p className="max-w-[760px] text-body-lg text-text-muted">
                            Prototipe web dari layar aplikasi React Native
                            (Expo). Alur dan data contoh di sini menjadi
                            spesifikasi aplikasi: masuk biometrik, check-in
                            wajah, deteksi perangkat curang, dan mode offline.
                        </p>
                    </div>

                    <Section
                        title="Layar sistem"
                        description="Meniru layar OS ponsel. Di desktop tampil di dalam bingkai ponsel, di ponsel memenuhi layar."
                        screens={OS_SCREENS}
                        kind="os"
                    />
                    <Section
                        title="Fitur aplikasi"
                        description="Layar biasa di dalam aplikasi, dengan versi desktop yang masuk akal."
                        screens={APP_SCREENS}
                        kind="app"
                    />

                    <div className="grid items-start gap-6 xl:grid-cols-2">
                        <Panel title="Fondasi ponsel">
                            <ol className="flex flex-col gap-4">
                                {PRINCIPLES.map((principle, index) => (
                                    <li
                                        key={principle.title}
                                        className="flex gap-3"
                                    >
                                        <span
                                            aria-hidden
                                            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-link-soft text-[15px] font-bold text-link"
                                        >
                                            {index + 1}
                                        </span>
                                        <span className="flex flex-col">
                                            <span className="text-[17px] font-bold">
                                                {principle.title}
                                            </span>
                                            <span className="text-[16px] leading-6 text-text-muted">
                                                {principle.body}
                                            </span>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </Panel>
                        <Panel title="Lima keadaan setiap layar">
                            <ul className="flex flex-col gap-3">
                                {SCREEN_STATES.map((item) => (
                                    <li
                                        key={item.title}
                                        className="flex items-start gap-3"
                                    >
                                        <span
                                            className={cn(
                                                'flex h-8 min-w-[88px] shrink-0 items-center justify-center rounded-full px-3 text-[14px] font-bold',
                                                STATE_TONE[item.tone],
                                            )}
                                        >
                                            {item.title}
                                        </span>
                                        <span className="pt-1 text-[16px] leading-6 text-text-muted">
                                            {item.body}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-4 text-[15px] text-text-muted">
                                Setiap pratinjau punya pilihan{' '}
                                <span className="font-semibold text-text">
                                    Keadaan
                                </span>{' '}
                                (atau{' '}
                                <span className="font-mono">
                                    ?keadaan=kosong
                                </span>{' '}
                                /{' '}
                                <span className="font-mono">
                                    ?keadaan=galat
                                </span>
                                ) untuk melihat versi kosong dan galat.
                            </p>
                        </Panel>
                    </div>
                </div>
            )}
        </>
    );
}

MobileAppIndexPage.layout = {
    breadcrumbs: [
        { title: 'Pratinjau', href: '/pratinjau' },
        { title: 'Aplikasi ponsel', href: '/pratinjau/ponsel' },
    ],
    title: 'Aplikasi ponsel',
    back: '/pratinjau',
};
