import { Head } from '@inertiajs/react';
import { useState } from 'react';
import {
    MobileSimChrome,
    OptionGroup,
    PREVIEW_STATE_OPTIONS,
    PhoneStage,
    StageSkeleton,
    phoneOsLayout,
} from '@/features/mobile-app/phone-stage';
import {
    usePreviewState,
    useScenario,
} from '@/features/mobile-app/use-preview-state';
import { WIDGET_FLOW, WidgetScreen } from '@/features/mobile-app/widget-screen';
import type { WidgetSize } from '@/features/mobile-app/widget-screen';
import { useBreakpoint } from '@/hooks/use-breakpoint';

const SIZES = ['kecil', 'sedang'] as const;

/** /pratinjau/ponsel/widget — MWidget: home screen widgets (F3-1). */
export default function MobileAppWidgetPage() {
    const breakpoint = useBreakpoint();
    const [state, setState] = usePreviewState();
    const [size, setSize] = useScenario<WidgetSize>(SIZES, 'kecil');
    const [step, setStep] = useState(0);

    const controls = (
        <>
            <OptionGroup
                label="Ukuran widget"
                value={size}
                onChange={(next) => {
                    setSize(next);
                    setStep(next === 'kecil' ? 0 : 1);
                }}
                options={[
                    { value: 'kecil', label: 'Kecil (2×2)' },
                    { value: 'sedang', label: 'Sedang (4×2)' },
                ]}
            />
            <OptionGroup
                label="Keadaan"
                value={state}
                onChange={setState}
                options={PREVIEW_STATE_OPTIONS.map((option) => ({
                    ...option,
                    label:
                        option.value === 'kosong'
                            ? 'Hari libur'
                            : option.value === 'galat'
                              ? 'Gagal diperbarui'
                              : option.label,
                }))}
            />
        </>
    );

    const screen = (
        <WidgetScreen
            key={`${state}-${size}`}
            state={state}
            size={size}
            onStepChange={setStep}
        />
    );

    return (
        <>
            <Head title="Widget layar utama" />
            {breakpoint === null ? (
                <StageSkeleton />
            ) : breakpoint === 'mobile' ? (
                <MobileSimChrome
                    title="Widget layar utama"
                    back="/pratinjau/ponsel"
                    controls={controls}
                    flow={WIDGET_FLOW}
                    activeStep={step}
                >
                    {screen}
                </MobileSimChrome>
            ) : (
                <PhoneStage
                    overline="Aplikasi ponsel · F3-1"
                    title="Widget layar utama"
                    lead="Status absensi dan tugas hari ini langsung di layar utama. Check-in dari widget cukup dengan konfirmasi Face ID."
                    controls={controls}
                    flow={WIDGET_FLOW}
                    activeStep={step}
                    notes={[
                        'iOS: WidgetKit + App Intents (expo-apple-targets); Android: Glance AppWidget. Keduanya membaca snapshot JSON yang ditulis aplikasi ke App Group / SharedPreferences.',
                        'Check-in dari widget memanggil endpoint check-in yang sama (method gps_selfie diganti face bila template wajah ada); tanpa wajah, widget membuka layar Absensi.',
                        'Snapshot diperbarui setelah setiap aksi dan lewat background fetch tiap 15 menit; widget menampilkan "terakhir diperbarui" bila gagal.',
                        'Widget tidak menampilkan nama orang lain atau isi tugas sensitif saat perangkat terkunci.',
                    ]}
                    frameLabel="Pratinjau widget layar utama"
                    screen={screen}
                />
            )}
        </>
    );
}

MobileAppWidgetPage.layout = phoneOsLayout({
    title: 'Widget layar utama',
    breadcrumbs: [
        { title: 'Aplikasi ponsel', href: '/pratinjau/ponsel' },
        { title: 'Widget', href: '/pratinjau/ponsel/widget' },
    ],
    back: '/pratinjau/ponsel',
});
