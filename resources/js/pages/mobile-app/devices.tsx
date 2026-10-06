import { Head } from '@inertiajs/react';
import { Panel } from '@/components/ui/panel';
import {
    DevicesDesktop,
    DevicesMobile,
} from '@/features/mobile-app/devices-view';
import {
    FlowSteps,
    MobileSimBar,
    OptionGroup,
    PREVIEW_STATE_OPTIONS,
    StageSkeleton,
} from '@/features/mobile-app/phone-stage';
import type { PreviewState } from '@/features/mobile-app/types';
import { useDevices } from '@/features/mobile-app/use-devices';
import { usePreviewState } from '@/features/mobile-app/use-preview-state';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';
import { useBreakpoint } from '@/hooks/use-breakpoint';

const FLOW = [
    'Setiap ponsel yang masuk tercatat sebagai perangkat (platform, versi, integritas)',
    'Perangkat dengan integritas gagal ditandai tidak tepercaya',
    'Cabut perangkat: sesi berakhir dan masuk biometrik mati',
    'Hapus data wajah = cabut persetujuan biometrik (UU PDP)',
];

function DevicesScreen({
    state,
    onStateChange,
}: {
    state: PreviewState;
    onStateChange: (next: PreviewState) => void;
}) {
    const breakpoint = useBreakpoint();
    const devices = useDevices(state);

    const controls = (
        <OptionGroup
            label="Keadaan"
            value={state}
            onChange={onStateChange}
            options={PREVIEW_STATE_OPTIONS.map((option) => ({
                ...option,
                label:
                    option.value === 'kosong'
                        ? 'Belum ada perangkat'
                        : option.value === 'galat'
                          ? 'Gagal memuat'
                          : option.label,
            }))}
        />
    );

    if (breakpoint === 'mobile') {
        return (
            <DevicesMobile
                state={devices}
                header={
                    <>
                        <MobileSimBar controls={controls} flow={FLOW} />
                        <p className="text-[17px] leading-[26px] text-text-muted">
                            Ponsel yang bisa masuk ke akun Anda, dan data wajah
                            untuk check-in.
                        </p>
                    </>
                }
            />
        );
    }

    return (
        <DevicesDesktop
            state={devices}
            header={
                <>
                    <PrototypeBanner phase="Fase 3" />
                    <header className="flex flex-col gap-2">
                        <p className="text-overline text-link">
                            Pengaturan · F3-1 & F3-2
                        </p>
                        <h1 className="text-h1 tracking-[-0.02em]">
                            Perangkat saya
                        </h1>
                        <p className="max-w-[720px] text-body-lg text-text-muted">
                            Ponsel yang bisa masuk ke akun Anda, hasil
                            pemeriksaan integritasnya, dan data wajah untuk
                            check-in. Mencabut perangkat langsung mengakhiri
                            sesinya.
                        </p>
                    </header>
                </>
            }
            aside={
                <>
                    <Panel title="Simulasi">{controls}</Panel>
                    <Panel title="Alur">
                        <FlowSteps steps={FLOW} />
                    </Panel>
                    <Panel title="Catatan untuk aplikasi Expo">
                        <ul className="flex list-disc flex-col gap-2 pl-5 text-[16px] leading-6 text-text-muted marker:text-text-subtle">
                            <li>
                                Baris devices dibuat saat login pertama di
                                aplikasi; device_id_hash dan push_token tidak
                                pernah dikirim ke halaman ini.
                            </li>
                            <li>
                                Mencabut perangkat mencabut token Sanctum dan
                                push token-nya.
                            </li>
                            <li>
                                Menghapus data wajah menghapus face_templates
                                dan mengisi attendance_consents.revoked_at (tipe
                                face), lalu dicatat di audit log.
                            </li>
                        </ul>
                    </Panel>
                </>
            }
        />
    );
}

/** /pengaturan/perangkat — trusted devices & face data (F3-1, F3-2). */
export default function MobileAppDevicesPage() {
    const breakpoint = useBreakpoint();
    const [state, setState] = usePreviewState();

    return (
        <>
            <Head title="Perangkat saya" />
            {breakpoint === null ? (
                <StageSkeleton />
            ) : (
                <DevicesScreen
                    key={state}
                    state={state}
                    onStateChange={setState}
                />
            )}
        </>
    );
}

MobileAppDevicesPage.layout = {
    breadcrumbs: [
        { title: 'Pengaturan', href: '/settings/profile' },
        { title: 'Perangkat saya', href: '/pengaturan/perangkat' },
    ],
    title: 'Perangkat saya',
    back: '/menu',
};
