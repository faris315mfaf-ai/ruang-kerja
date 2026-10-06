import { Link } from '@inertiajs/react';
import {
    CalendarOff,
    Check,
    CircleAlert,
    CloudOff,
    MapPin,
    ScanFace,
    ShieldCheck,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { useCamera } from '@/hooks/use-camera';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AppScreen } from './app-screen';
import type { ScreenVariant } from './app-screen';
import { FaceViewport, LivenessSteps, useLiveness } from './face-viewport';
import { BIOMETRIC_POLICY, FACE_TEMPLATE, SHIFT_TODAY } from './fixtures';
import {
    FACE_MATCH_THRESHOLD,
    LIVENESS_STEPS,
    canGiveConsent,
    faceOutcome,
} from './logic';
import type { FaceOutcome, FaceScenario } from './logic';
import type { PreviewState } from './types';

export const FACE_FLOW = [
    'Persetujuan data biometrik (UU PDP): baca, centang, versi kebijakan dicatat',
    'Daftarkan wajah: kamera depan, panduan oval, uji liveness',
    'Check-in dengan metode wajah di lokasi kantor',
    'Liveness singkat lalu pencocokan dengan template',
    'Hasil: cocok tercatat, gagal coba lagi atau pakai GPS + selfie',
];

type Stage = 'consent' | 'enroll' | 'ready' | 'scanning' | 'result';

const STAGE_STEP: Record<Stage, number> = {
    consent: 0,
    enroll: 1,
    ready: 2,
    scanning: 3,
    result: 4,
};

const MAX_ATTEMPTS = 3;
const ENROLL_STEP_MS = 1400;
const SCAN_STEP_MS = 1300;

const CONSENT_TICKS = [
    'Saya memahami wajah saya diproses menjadi template untuk check-in.',
    'Saya tahu persetujuan ini bisa dicabut kapan saja di Pengaturan › Perangkat.',
];

/**
 * F3-1 face check-in: explicit biometric consent → enrolment with liveness →
 * check-in with method `face` → result. Renders in the phone shell (`page`)
 * or inside the desktop phone frame (`frame`). Remount with a `key` to
 * restart after changing the simulation.
 */
