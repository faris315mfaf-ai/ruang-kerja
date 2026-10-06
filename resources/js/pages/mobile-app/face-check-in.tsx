import { Head, Link } from '@inertiajs/react';
import { Smartphone } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    FACE_FLOW,
    FaceCheckInFlow,
} from '@/features/mobile-app/face-check-in-flow';
import type { FaceScenario } from '@/features/mobile-app/logic';
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

const SCENARIOS = ['cocok', 'liveness', 'tidak-cocok'] as const;

/** /absensi/wajah — F3-1 face check-in with liveness (phone app only). */
export default function MobileAppFaceCheckInPage() {
    const breakpoint = useBreakpoint();
    const [state, setState] = usePreviewState();
    const [scenario, setScenario] = useScenario<FaceScenario>(
        SCENARIOS,
        'cocok',
    );
    const [enrolled, setEnrolled] = useState(false);
    const [step, setStep] = useState(0);

    const controls = (
        <>
            <OptionGroup
                label="Data wajah"
                value={enrolled ? 'ada' : 'belum'}
                onChange={(next) => setEnrolled(next === 'ada')}
                options={[
                    { value: 'belum', label: 'Belum terdaftar' },
                    { value: 'ada', label: 'Sudah terdaftar' },
                ]}
            />
            <OptionGroup
                label="Hasil pencocokan"
                value={scenario}
                onChange={setScenario}
                options={[
                    { value: 'cocok', label: 'Cocok 98%' },
                    { value: 'liveness', label: 'Gagal liveness' },
                    { value: 'tidak-cocok', label: 'Tidak cocok' },
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
                            ? 'Tidak ada jadwal'
                            : option.value === 'galat'
                              ? 'Server tak terjangkau'
                              : option.label,
                }))}
            />
        </>
    );

    const key = `${state}-${scenario}-${enrolled}`;

    return (
        <>
            <Head title="Check-in wajah" />
            {breakpoint === null ? (
                <StageSkeleton />
            ) : breakpoint === 'mobile' ? (
                <div className="flex flex-col gap-4">
                    <MobileSimBar
                        controls={controls}
                        flow={FACE_FLOW}
                        activeStep={step}
                    />
                    <FaceCheckInFlow
                        key={key}
                        variant="page"
                        state={state}
                        enrolled={enrolled}
                        scenario={scenario}
                        onStepChange={setStep}
                    />
                </div>
            ) : (
                <PhoneStage
                    overline="Absensi · F3-1"
                    title="Check-in wajah"
                    lead="Check-in dengan pengenalan wajah dan uji liveness, setelah persetujuan biometrik yang eksplisit. GPS + selfie dan QR tetap tersedia sebagai cadangan."
                    notice={
                        <div
                            role="note"
                            className="flex flex-wrap items-center gap-4 rounded-panel border border-border bg-surface p-5 shadow-card"
                        >
                            <span
                                aria-hidden
                                className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-grad-soft text-link"
                            >
                                <Smartphone className="size-6" />
                            </span>
                            <span className="flex min-w-[220px] flex-1 flex-col gap-0.5">
                                <span className="text-[17px] font-bold">
                                    Tersedia di aplikasi ponsel
                                </span>
                                <span className="text-[15px] text-text-muted">
                                    Pengenalan wajah butuh kamera depan dan
                                    pemeriksaan perangkat. Di komputer, coba
                                    alurnya di pratinjau samping.
                                </span>
                            </span>
                            <Button variant="outline" asChild>
                                <Link href="/absensi">Check-in biasa</Link>
                            </Button>
                        </div>
                    }
                    controls={controls}
                    flow={FACE_FLOW}
                    activeStep={step}
                    notes={[
                        'Template dibuat on-device (expo-camera + model wajah ringan); server menerima embedding terenkripsi, bukan foto (face_templates.template bytea terenkripsi).',
                        'attendance_consents tipe face dengan versi kebijakan wajib ada dan belum dicabut sebelum enrol maupun check-in.',
                        'Check-in menulis attendance_logs method = face dengan skor kemiripan & hasil liveness di flags; selfie tidak disimpan.',
                        'Gagal 3 kali → tawarkan GPS + selfie; percobaan gagal tidak memblokir, hanya ditandai bila janggal.',
                    ]}
                    frameLabel="Pratinjau check-in wajah di aplikasi ponsel"
                    screen={
                        <FaceCheckInFlow
                            key={key}
                            variant="frame"
                            state={state}
                            enrolled={enrolled}
                            scenario={scenario}
                            onStepChange={setStep}
                        />
                    }
                />
            )}
        </>
    );
}

MobileAppFaceCheckInPage.layout = {
    breadcrumbs: [
        { title: 'Absensi', href: '/absensi' },
        { title: 'Check-in wajah', href: '/absensi/wajah' },
    ],
    title: 'Check-in wajah',
    back: '/absensi',
};
