import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { BiometricLoginScreen } from '@/features/mobile-app/biometric-login-screen';
import type {
    BiometricMethod,
    BiometricScenario,
} from '@/features/mobile-app/biometric-login-screen';
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
import { useBreakpoint } from '@/hooks/use-breakpoint';

const FLOW = [
    'Buka aplikasi di perangkat terdaftar: sapaan nama, tanpa kata sandi',
    'Sentuh sensor sidik jari atau lihat ke kamera (Face ID)',
    'Cocok: langsung ke Beranda',
    'Tidak cocok: coba lagi, sisa percobaan ditampilkan',
    'Tiga kali gagal: biometrik dikunci, masuk dengan Google',
];

const METHODS = ['sidik-jari', 'wajah'] as const;
const SCENARIOS = ['cocok', 'tidak-cocok'] as const;

/** /pratinjau/ponsel/masuk — MLogin: biometric sign-in (F3-1). */
export default function MobileAppBiometricLoginPage() {
    const breakpoint = useBreakpoint();
    const [state, setState] = usePreviewState();
    const [method, setMethod] = useScenario<BiometricMethod>(
        METHODS,
        'sidik-jari',
    );
    const [scenario, setScenario] = useState<BiometricScenario>('cocok');
    const [step, setStep] = useState(1);

    const controls = (
        <>
            <OptionGroup
                label="Metode di perangkat"
                value={method}
                onChange={setMethod}
                options={[
                    { value: 'sidik-jari', label: 'Sidik jari' },
                    { value: 'wajah', label: 'Face ID' },
                ]}
            />
            <OptionGroup
                label="Hasil pemindaian"
                value={scenario}
                onChange={setScenario}
                options={SCENARIOS.map((value) => ({
                    value,
                    label: value === 'cocok' ? 'Cocok' : 'Tidak cocok',
                }))}
            />
            <OptionGroup
                label="Keadaan"
                value={state}
                onChange={setState}
                options={PREVIEW_STATE_OPTIONS.map((option) => ({
                    ...option,
                    label:
                        option.value === 'kosong'
                            ? 'Belum diatur'
                            : option.value === 'galat'
                              ? 'Server tak terjangkau'
                              : option.label,
                }))}
            />
        </>
    );

    // A new key restarts the simulation whenever a switch changes.
    const screen = (
        <BiometricLoginScreen
            key={`${state}-${method}-${scenario}`}
            state={state}
            method={method}
            scenario={scenario}
            onStepChange={setStep}
        />
    );

    return (
        <>
            <Head title="Masuk biometrik" />
            {breakpoint === null ? (
                <StageSkeleton />
            ) : breakpoint === 'mobile' ? (
                <MobileSimChrome
                    title="Masuk biometrik"
                    back="/pratinjau/ponsel"
                    controls={controls}
                    flow={FLOW}
                    activeStep={step}
                >
                    {screen}
                </MobileSimChrome>
            ) : (
                <PhoneStage
                    overline="Aplikasi ponsel · F3-1"
                    title="Masuk biometrik"
                    lead="Perangkat yang sudah terdaftar masuk dengan sidik jari atau Face ID. Akun Google kantor tetap menjadi jalan cadangan, tanpa kata sandi baru."
                    controls={controls}
                    flow={FLOW}
                    activeStep={step}
                    notes={[
                        'expo-local-authentication: hasil biometrik hanya membuka token sesi di SecureStore; server tidak pernah menerima data sidik jari/wajah.',
                        'Token perangkat (Sanctum) diikat ke devices.device_id_hash; mencabut perangkat di Pengaturan › Perangkat langsung mengakhiri sesinya.',
                        'Setelah 3 kali gagal, OS mengunci biometrik; tampilkan tombol Google sebagai aksi utama.',
                        'Sesi berakhir setelah 30 hari tidak aktif; biometrik tidak memperpanjang sesi yang sudah kedaluwarsa.',
                    ]}
                    frameLabel="Pratinjau layar masuk biometrik"
                    screen={screen}
                />
            )}
        </>
    );
}

MobileAppBiometricLoginPage.layout = phoneOsLayout({
    title: 'Masuk biometrik',
    breadcrumbs: [
        { title: 'Aplikasi ponsel', href: '/pratinjau/ponsel' },
        { title: 'Masuk biometrik', href: '/pratinjau/ponsel/masuk' },
    ],
    back: '/pratinjau/ponsel',
});