export function FaceCheckInFlow({
    variant,
    state,
    enrolled,
    scenario,
    onStepChange,
}: {
    variant: ScreenVariant;
    state: PreviewState;
    /** Start with an existing template (skips consent & enrolment). */
    enrolled: boolean;
    scenario: FaceScenario;
    onStepChange?: (step: number) => void;
}) {
    const [stage, setStage] = useState<Stage>(enrolled ? 'ready' : 'consent');
    const [ticks, setTicks] = useState<boolean[]>(
        CONSENT_TICKS.map(() => false),
    );
    const [enrolling, setEnrolling] = useState(false);
    const [enrolledNow, setEnrolledNow] = useState(enrolled);
    const [outcome, setOutcome] = useState<FaceOutcome | null>(null);
    const [failures, setFailures] = useState(0);
    const [queued, setQueued] = useState(false);
    const camera = useCamera();
    const save = useFakeMutation();
    const tickId = useId();

    useEffect(() => {
        onStepChange?.(STAGE_STEP[stage]);
    }, [stage, onStepChange]);

    const stopCamera = camera.stop;

    const finishEnroll = useCallback(() => {
        stopCamera();
        setEnrolling(false);
        setEnrolledNow(true);
    }, [stopCamera]);

    const finishScan = useCallback(() => {
        stopCamera();

        const result = faceOutcome(scenario);

        if (result.kind === 'match') {
            void save
                .run(() => undefined, {
                    fail: state === 'galat',
                    error: 'Server tidak terjangkau. Check-in disimpan di perangkat.',
                    delay: 500,
                })
                .then((ok) => {
                    setQueued(!ok);
                    setOutcome(result);
                    setStage('result');
                });

            return;
        }

        setFailures((count) => count + 1);
        setOutcome(result);
        setStage('result');
    }, [scenario, save, state, stopCamera]);

    const enroll = useLiveness(
        enrolling,
        ENROLL_STEP_MS,
        LIVENESS_STEPS.length,
        finishEnroll,
    );
    // Check-in only asks for a blink (one step) after the face is centred.
    const scan = useLiveness(stage === 'scanning', SCAN_STEP_MS, 2, finishScan);

    const startEnroll = () => {
        void camera.start('user');
        setEnrolling(true);
    };

    const startScan = () => {
        setOutcome(null);
        setStage('scanning');
        void camera.start('user');
    };

    const live = camera.state === 'live';
    const cameraNote =
        camera.error &&
        'Kamera tidak tersedia di pratinjau ini, jadi dipakai ilustrasi. Di aplikasi, kamera depan wajib.';

    // --- Empty: no schedule today ---------------------------------------------------
    if (state === 'kosong') {
        return (
            <AppScreen variant={variant} title="Check-in wajah">
                <EmptyState
                    icon={CalendarOff}
                    title="Tidak ada jadwal hari ini"
                    description="Senin, 5 Okt bukan hari kerja Anda. Check-in tidak diperlukan."
                    action={
                        <Button variant="outline" asChild>
                            <Link href="/absensi/riwayat">Lihat riwayat</Link>
                        </Button>
                    }
                />
            </AppScreen>
        );
    }

    // --- 1. Consent ---------------------------------------------------------------
    if (stage === 'consent') {
        return (
            <AppScreen
                variant={variant}
                title="Check-in wajah"
                actions={
                    <>
                        <Button
                            size="lg"
                            className="w-full"
                            disabled={!canGiveConsent(ticks) || save.processing}
                            onClick={() =>
                                void save.run(() => setStage('enroll'), {
                                    success: `Persetujuan biometrik ${BIOMETRIC_POLICY.version} dicatat`,
                                })
                            }
                        >
                            {save.processing
                                ? 'Menyimpan…'
                                : 'Setuju & daftarkan wajah'}
                        </Button>
                        <Button variant="quiet" className="w-full" asChild>
                            <Link href="/absensi">
                                Tidak sekarang · pakai GPS + selfie
                            </Link>
                        </Button>
                    </>
                }
            >
                <span
                    aria-hidden
                    className="flex size-16 items-center justify-center rounded-xl bg-grad-soft text-link"
                >
                    <ScanFace className="size-8" strokeWidth={1.8} />
                </span>
                <div className="flex flex-col gap-1">
                    <h2 className="text-[26px] leading-8 font-extrabold tracking-[-0.02em]">
                        Persetujuan data biometrik
                    </h2>
                    <p className="text-[15px] text-text-muted">
                        Kebijakan biometrik {BIOMETRIC_POLICY.version} · berlaku{' '}
                        {formatDate(BIOMETRIC_POLICY.published_on)}
                    </p>
                </div>
                <ul className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-4">
                    {BIOMETRIC_POLICY.points.map((point) => (
                        <li
                            key={point}
                            className="flex gap-3 text-[16px] leading-6"
                        >
                            <ShieldCheck
                                aria-hidden
                                className="mt-0.5 size-5 shrink-0 text-success"
                            />
                            {point}
                        </li>
                    ))}
                </ul>
                <fieldset className="flex flex-col gap-1">
                    <legend className="sr-only">Pernyataan persetujuan</legend>
                    {CONSENT_TICKS.map((text, index) => (
                        <label
                            key={text}
                            htmlFor={`${tickId}-${index}`}
                            className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-[16px] leading-6"
                        >
                            <Checkbox
                                id={`${tickId}-${index}`}
                                checked={ticks[index]}
                                onCheckedChange={(checked) =>
                                    setTicks((current) =>
                                        current.map((value, i) =>
                                            i === index
                                                ? checked === true
                                                : value,
                                        ),
                                    )
                                }
                                className="mt-0.5"
                            />
                            {text}
                        </label>
                    ))}
                </fieldset>
                <p className="text-[14px] leading-5 text-text-muted">
                    Data biometrik termasuk data pribadi spesifik (UU PDP No.
                    27/2022). Template dihapus otomatis bila persetujuan
                    dicabut.
                </p>
            </AppScreen>
        );
    }

    // --- 2. Enrolment -------------------------------------------------------------
    if (stage === 'enroll') {
        const stepLabel = enrolledNow
            ? null
            : enrolling
              ? (LIVENESS_STEPS[enroll.step]?.label ?? null)
              : 'Siap memindai';

        return (
            <AppScreen
                variant={variant}
                title="Daftarkan wajah"
                actions={
                    enrolledNow ? (
                        <Button
                            size="lg"
                            className="w-full"
                            onClick={() => setStage('ready')}
                        >
                            Lanjut ke check-in
                        </Button>
                    ) : (
                        <Button
                            size="lg"
                            className="w-full"
                            disabled={enrolling}
                            onClick={startEnroll}
                        >
                            {enrolling
                                ? `Memindai… ${enroll.percent}%`
                                : 'Mulai pemindaian'}
                        </Button>
                    )
                }
            >
                <div className="flex flex-col gap-1 text-center">
                    <h2 className="text-[22px] leading-7 font-extrabold">
                        {enrolledNow
                            ? 'Wajah terdaftar'
                            : 'Posisikan wajah di dalam oval'}
                    </h2>
                    <p className="text-[15px] text-text-muted">
                        {enrolledNow
                            ? `Template ${FACE_TEMPLATE.model_version} disimpan terenkripsi.`
                            : 'Cahaya cukup, tanpa masker atau kacamata hitam.'}
                    </p>
                </div>
                <FaceViewport
                    attachVideo={camera.attachVideo}
                    live={live}
                    progress={enrolledNow ? 100 : enroll.percent}
                    tone={enrolledNow ? 'success' : 'brand'}
                    hint={stepLabel}
                />
                <LivenessSteps
                    step={enrolledNow ? LIVENESS_STEPS.length : enroll.step}
                />
                {cameraNote && (
                    <p className="rounded-[14px] bg-info-soft px-3 py-2 text-[14px] text-info">
                        {cameraNote}
                    </p>
                )}
            </AppScreen>
        );
    }

    // --- 3. Ready / 4. Scanning ------------------------------------------------------
    if (stage === 'ready' || stage === 'scanning') {
        const scanning = stage === 'scanning';
        const remaining = MAX_ATTEMPTS - failures;

        return (
            <AppScreen
                variant={variant}
                title="Check-in wajah"
                actions={
                    <>
                        <Button
                            size="lg"
                            className="w-full"
                            disabled={scanning || remaining <= 0}
                            onClick={startScan}
                        >
                            <ScanFace aria-hidden />
                            {scanning
                                ? save.processing
                                    ? 'Mencatat…'
                                    : 'Mencocokkan…'
                                : 'Check-in dengan wajah'}
                        </Button>
                        <Button variant="quiet" className="w-full" asChild>
                            <Link href="/absensi">Pakai GPS + selfie</Link>
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-1">
                    <p className="text-overline text-link">Check-in · Wajah</p>
                    <h2 className="text-[26px] leading-8 font-extrabold tracking-[-0.02em]">
                        Sen, 5 Okt · {SHIFT_TODAY.name}
                    </h2>
                </div>
                {scanning ? (
                    <>
                        <FaceViewport
                            attachVideo={camera.attachVideo}
                            live={live}
                            progress={scan.percent}
                            hint={
                                scan.step === 0
                                    ? 'Lihat ke kamera'
                                    : 'Kedipkan mata'
                            }
                        />
                        {cameraNote && (
                            <p className="rounded-[14px] bg-info-soft px-3 py-2 text-[14px] text-info">
                                {cameraNote}
                            </p>
                        )}
                    </>
                ) : (
                    <ul className="flex flex-col rounded-[20px] border border-border bg-surface px-4">
                        {[
                            {
                                icon: ScanFace,
                                title: 'Data wajah terdaftar',
                                meta: `sejak ${formatDate(FACE_TEMPLATE.created_at)}`,
                            },
                            {
                                icon: MapPin,
                                title: `${SHIFT_TODAY.location} · ${SHIFT_TODAY.distance_m} m`,
                                meta: `dalam radius ${SHIFT_TODAY.radius_m} m`,
                            },
                            {
                                icon: ShieldCheck,
                                title: 'Perangkat lolos integritas',
                                meta: 'lokasi asli · aplikasi resmi',
                            },
                        ].map((row) => (
                            <li
                                key={row.title}
                                className="flex min-h-[60px] items-center gap-3 border-b border-divider last:border-b-0"
                            >
                                <span
                                    aria-hidden
                                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"
                                >
                                    <Check className="size-4" strokeWidth={3} />
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-[16px] font-bold">
                                        {row.title}
                                    </span>
                                    <span className="text-[14px] text-text-muted">
                                        {row.meta}
                                    </span>
                                </span>
                                <row.icon
                                    aria-hidden
                                    className="size-5 shrink-0 text-text-subtle"
                                />
                            </li>
                        ))}
                    </ul>
                )}
                {!scanning && failures > 0 && (
                    <p
                        role="status"
                        className="text-[15px] font-semibold text-warning"
                    >
                        {remaining > 0
                            ? `Sisa ${remaining} percobaan wajah hari ini.`
                            : 'Batas percobaan wajah habis. Pakai GPS + selfie.'}
                    </p>
                )}
            </AppScreen>
        );
    }

    // --- 5. Result ----------------------------------------------------------------
    if (outcome?.kind === 'match') {
        return (
            <AppScreen
                variant={variant}
                title="Check-in wajah"
                actions={
                    <>
                        <Button size="lg" className="w-full" asChild>
                            <Link href="/dashboard">Ke beranda</Link>
                        </Button>
                        <Button variant="quiet" className="w-full" asChild>
                            <Link
                                href={
                                    queued
                                        ? '/pratinjau/ponsel/offline'
                                        : '/absensi/riwayat'
                                }
                            >
                                {queued
                                    ? 'Lihat antrean sinkron'
                                    : 'Lihat riwayat absensi'}
                            </Link>
                        </Button>
                    </>
                }
            >
                <div
                    role="status"
                    className={cn(
                        'flex flex-col items-center gap-3 rounded-[28px] px-5 py-7 text-center',
                        queued
                            ? 'border border-border bg-warning-soft text-text'
                            : 'bg-primary bg-grad-highlight text-on-brand shadow-glow',
                    )}
                >
                    <span
                        aria-hidden
                        className={cn(
                            'flex size-20 items-center justify-center rounded-full',
                            queued
                                ? 'bg-surface text-warning'
                                : 'bg-on-brand text-brand-600',
                        )}
                    >
                        {queued ? (
                            <CloudOff className="size-10" />
                        ) : (
                            <Check className="size-11" strokeWidth={2.8} />
                        )}
                    </span>
                    <h2 className="text-[28px] leading-9 font-extrabold tracking-[-0.025em]">
                        {queued
                            ? 'Check-in tersimpan di perangkat'
                            : 'Check-in berhasil'}
                    </h2>
                    <span className="text-[52px] leading-[58px] font-extrabold tracking-[-0.04em] tnum">
                        07.52
                    </span>
                    <span
                        className={cn(
                            'inline-flex min-h-9 items-center rounded-full px-4 text-[15px] font-bold',
                            queued
                                ? 'bg-surface text-warning'
                                : 'bg-on-brand/18',
                        )}
                    >
                        {queued
                            ? 'Dikirim otomatis saat sinyal kembali'
                            : 'Tepat waktu · 8 menit sebelum shift'}
                    </span>
                </div>
                <dl className="flex flex-col rounded-[20px] border border-border bg-surface px-4">
                    {[
                        ['Lokasi', SHIFT_TODAY.location],
                        ['Jarak', `${SHIFT_TODAY.distance_m} m · dalam radius`],
                        ['Metode', `Wajah · cocok ${outcome.score}%`],
                        ['Pulang terjadwal', SHIFT_TODAY.end],
                    ].map(([term, value]) => (
                        <div
                            key={term}
                            className="flex min-h-[52px] items-center justify-between gap-3 border-b border-divider text-[16px] last:border-b-0"
                        >
                            <dt className="text-text-muted">{term}</dt>
                            <dd className="text-right font-bold">{value}</dd>
                        </div>
                    ))}
                </dl>
            </AppScreen>
        );
    }

    const liveness = outcome?.kind === 'liveness_failed';
    const remaining = MAX_ATTEMPTS - failures;

    return (
        <AppScreen
            variant={variant}
            title="Check-in wajah"
            actions={
                <>
                    {remaining > 0 && (
                        <Button
                            size="lg"
                            className="w-full"
                            onClick={startScan}
                        >
                            Coba lagi
                        </Button>
                    )}
                    <Button
                        variant={remaining > 0 ? 'quiet' : 'default'}
                        size={remaining > 0 ? 'default' : 'lg'}
                        className="w-full"
                        asChild
                    >
                        <Link href="/absensi">Pakai GPS + selfie</Link>
                    </Button>
                </>
            }
        >
            <div
                role="alert"
                className="flex flex-col items-center gap-3 rounded-[28px] border border-border bg-surface px-5 py-7 text-center shadow-card"
            >
                <span
                    aria-hidden
                    className="flex size-20 items-center justify-center rounded-full bg-danger-soft text-danger"
                >
                    {liveness ? (
                        <CircleAlert className="size-10" />
                    ) : (
                        <X className="size-10" strokeWidth={2.6} />
                    )}
                </span>
                <h2 className="text-[24px] leading-8 font-extrabold">
                    {liveness
                        ? 'Uji liveness tidak lolos'
                        : 'Wajah tidak cocok'}
                </h2>
                {!liveness && outcome?.kind === 'no_match' && (
                    <Badge variant="status" tone="danger" dot>
                        Kemiripan {outcome.score}% · batas{' '}
                        {FACE_MATCH_THRESHOLD}%
                    </Badge>
                )}
                <p className="text-[16px] leading-6 text-text-muted">
                    {liveness
                        ? 'Kedipan mata tidak terdeteksi. Pastikan wajah cukup terang dan Anda tidak memakai foto atau layar lain.'
                        : 'Lepas masker atau kacamata hitam, lalu coba lagi di tempat yang lebih terang.'}
                </p>
                <p className="text-[15px] font-semibold text-warning">
                    {remaining > 0
                        ? `Sisa ${remaining} percobaan. Setelah itu pakai GPS + selfie.`
                        : 'Batas percobaan wajah habis untuk hari ini.'}
                </p>
            </div>
            <p className="text-[14px] leading-5 text-text-muted">
                Percobaan gagal tidak membuat Anda tercatat terlambat. HR hanya
                melihat penanda bila percobaan berulang dari perangkat lain.
            </p>
        </AppScreen>
    );
}
