import { Head } from '@inertiajs/react';
import { useState } from 'react';
import {
    INTEGRITY_FLOW,
    IntegrityFlow,
} from '@/features/mobile-app/integrity-flow';
import type { IntegrityScenario } from '@/features/mobile-app/logic';
import {
    MobileSimBar,
    OptionGroup,
    PREVIEW_STATE_OPTIONS,
    PhoneStage,
    StageSkeleton,
} from '@/features/mobile-app/phone-stage';
import {
    usePreviewState,
    useScenario,
} from '@/features/mobile-app/use-preview-state';
import { useBreakpoint } from '@/hooks/use-breakpoint';

const SCENARIOS = ['aman', 'lokasi-palsu', 'root', 'tidak-resmi'] as const;

/** /pratinjau/ponsel/integritas — F3-2 anti fake GPS, root & unofficial app. */
export default function MobileAppIntegrityPage() {
    const breakpoint = useBreakpoint();
    const [state, setState] = usePreviewState();
    const [scenario, setScenario] = useScenario<IntegrityScenario>(
        SCENARIOS,
        'lokasi-palsu',
    );
    const [step, setStep] = useState(0);

    const controls = (
        <>
            <OptionGroup
                label="Kondisi perangkat"
                value={scenario}
                onChange={setScenario}
                options={[
                    { value: 'aman', label: 'Aman' },
                    { value: 'lokasi-palsu', label: 'Lokasi palsu' },
                    { value: 'root', label: 'Root / jailbreak' },
                    { value: 'tidak-resmi', label: 'Aplikasi tidak resmi' },
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
                            ? 'Belum diperiksa'
                            : option.value === 'galat'
                              ? 'Layanan tak menjawab'
                              : option.label,
                }))}
            />
        </>
    );

    const key = `${state}-${scenario}`;

    return (
        <>
            <Head title="Integritas perangkat" />
            {breakpoint === null ? (
                <StageSkeleton />
            ) : breakpoint === 'mobile' ? (
                <div className="flex flex-col gap-4">
                    <MobileSimBar
                        controls={controls}
                        flow={INTEGRITY_FLOW}
                        activeStep={step}
                    />
                    <IntegrityFlow
                        key={key}
                        variant="page"
                        state={state}
                        scenario={scenario}
                        onStepChange={setStep}
                    />
                </div>
            ) : (
                <PhoneStage
                    overline="Aplikasi ponsel · F3-2"
                    title="Integritas perangkat"
                    lead="Aplikasi native bisa mendeteksi lokasi palsu, perangkat yang di-root, dan aplikasi tidak resmi. Penolakannya tetap ramah: alasan jelas, cara memperbaiki, dan jalan keluar."
                    controls={controls}
                    flow={INTEGRITY_FLOW}
                    activeStep={step}
                    notes={[
                        'Android: Play Integrity API (deviceIntegrity, appIntegrity) + Location.isMock(); iOS: App Attest + DeviceCheck. Verdict diverifikasi di server, bukan di aplikasi.',
                        'Hasil disimpan di devices.integrity_verdict (jsonb) dan menandai attendance_logs.flags (mock_location, rooted, unofficial_app).',
                        'Perangkat yang gagal tidak otomatis dicabut; HR meninjau di Absensi › Mencurigakan, karyawan bisa mengajukan koreksi.',
                        'Bila layanan Google/Apple tidak menjawab, check-in tetap diterima dengan penanda "integrity_unavailable".',
                    ]}
                    frameLabel="Pratinjau pemeriksaan integritas perangkat"
                    screen={
                        <IntegrityFlow
                            key={key}
                            variant="frame"
                            state={state}
                            scenario={scenario}
                            onStepChange={setStep}
                        />
                    }
                />
            )}
        </>
    );
}

MobileAppIntegrityPage.layout = {
    breadcrumbs: [
        { title: 'Aplikasi ponsel', href: '/pratinjau/ponsel' },
        { title: 'Integritas perangkat', href: '/pratinjau/ponsel/integritas' },
    ],
    title: 'Integritas perangkat',
    back: '/pratinjau/ponsel',
};
