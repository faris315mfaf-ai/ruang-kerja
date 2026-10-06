import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DEMO_OTP } from '@/features/automation/fixtures';
import {
    formatPhone,
    maskPhone,
    normalizePhone,
} from '@/features/automation/phone';
import type {
    NotificationEventKey,
    WhatsappSettings,
} from '@/features/automation/types';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';

const MAX_ATTEMPTS = 3;
const RESEND_SECONDS = 60;

/**
 * Local state of the WhatsApp settings preview: connect flow (number → OTP
 * → connected), per-event opt-in, quiet hours, disconnect. Every change is a
 * fake mutation; a real page would post to the same shape.
 */
export function useWhatsapp(initial: WhatsappSettings) {
    const [settings, setSettings] = useState<WhatsappSettings>(initial);
    const [phoneInput, setPhoneInput] = useState('');
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [pendingPhone, setPendingPhone] = useState<string | null>(null);
    const [otp, setOtp] = useState('');
    const [otpError, setOtpError] = useState<string | null>(null);
    const [attempts, setAttempts] = useState(0);
    const [resendIn, setResendIn] = useState(0);

    const sending = useFakeMutation();
    const verifying = useFakeMutation();
    const saving = useFakeMutation();
    const disconnecting = useFakeMutation();

    useEffect(() => {
        if (resendIn <= 0) {
            return;
        }

        const timer = window.setTimeout(() => setResendIn((s) => s - 1), 1000);

        return () => window.clearTimeout(timer);
    }, [resendIn]);

    const submitPhone = useCallback(async () => {
        const result = normalizePhone(phoneInput);

        if (!result.ok) {
            setPhoneError(result.error);

            return;
        }

        setPhoneError(null);
        await sending.run(
            () => {
                setPendingPhone(result.e164);
                setOtp('');
                setOtpError(null);
                setAttempts(0);
                setResendIn(RESEND_SECONDS);
                setSettings((s) => ({ ...s, status: 'verifying' }));
            },
            { success: `Kode dikirim ke ${result.display}` },
        );
    }, [phoneInput, sending]);

    const resend = useCallback(async () => {
        if (!pendingPhone || resendIn > 0) {
            return;
        }

        await sending.run(
            () => {
                setOtp('');
                setOtpError(null);
                setAttempts(0);
                setResendIn(RESEND_SECONDS);
            },
            { success: 'Kode baru dikirim' },
        );
    }, [pendingPhone, resendIn, sending]);

    const locked = attempts >= MAX_ATTEMPTS;

    const verify = useCallback(async () => {
        if (otp.length !== 6 || locked || !pendingPhone) {
            return;
        }

        const correct = otp === DEMO_OTP;

        await verifying.run(
            () => {
                if (!correct) {
                    const used = attempts + 1;

                    setAttempts(used);
                    setOtp('');
                    setOtpError(
                        used >= MAX_ATTEMPTS
                            ? 'Terlalu banyak percobaan. Minta kode baru.'
                            : `Kode salah. Sisa ${MAX_ATTEMPTS - used} percobaan.`,
                    );

                    return;
                }

                setSettings((s) => ({
                    ...s,
                    status: 'connected',
                    phone: pendingPhone,
                    connected_at: new Date().toISOString(),
                }));
                setPendingPhone(null);
                setPhoneInput('');
                toast.success('WhatsApp terhubung');
            },
            { delay: 700 },
        );
    }, [attempts, locked, otp, pendingPhone, verifying]);

    const changeNumber = useCallback(() => {
        setSettings((s) => ({ ...s, status: 'disconnected' }));
        setPendingPhone(null);
        setOtp('');
        setOtpError(null);
        setResendIn(0);
    }, []);

    const disconnect = useCallback(
        () =>
            disconnecting.run(
                () =>
                    setSettings((s) => ({
                        ...s,
                        status: 'disconnected',
                        phone: null,
                        connected_at: null,
                    })),
                {
                    success:
                        'WhatsApp diputuskan. Notifikasi tetap lewat aplikasi & email.',
                },
            ),
        [disconnecting],
    );

    const toggleEvent = useCallback(
        (event: NotificationEventKey, on: boolean) => {
            void saving.run(
                () =>
                    setSettings((s) => ({
                        ...s,
                        events: s.events.map((e) =>
                            e.event === event ? { ...e, whatsapp: on } : e,
                        ),
                    })),
                { delay: 250 },
            );
        },
        [saving],
    );

    const setQuietHours = useCallback(
        (patch: Partial<WhatsappSettings['quiet_hours']>) => {
            void saving.run(
                () =>
                    setSettings((s) => ({
                        ...s,
                        quiet_hours: { ...s.quiet_hours, ...patch },
                    })),
                { delay: 250, success: 'Jam tenang disimpan' },
            );
        },
        [saving],
    );

    const sendTest = useCallback(
        () =>
            sending.run(() => undefined, {
                success: settings.phone
                    ? `Pesan uji dikirim ke ${maskPhone(settings.phone)} (pratinjau)`
                    : undefined,
            }),
        [sending, settings.phone],
    );

    return {
        settings,
        phoneInput,
        setPhoneInput: (value: string) => {
            setPhoneInput(value);
            setPhoneError(null);
        },
        phoneError,
        pendingPhoneDisplay: pendingPhone ? formatPhone(pendingPhone) : null,
        otp,
        setOtp: (value: string) => {
            setOtp(value.replace(/\D/g, ''));
            if (!locked) {
                setOtpError(null);
            }
        },
        otpError,
        locked,
        resendIn,
        sendingCode: sending.processing,
        verifyingCode: verifying.processing,
        disconnecting: disconnecting.processing,
        submitPhone,
        resend,
        verify,
        changeNumber,
        disconnect,
        toggleEvent,
        setQuietHours,
        sendTest,
    };
}

export type WhatsappState = ReturnType<typeof useWhatsapp>;
