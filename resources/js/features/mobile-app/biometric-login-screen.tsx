import { Link } from '@inertiajs/react';
import {
    Check,
    CloudOff,
    Fingerprint,
    Lock,
    LoaderCircle,
    ScanFace,
    X,
} from 'lucide-react';
import { useEffect, useReducer, useRef, useState } from 'react';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { cn, focusRing } from '@/lib/utils';
import { PERSONA } from './fixtures';
import {
    INITIAL_BIOMETRIC,
    MAX_BIOMETRIC_ATTEMPTS,
    biometricReducer,
} from './logic';
import type { BiometricPhase } from './logic';
import { HomeIndicator, StatusBar, Wallpaper } from './phone-frame';
import type { PreviewState } from './types';

export type BiometricMethod = 'sidik-jari' | 'wajah';
export type BiometricScenario = 'cocok' | 'tidak-cocok';

/** Flow step (0-based, see the page's flow list) for a phase. */
export function biometricStep(phase: BiometricPhase | 'google'): number {
    switch (phase) {
        case 'idle':
        case 'scanning':
        case 'failed':
            return 1;
        case 'success':
        case 'google':
            return 2;
        case 'locked':
            return 4;
    }
}

const SCAN_MS = 1200;

const RING: Record<BiometricPhase, string> = {
    idle: 'bg-grad-merek shadow-glow',
    scanning: 'bg-grad-indigo shadow-glow',
    success: 'bg-grad-merek shadow-glow',
    failed: 'bg-grad-hangat shadow-warm',
    locked: 'bg-on-brand/20',
};

