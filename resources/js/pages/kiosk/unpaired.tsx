import { Head, useForm, usePage } from '@inertiajs/react';
import { KeyRound, MonitorSmartphone } from 'lucide-react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    formatActivationCode,
    isCompleteActivationCode,
} from '@/features/kiosk/activation-code';
import activateRoutes from '@/routes/kiosk/activate';

/**
 * /kiosk on a device that is not (or no longer) registered as a kiosk. HR's
 * activation link pairs it, or the short code shown next to the link can be
 * typed here (handy on a TV or kiosk browser).
 */
export default function KioskUnpaired() {
    const { branding } = usePage().props;
    const form = useForm({ code: '' });
    const complete = isCompleteActivationCode(form.data.code);

    const submit = () => {
        if (!complete || form.processing) {
            return;
        }

        // The typed code stays on errors so a single typo can be fixed.
        form.post(activateRoutes.code.url(), { preserveScroll: true });
    };

    return (
        <div className="dark flex min-h-dvh items-center justify-center bg-background p-6 text-text">
            <Head title="Kiosk belum terdaftar" />
            <div className="w-full max-w-md space-y-8">
                <div className="space-y-4 text-center">
                    <span
                        aria-hidden
                        className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-text-muted"
                    >
                        <MonitorSmartphone
                            className="size-7"
                            strokeWidth={1.75}
                        />
                    </span>
                    <h1 className="text-2xl font-semibold">
                        Perangkat ini belum terdaftar sebagai kiosk
                    </h1>
                    <p className="text-base text-text-muted">
                        Minta HR membuat tautan aktivasi di {branding.name} ›
                        Admin › Lokasi &amp; shift › Kiosk QR, lalu buka tautan
                        itu di perangkat ini, atau ketik kode aktivasinya di
                        bawah. Bila kiosk dinonaktifkan atau dipasang di
                        perangkat lain, layar ini juga muncul.
                    </p>
                </div>

                <form
                    className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-card"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <label
                        htmlFor="kiosk-activation-code"
                        className="flex items-center gap-2 text-[15px] font-medium"
                    >
                        <KeyRound
                            className="size-4 text-text-muted"
                            aria-hidden
                        />
                        Kode aktivasi
                    </label>
                    <input
                        id="kiosk-activation-code"
                        name="code"
                        value={form.data.code}
                        onChange={(event) =>
                            form.setData(
                                'code',
                                formatActivationCode(event.target.value),
                            )
                        }
                        placeholder="ABCD-2345"
                        autoComplete="one-time-code"
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        inputMode="text"
                        maxLength={9}
                        aria-invalid={form.errors.code ? true : undefined}
                        aria-describedby="kiosk-activation-code-help kiosk-activation-code-error"
                        className="h-16 w-full rounded-xl border border-border-strong bg-background px-4 text-center font-mono text-3xl font-semibold tracking-[0.2em] text-text uppercase outline-none placeholder:text-text-subtle focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/30 aria-invalid:border-danger"
                    />
                    <p
                        id="kiosk-activation-code-help"
                        className="text-sm text-text-muted"
                    >
                        8 karakter, sekali pakai, berlaku sama lamanya dengan
                        tautan aktivasi.
                    </p>
                    <InputError
                        id="kiosk-activation-code-error"
                        role="alert"
                        message={form.errors.code}
                    />
                    <Button
                        type="submit"
                        className="h-12 w-full text-base"
                        disabled={!complete || form.processing}
                    >
                        {form.processing
                            ? 'Memasangkan…'
                            : 'Pasangkan perangkat ini'}
                    </Button>
                </form>
            </div>
        </div>
    );
}
