import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { LOCK_FLOW, LockScreen } from '@/features/mobile-app/lock-screen';
import {
    MobileSimChrome,
    OptionGroup,
    PREVIEW_STATE_OPTIONS,
    PhoneStage,
    StageSkeleton,
    phoneOsLayout,
} from '@/features/mobile-app/phone-stage';
import { usePreviewState } from '@/features/mobile-app/use-preview-state';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/** /pratinjau/ponsel/kunci — MLockScreen: actionable notifications (F3-1). */
export default function MobileAppLockScreenPage() {
    const breakpoint = useBreakpoint();
    const [state, setState] = usePreviewState();
    const [step, setStep] = useState(0);

    const controls = (
        <OptionGroup
            label="Keadaan"
            value={state}
            onChange={(next) => {
                setState(next);
                setStep(0);
            }}
            options={PREVIEW_STATE_OPTIONS.map((option) => ({
                ...option,
                label:
                    option.value === 'galat'
                        ? 'Persetujuan gagal terkirim'
                        : option.label,
            }))}
        />
    );

    const screen = (
        <LockScreen key={state} state={state} onStepChange={setStep} />
    );

    return (
        <>
            <Head title="Layar kunci" />
            {breakpoint === null ? (
                <StageSkeleton />
            ) : breakpoint === 'mobile' ? (
                <MobileSimChrome
                    title="Layar kunci"
                    back="/pratinjau/ponsel"
                    controls={controls}
                    flow={LOCK_FLOW}
                    activeStep={step}
                >
                    {screen}
                </MobileSimChrome>
            ) : (
                <PhoneStage
                    overline="Aplikasi ponsel · F3-1"
                    title="Layar kunci"
                    lead="Notifikasi yang menunggu Anda bisa langsung ditindaklanjuti tanpa membuka aplikasi: setujui cuti dengan konfirmasi Face ID atau langsung check-in."
                    controls={controls}
                    flow={LOCK_FLOW}
                    activeStep={step}
                    notes={[
                        'expo-notifications dengan kategori aksi: "Setujui" butuh autentikasi (iOS authenticationRequired / Android setAuthenticationRequired).',
                        'Aksi dikirim ke API dengan token perangkat; bila gagal, notifikasi tetap ada dan menautkan ke Persetujuan.',
                        'Notifikasi sejenis digabung per kejadian ("3 pengajuan lembur"), jam tenang 21.00–06.00 hanya untuk prioritas tinggi.',
                        'Pratinjau isi mengikuti setelan OS; nama pemohon disembunyikan bila pengguna memilih "Saat terbuka saja".',
                    ]}
                    frameLabel="Pratinjau layar kunci ponsel"
                    screen={screen}
                />
            )}
        </>
    );
}

MobileAppLockScreenPage.layout = phoneOsLayout({
    title: 'Layar kunci',
    breadcrumbs: [
        { title: 'Aplikasi ponsel', href: '/pratinjau/ponsel' },
        { title: 'Layar kunci', href: '/pratinjau/ponsel/kunci' },
    ],
    back: '/pratinjau/ponsel',
});
