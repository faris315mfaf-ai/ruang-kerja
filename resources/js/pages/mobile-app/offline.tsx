import { Head } from '@inertiajs/react';
import { Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import {
    OFFLINE_FLOW,
    OfflineCapabilities,
    QueueList,
    SyncBanner,
} from '@/features/mobile-app/offline-queue';
import {
    FlowSteps,
    MobileSimBar,
    OptionGroup,
    PREVIEW_STATE_OPTIONS,
    StageSkeleton,
} from '@/features/mobile-app/phone-stage';
import type { PreviewState } from '@/features/mobile-app/types';
import { usePreviewState } from '@/features/mobile-app/use-preview-state';
import { useSyncQueue } from '@/features/mobile-app/use-sync-queue';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';
import { useBreakpoint } from '@/hooks/use-breakpoint';

function OfflineScreen({
    state,
    onStateChange,
}: {
    state: PreviewState;
    onStateChange: (next: PreviewState) => void;
}) {
    const breakpoint = useBreakpoint();
    const queue = useSyncQueue(state);
    const { network, summary } = queue;

    const step =
        network === 'offline'
            ? summary.waiting > 0
                ? 1
                : 0
            : summary.pending + summary.syncing > 0
              ? 2
              : summary.failed > 0
                ? 3
                : 4;

    const primary =
        network === 'offline' ? (
            <Button size="lg" className="w-full" onClick={queue.goOnline}>
                <Wifi aria-hidden />
                Coba kirim sekarang
            </Button>
        ) : summary.pending + summary.syncing > 0 ? (
            <Button size="lg" className="w-full" disabled>
                Mengirim… {summary.sent} dari {summary.total}
            </Button>
        ) : summary.failed > 0 ? (
            <Button size="lg" className="w-full" onClick={() => queue.retry()}>
                Coba lagi semua
            </Button>
        ) : (
            <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={queue.goOffline}
            >
                <WifiOff aria-hidden />
                Simulasi putus sinyal
            </Button>
        );

    const controls = (
        <>
            <OptionGroup
                label="Jaringan"
                value={network}
                onChange={(next) =>
                    next === 'online' ? queue.goOnline() : queue.goOffline()
                }
                options={[
                    { value: 'offline', label: 'Tanpa sinyal' },
                    { value: 'online', label: 'Terhubung' },
                ]}
            />
            <OptionGroup
                label="Keadaan awal"
                value={state}
                onChange={onStateChange}
                options={PREVIEW_STATE_OPTIONS.map((option) => ({
                    ...option,
                    label:
                        option.value === 'kosong'
                            ? 'Antrean kosong'
                            : option.value === 'galat'
                              ? 'Ada yang gagal'
                              : option.label,
                }))}
            />
        </>
    );

    const context = (
        <div className="flex flex-col">
            <p className="text-overline text-warning">
                Operasional · kunjungan lapangan
            </p>
            <p className="text-[24px] leading-8 font-extrabold md:text-h2">
                Gudang Cikarang
            </p>
            <p className="text-[15px] text-text-muted">
                Ruang server basement · sinyal sering hilang
            </p>
        </div>
    );

    if (breakpoint === 'mobile') {
        return (
            <div className="flex flex-col gap-4 pb-28">
                <MobileSimBar
                    controls={controls}
                    flow={OFFLINE_FLOW}
                    activeStep={step}
                />
                <SyncBanner
                    banner={queue.banner}
                    className="sticky top-[calc(env(safe-area-inset-top)+var(--app-bar-height)+8px)] z-20 shadow-card"
                />
                {context}
                <QueueList
                    items={queue.items}
                    summary={summary}
                    onRetry={queue.retry}
                />
                <OfflineCapabilities />
                <div className="glass fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))] z-30 border-x-0 border-b-0 px-4 py-3">
                    {primary}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <PrototypeBanner phase="Fase 3" />
            <header className="flex flex-col gap-2">
                <p className="text-overline text-link">
                    Aplikasi ponsel · F3-2
                </p>
                <h1 className="text-h1 tracking-[-0.02em]">
                    Offline & antrean sinkron
                </h1>
                <p className="max-w-[720px] text-body-lg text-text-muted">
                    Di lapangan sinyal sering hilang. Aksi tetap bisa dilakukan,
                    disimpan di perangkat, lalu dikirim otomatis saat sinyal
                    kembali.
                </p>
            </header>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
                <div className="flex min-w-0 flex-col gap-5">
                    <SyncBanner banner={queue.banner} />
                    {context}
                    <QueueList
                        items={queue.items}
                        summary={summary}
                        onRetry={queue.retry}
                    />
                    <div className="max-w-sm">{primary}</div>
                </div>
                <div className="flex min-w-0 flex-col gap-5">
                    <Panel title="Simulasi">
                        <div className="flex flex-col gap-5">{controls}</div>
                    </Panel>
                    <OfflineCapabilities />
                    <Panel title="Alur">
                        <FlowSteps steps={OFFLINE_FLOW} active={step} />
                    </Panel>
                    <Panel title="Catatan untuk aplikasi Expo">
                        <ul className="flex list-disc flex-col gap-2 pl-5 text-[16px] leading-6 text-text-muted marker:text-text-subtle">
                            <li>
                                Antrean di SQLite terenkripsi (expo-sqlite +
                                kunci di SecureStore), dibuang setelah 72 jam
                                dengan pemberitahuan.
                            </li>
                            <li>
                                Setiap aksi membawa client_id (ULID) agar
                                kiriman ulang idempoten; check-in membawa
                                client_time untuk deteksi selisih jam.
                            </li>
                            <li>
                                Konflik (tugas sudah diubah orang lain)
                                ditampilkan sebagai Gagal dengan pilihan kirim
                                ulang, bukan ditimpa diam-diam.
                            </li>
                            <li>
                                Web/PWA tidak menyimpan antrean: data selalu
                                dari jaringan (docs/PLATFORM.md §5).
                            </li>
                        </ul>
                    </Panel>
                </div>
            </div>
        </div>
    );
}

/** /pratinjau/ponsel/offline — MOffline: offline mode & sync queue (F3-2). */
export default function MobileAppOfflinePage() {
    const breakpoint = useBreakpoint();
    const [state, setState] = usePreviewState();

    return (
        <>
            <Head title="Offline & antrean sinkron" />
            {breakpoint === null ? (
                <StageSkeleton />
            ) : (
                <OfflineScreen
                    key={state}
                    state={state}
                    onStateChange={setState}
                />
            )}
        </>
    );
}

MobileAppOfflinePage.layout = {
    breadcrumbs: [
        { title: 'Aplikasi ponsel', href: '/pratinjau/ponsel' },
        { title: 'Offline', href: '/pratinjau/ponsel/offline' },
    ],
    title: 'Offline & antrean',
    back: '/pratinjau/ponsel',
};
