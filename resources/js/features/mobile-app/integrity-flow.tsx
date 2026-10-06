import { Link } from '@inertiajs/react';
import {
    Check,
    CircleHelp,
    LoaderCircle,
    SearchCheck,
    ShieldAlert,
    ShieldCheck,
    X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { cn } from '@/lib/utils';
import { AppScreen } from './app-screen';
import type { ScreenVariant } from './app-screen';
import {
    INTEGRITY_CHECKS,
    INTEGRITY_SCENARIOS,
    evaluateIntegrity,
} from './logic';
import type { IntegrityScenario } from './logic';
import type { PreviewState } from './types';

export const INTEGRITY_FLOW = [
    'Sebelum check-in, aplikasi memeriksa perangkat (Play Integrity / App Attest)',
    'Lolos: lanjut ke check-in seperti biasa',
    'Gagal: penolakan ramah, alasan dalam bahasa sehari-hari dan cara memperbaiki',
    'Periksa ulang setelah diperbaiki',
    'Atau ajukan koreksi absensi ke atasan & HR',
];

type Stage = 'idle' | 'checking' | 'done' | 'error' | 'correction' | 'sent';

const CHECK_MS = 550;
const MIN_REASON = 10;

/**
 * F3-2 device integrity before check-in: mock location, root/jailbreak and
 * unofficial app builds are refused with a friendly explanation, a fix and
 * a way out (re-check, attendance correction). Remount with a `key` to
 * restart.
 */
export function IntegrityFlow({
    variant,
    state,
    scenario,
    onStepChange,
}: {
    variant: ScreenVariant;
    state: PreviewState;
    scenario: IntegrityScenario;
    onStepChange?: (step: number) => void;
}) {
    const [stage, setStage] = useState<Stage>(
        state === 'kosong' ? 'idle' : 'checking',
    );
    const [checked, setChecked] = useState(0);
    const [fixed, setFixed] = useState(false);
    const [reason, setReason] = useState('');
    const [touched, setTouched] = useState(false);
    const timer = useRef<number | null>(null);
    const submit = useFakeMutation();
    const fieldId = useId();

    const verdict = fixed
        ? INTEGRITY_SCENARIOS.aman
        : INTEGRITY_SCENARIOS[scenario];
    const outcome = evaluateIntegrity(verdict);

    useEffect(() => {
        if (stage !== 'checking') {
            return;
        }

        if (checked >= INTEGRITY_CHECKS.length) {
            timer.current = window.setTimeout(
                () => setStage(state === 'galat' && !fixed ? 'error' : 'done'),
                250,
            );
        } else {
            timer.current = window.setTimeout(
                () => setChecked((count) => count + 1),
                CHECK_MS,
            );
        }

        return () => {
            if (timer.current) {
                window.clearTimeout(timer.current);
            }
        };
    }, [stage, checked, state, fixed]);

    useEffect(() => {
        const step =
            stage === 'idle' || stage === 'checking' || stage === 'error'
                ? 0
                : stage === 'correction' || stage === 'sent'
                  ? 4
                  : outcome.ok
                    ? fixed
                        ? 3
                        : 1
                    : 2;

        onStepChange?.(step);
    }, [stage, outcome.ok, fixed, onStepChange]);

    const recheck = () => {
        // The simulation assumes the person followed the steps.
        setFixed(true);
        setChecked(0);
        setStage('checking');
    };

    const rows = (
        <ul className="flex flex-col rounded-[20px] border border-border bg-surface px-4">
            {INTEGRITY_CHECKS.map((check, index) => {
                const pending = stage === 'checking' && index >= checked;
                const running = stage === 'checking' && index === checked;
                const failed =
                    !pending &&
                    stage !== 'error' &&
                    verdict.failed.includes(check.key);
                const unknown = stage === 'error' || stage === 'idle';

                return (
                    <li
                        key={check.key}
                        className="flex min-h-[60px] items-center gap-3 border-b border-divider last:border-b-0"
                    >
                        <span
                            aria-hidden
                            className={cn(
                                'flex size-7 shrink-0 items-center justify-center rounded-full',
                                unknown || pending
                                    ? 'bg-surface-2 text-text-muted'
                                    : failed
                                      ? 'bg-danger-soft text-danger'
                                      : 'bg-success-soft text-success',
                            )}
                        >
                            {running ? (
                                <LoaderCircle className="size-4 animate-spin" />
                            ) : unknown || pending ? (
                                <CircleHelp className="size-4" />
                            ) : failed ? (
                                <X className="size-4" strokeWidth={3} />
                            ) : (
                                <Check className="size-4" strokeWidth={3} />
                            )}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="text-[16px] font-bold">
                                {check.label}
                            </span>
                            <span className="text-[14px] text-text-muted">
                                {running
                                    ? 'Memeriksa…'
                                    : unknown || pending
                                      ? 'Belum diperiksa'
                                      : failed
                                        ? 'Tidak lolos'
                                        : check.passed}
                            </span>
                        </span>
                    </li>
                );
            })}
        </ul>
    );

    if (stage === 'idle') {
        return (
            <AppScreen variant={variant} title="Pemeriksaan perangkat">
                <EmptyState
                    icon={SearchCheck}
                    title="Perangkat belum diperiksa"
                    description="Pemeriksaan berjalan otomatis sebelum check-in pertama hari ini."
                    action={
                        <Button onClick={() => setStage('checking')}>
                            Periksa sekarang
                        </Button>
                    }
                />
                {rows}
            </AppScreen>
        );
    }

    if (stage === 'checking') {
        return (
            <AppScreen variant={variant} title="Pemeriksaan perangkat">
                <div role="status" className="flex flex-col gap-1">
                    <p className="text-overline text-link">Sebelum check-in</p>
                    <h2 className="text-[26px] leading-8 font-extrabold tracking-[-0.02em]">
                        Memeriksa perangkat…
                    </h2>
                    <p className="text-[15px] text-text-muted">
                        {checked} dari {INTEGRITY_CHECKS.length} pemeriksaan
                        selesai
                    </p>
                </div>
                {rows}
            </AppScreen>
        );
    }

    if (stage === 'error') {
        return (
            <AppScreen
                variant={variant}
                title="Pemeriksaan perangkat"
                actions={
                    <>
                        <Button size="lg" className="w-full" onClick={recheck}>
                            Coba lagi
                        </Button>
                        <Button variant="quiet" className="w-full" asChild>
                            <Link href="/absensi">
                                Check-in tanpa pemeriksaan
                            </Link>
                        </Button>
                    </>
                }
            >
                <div
                    role="alert"
                    className="flex flex-col gap-2 rounded-[22px] border border-border bg-warning-soft p-4"
                >
                    <span className="flex items-center gap-2 text-[17px] font-extrabold text-warning">
                        <ShieldAlert aria-hidden className="size-5" />
                        Pemeriksaan belum selesai
                    </span>
                    <p className="text-[15px] leading-[22px] text-text">
                        Layanan pemeriksaan Google tidak menjawab. Coba lagi
                        sebentar. Bila tetap gagal, check-in tetap bisa tetapi
                        ditandai untuk ditinjau HR.
                    </p>
                </div>
                {rows}
            </AppScreen>
        );
    }

    if (stage === 'sent') {
        return (
            <AppScreen
                variant={variant}
                title="Ajukan koreksi"
                actions={
                    <Button size="lg" className="w-full" asChild>
                        <Link href="/pengajuan">Lihat pengajuan saya</Link>
                    </Button>
                }
            >
                <div
                    role="status"
                    className="flex flex-col items-center gap-3 rounded-[28px] border border-border bg-surface px-5 py-7 text-center shadow-card"
                >
                    <span
                        aria-hidden
                        className="flex size-16 items-center justify-center rounded-full bg-success-soft text-success"
                    >
                        <Check className="size-9" strokeWidth={2.6} />
                    </span>
                    <h2 className="text-[24px] leading-8 font-extrabold">
                        Pengajuan koreksi terkirim
                    </h2>
                    <span className="font-mono text-[15px] font-semibold text-text-muted">
                        KOR-2026-10-0007
                    </span>
                    <Badge variant="status" tone="warning" dot>
                        Menunggu Hendra (atasan)
                    </Badge>
                    <p className="text-[15px] leading-[22px] text-text-muted">
                        Setelah atasan menyetujui, HR (Hana) menetapkan jam
                        masuk Anda. Notifikasi dikirim di setiap langkah.
                    </p>
                </div>
            </AppScreen>
        );
    }

    if (stage === 'correction') {
        const error =
            touched && reason.trim().length < MIN_REASON
                ? `Tulis alasan minimal ${MIN_REASON} karakter.`
                : null;

        return (
            <AppScreen
                variant={variant}
                title="Ajukan koreksi"
                actions={
                    <>
                        <Button
                            size="lg"
                            className="w-full"
                            disabled={submit.processing}
                            onClick={() => {
                                setTouched(true);

                                if (reason.trim().length < MIN_REASON) {
                                    return;
                                }

                                void submit.run(() => setStage('sent'), {
                                    success: 'Pengajuan koreksi terkirim',
                                });
                            }}
                        >
                            {submit.processing
                                ? 'Mengirim…'
                                : 'Kirim pengajuan'}
                        </Button>
                        <Button
                            variant="quiet"
                            className="w-full"
                            onClick={() => setStage('done')}
                        >
                            Batal
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-1">
                    <p className="text-overline text-link">Koreksi absensi</p>
                    <h2 className="text-[24px] leading-8 font-extrabold">
                        Sen, 5 Okt · check-in 07.52
                    </h2>
                    <p className="text-[15px] text-text-muted">
                        Alur: atasan langsung → HR. Hasil pemeriksaan perangkat
                        ikut dilampirkan.
                    </p>
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor={fieldId}>Alasan</Label>
                    <Textarea
                        id={fieldId}
                        value={reason}
                        rows={5}
                        onChange={(event) => setReason(event.target.value)}
                        onBlur={() => setTouched(true)}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={`${fieldId}-hint`}
                        placeholder="Mis. Sudah di kantor sejak 07.50, ponsel kantor terpasang aplikasi lokasi untuk uji gudang."
                        className="text-[17px] md:text-[16px]"
                    />
                    <p
                        id={`${fieldId}-hint`}
                        className={cn(
                            'text-[14px]',
                            error ? 'text-danger' : 'text-text-muted',
                        )}
                    >
                        {error ?? 'Atasan dan HR membaca alasan ini.'}
                    </p>
                </div>
            </AppScreen>
        );
    }

    // stage === 'done'
    if (outcome.ok) {
        return (
            <AppScreen
                variant={variant}
                title="Pemeriksaan perangkat"
                actions={
                    <Button size="lg" className="w-full" asChild>
                        <Link href="/absensi/wajah">Lanjut check-in</Link>
                    </Button>
                }
            >
                <div
                    role="status"
                    className="flex items-center gap-3 rounded-[22px] bg-success-soft p-4"
                >
                    <ShieldCheck
                        aria-hidden
                        className="size-8 shrink-0 text-success"
                    />
                    <span className="flex flex-col">
                        <span className="text-[18px] font-extrabold text-success">
                            Perangkat aman
                        </span>
                        <span className="text-[15px] text-text">
                            {fixed
                                ? 'Masalah sudah teratasi. Terima kasih!'
                                : 'Semua pemeriksaan lolos. Silakan check-in.'}
                        </span>
                    </span>
                </div>
                {rows}
            </AppScreen>
        );
    }

    return (
        <AppScreen
            variant={variant}
            title="Pemeriksaan perangkat"
            actions={
                <>
                    <Button size="lg" className="w-full" onClick={recheck}>
                        Periksa ulang
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setStage('correction')}
                    >
                        Ajukan koreksi
                    </Button>
                </>
            }
        >
            <div
                role="alert"
                className="flex flex-col items-center gap-2 pt-2 text-center"
            >
                <span
                    aria-hidden
                    className="flex size-20 items-center justify-center rounded-full bg-warning-soft text-warning"
                >
                    <ShieldAlert className="size-10" strokeWidth={1.8} />
                </span>
                <p className="text-overline text-warning">
                    Check-in belum bisa dilakukan
                </p>
                <h2 className="text-[26px] leading-8 font-extrabold tracking-[-0.02em]">
                    {outcome.title}
                </h2>
                <p className="text-[16px] leading-6 text-text-muted">
                    {outcome.explanation}
                </p>
            </div>
            <section
                aria-label="Cara memperbaiki"
                className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-4"
            >
                <h3 className="text-[17px] font-extrabold">Cara memperbaiki</h3>
                <ol className="flex flex-col gap-3">
                    {outcome.steps.map((step, index) => (
                        <li
                            key={step}
                            className="flex gap-3 text-[16px] leading-6"
                        >
                            <span
                                aria-hidden
                                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-link-soft text-[14px] font-bold text-link"
                            >
                                {index + 1}
                            </span>
                            {step}
                        </li>
                    ))}
                </ol>
            </section>
            {rows}
            <p className="text-[14px] leading-5 text-text-muted">
                Kejadian ini dicatat untuk ditinjau HR, bukan sanksi otomatis.
                Bila Anda yakin tidak ada yang salah, ajukan koreksi.
            </p>
        </AppScreen>
    );
}