/** MLogin: biometric sign-in on a registered device, Google as fallback. */
export function BiometricLoginScreen({
    state,
    method,
    scenario,
    onStepChange,
}: {
    state: PreviewState;
    method: BiometricMethod;
    scenario: BiometricScenario;
    onStepChange?: (step: number) => void;
}) {
    const [bio, dispatch] = useReducer(biometricReducer, INITIAL_BIOMETRIC);
    const [viaGoogle, setViaGoogle] = useState(false);
    const timer = useRef<number | null>(null);
    const google = useFakeMutation();

    useEffect(
        () => () => {
            if (timer.current) {
                window.clearTimeout(timer.current);
            }
        },
        [],
    );

    useEffect(() => {
        onStepChange?.(biometricStep(viaGoogle ? 'google' : bio.phase));
    }, [bio.phase, viaGoogle, onStepChange]);

    const scan = () => {
        if (bio.phase === 'scanning' || bio.phase === 'locked') {
            return;
        }

        if (bio.phase === 'success') {
            dispatch({ type: 'reset' });

            return;
        }

        dispatch({ type: 'scan' });
        timer.current = window.setTimeout(() => {
            dispatch({ type: scenario === 'cocok' ? 'matched' : 'rejected' });
        }, SCAN_MS);
    };

    const signInWithGoogle = () =>
        void google.run(
            () => {
                setViaGoogle(true);
                dispatch({ type: 'reset' });
            },
            { success: 'Masuk dengan Google berhasil', delay: 900 },
        );

    const face = method === 'wajah';
    const MethodIcon = face ? ScanFace : Fingerprint;
    const notEnrolled = state === 'kosong';
    const serverDown = state === 'galat' && bio.phase === 'success';
    const signedIn = viaGoogle || (bio.phase === 'success' && !serverDown);
    const remaining = MAX_BIOMETRIC_ATTEMPTS - bio.failures;

    const copy = (() => {
        if (viaGoogle) {
            return {
                label: 'Berhasil · membuka beranda',
                sub: 'Masuk dengan Google · biometrik dibuka lagi',
            };
        }

        switch (bio.phase) {
            case 'idle':
                return face
                    ? {
                          label: 'Lihat ke kamera untuk masuk',
                          sub: 'atau sentuh sensor sidik jari',
                      }
                    : {
                          label: 'Sentuh sensor untuk masuk',
                          sub: 'atau gunakan pengenalan wajah',
                      };
            case 'scanning':
                return {
                    label: 'Memverifikasi…',
                    sub: face ? 'tetap lihat ke layar' : 'tahan jari sebentar',
                };
            case 'success':
                return serverDown
                    ? {
                          label: 'Tidak bisa terhubung',
                          sub: 'Biometrik cocok, tetapi server tidak menjawab',
                      }
                    : {
                          label: 'Berhasil · membuka beranda',
                          sub: 'Operasional · masuk 07.41',
                      };
            case 'failed':
                return {
                    label: 'Tidak cocok · coba lagi',
                    sub: `Sisa ${remaining} percobaan sebelum biometrik dikunci`,
                };
            case 'locked':
                return {
                    label: 'Biometrik dikunci sementara',
                    sub: `${MAX_BIOMETRIC_ATTEMPTS} kali tidak cocok. Masuk dengan Google untuk membukanya.`,
                };
        }
    })();

    const ringIcon = (() => {
        if (signedIn) {
            return <Check className="size-12" strokeWidth={2.4} />;
        }

        if (serverDown) {
            return <CloudOff className="size-11" strokeWidth={2} />;
        }

        if (bio.phase === 'failed') {
            return <X className="size-12" strokeWidth={2.4} />;
        }

        if (bio.phase === 'locked') {
            return <Lock className="size-11" strokeWidth={2} />;
        }

        return <MethodIcon className="size-12" strokeWidth={1.8} />;
    })();

    return (
        <Wallpaper kind="login">
            <StatusBar time="07.41" />
            <div className="flex flex-col gap-3.5 px-6 pt-10">
                <span
                    aria-hidden
                    className="flex size-16 items-center justify-center rounded-[20px] bg-grad-merek text-[22px] font-extrabold shadow-glow"
                >
                    RK
                </span>
                <span className="text-[15px] font-bold text-on-brand/70">
                    RuangKerja · SPKD
                </span>
                <h2 className="text-[32px] leading-10 font-extrabold tracking-[-0.02em]">
                    {notEnrolled
                        ? 'Masuk ke RuangKerja'
                        : `Selamat datang kembali, ${PERSONA.firstName}`}
                </h2>
                <p className="text-[17px] leading-[26px] text-on-brand/80">
                    {notEnrolled
                        ? 'Masuk biometrik belum aktif di perangkat ini. Masuk dengan akun Google kantor.'
                        : 'Perangkat ini sudah terdaftar. Masuk tanpa kata sandi.'}
                </p>
            </div>

            <div className="mt-auto flex flex-col items-center gap-4 px-6 pb-10">
                {!notEnrolled && (
                    <>
                        <button
                            type="button"
                            onClick={scan}
                            disabled={bio.phase === 'locked'}
                            aria-label={
                                face
                                    ? 'Masuk dengan pengenalan wajah'
                                    : 'Masuk dengan sidik jari'
                            }
                            className={cn(
                                'relative flex size-28 items-center justify-center rounded-full transition-transform duration-120 ease-brand active:scale-95 disabled:cursor-not-allowed',
                                focusRing,
                                RING[bio.phase],
                            )}
                        >
                            {bio.phase === 'scanning' && (
                                <span
                                    aria-hidden
                                    className="absolute inset-0 animate-ping rounded-full bg-fill-violet/40"
                                />
                            )}
                            <span
                                aria-hidden
                                className={cn(
                                    'relative flex size-24 items-center justify-center rounded-full bg-preview-dark',
                                    bio.phase === 'locked'
                                        ? 'text-on-brand/70'
                                        : 'text-brand-300',
                                )}
                            >
                                {ringIcon}
                            </span>
                        </button>
                        <div
                            role="status"
                            aria-live="polite"
                            className="flex flex-col items-center gap-1 text-center"
                        >
                            <span className="text-[18px] font-extrabold">
                                {copy.label}
                            </span>
                            <span className="text-[15px] text-on-brand/70">
                                {copy.sub}
                            </span>
                        </div>
                        {signedIn && (
                            <Link
                                href="/dashboard"
                                className={cn(
                                    'flex h-[54px] w-full items-center justify-center rounded-[16px] bg-on-brand text-[17px] font-extrabold text-brand-800',
                                    focusRing,
                                )}
                            >
                                Buka beranda
                            </Link>
                        )}
                        {serverDown && (
                            <button
                                type="button"
                                onClick={() => dispatch({ type: 'reset' })}
                                className={cn(
                                    'h-[54px] w-full rounded-[16px] bg-on-brand text-[17px] font-extrabold text-brand-800',
                                    focusRing,
                                )}
                            >
                                Coba lagi
                            </button>
                        )}
                        <span
                            aria-hidden
                            className="my-1 h-px w-full bg-on-brand/14"
                        />
                    </>
                )}
                {!signedIn && (
                    <button
                        type="button"
                        onClick={signInWithGoogle}
                        disabled={google.processing}
                        className={cn(
                            'flex h-[54px] w-full items-center justify-center gap-3 rounded-[16px] text-[16px] font-bold transition-colors duration-120 ease-brand',
                            focusRing,
                            bio.phase === 'locked' || notEnrolled
                                ? 'bg-on-brand text-brand-800'
                                : 'border border-on-brand/24 bg-on-brand/6 text-on-brand hover:bg-on-brand/12',
                        )}
                    >
                        {google.processing ? (
                            <LoaderCircle
                                aria-hidden
                                className="size-5 animate-spin"
                            />
                        ) : (
                            <span
                                aria-hidden
                                className="flex size-6 items-center justify-center rounded-full bg-on-brand text-[14px] font-extrabold text-accent-blue-strong"
                            >
                                G
                            </span>
                        )}
                        {google.processing
                            ? 'Membuka Google…'
                            : 'Masuk dengan Google'}
                    </button>
                )}
                <span className="text-center text-[13px] text-on-brand/70">
                    {notEnrolled
                        ? 'Aktifkan masuk biometrik di Pengaturan › Perangkat setelah masuk'
                        : 'Sesi berakhir otomatis setelah 30 hari tidak aktif'}
                </span>
            </div>
            <HomeIndicator />
        </Wallpaper>
    );
}
