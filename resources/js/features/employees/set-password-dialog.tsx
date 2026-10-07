import { useForm } from '@inertiajs/react';
import { Check, Copy, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { requestJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import { password as setPasswordRoute } from '@/routes/admin/employees';
import { defaultMethod as defaultPasswordRoute } from '@/routes/admin/employees/password';
import type { SetPasswordMode } from './set-password-modes';
import {
    initialSetPasswordMode,
    MASKED_PASSWORD,
    setPasswordModes,
} from './set-password-modes';

export type SetPasswordTarget = {
    id: string;
    name: string;
    email: string;
    /** The company default password may be given to this account. */
    defaultAvailable: boolean;
    /** Super Admin: strict password rules (min 8, not the email). */
    strict: boolean;
};

/**
 * Admin › Karyawan › Atur kata sandi (owner decisions 6 & 7 Oct 2026): HR gives
 * the company default password ("Sandi bawaan", first and pre-selected when
 * configured) or types one. Every device of the employee is signed out.
 */
export function SetPasswordDialog({
    target,
    onClose,
}: {
    target: SetPasswordTarget | null;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={target !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="sm:max-w-md">
                {target && (
                    <SetPasswordForm
                        key={target.id}
                        target={target}
                        onClose={onClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function SetPasswordForm({
    target,
    onClose,
}: {
    target: SetPasswordTarget;
    onClose: () => void;
}) {
    const modes = setPasswordModes(target.defaultAvailable);
    const form = useForm({
        mode: initialSetPasswordMode(
            target.defaultAvailable,
        ) as SetPasswordMode,
        password: '',
        password_confirmation: '',
        must_change: true,
    });

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.post(setPasswordRoute.url(target.id), {
                    preserveScroll: true,
                    onSuccess: () => {
                        form.reset('password', 'password_confirmation');
                        onClose();
                    },
                    onError: () =>
                        form.reset('password', 'password_confirmation'),
                });
            }}
            className="space-y-4"
        >
            <DialogHeader>
                <DialogTitle>Atur kata sandi {target.name}</DialogTitle>
                <DialogDescription>
                    Semua perangkat {target.name} langsung keluar. Ia mendapat
                    notifikasi dan email bahwa kata sandinya diatur ulang oleh
                    HR (tanpa isi kata sandi).
                </DialogDescription>
            </DialogHeader>

            {modes.length > 1 && (
                <fieldset className="space-y-2">
                    <legend className="mb-2 text-[15px] font-medium">
                        Cara
                    </legend>
                    <div className="grid grid-cols-2 gap-2">
                        {modes.map(({ value, label }) => (
                            <label
                                key={value}
                                className={cn(
                                    'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[15px] leading-5',
                                    form.data.mode === value
                                        ? 'border-link bg-link-soft text-text'
                                        : 'border-border text-text-muted',
                                )}
                            >
                                <input
                                    type="radio"
                                    name="mode"
                                    value={value}
                                    checked={form.data.mode === value}
                                    onChange={() => form.setData('mode', value)}
                                    className="accent-primary"
                                />
                                {label}
                            </label>
                        ))}
                    </div>
                    <InputError message={form.errors.mode} />
                </fieldset>
            )}

            {form.data.mode === 'default' ? (
                <DefaultPasswordPanel target={target} />
            ) : (
                <>
                    {modes.length === 1 && (
                        <InputError message={form.errors.mode} />
                    )}
                    {/* Keeps password managers from saving it for HR's own account. */}
                    <input
                        type="hidden"
                        name="username"
                        autoComplete="off"
                        value={target.email}
                        readOnly
                    />
                    <div className="space-y-2">
                        <Label htmlFor="set-password">Kata sandi baru</Label>
                        <PasswordInput
                            id="set-password"
                            value={form.data.password}
                            onChange={(event) =>
                                form.setData('password', event.target.value)
                            }
                            autoComplete="new-password"
                            required
                            placeholder={
                                target.strict ? 'Minimal 8 karakter' : undefined
                            }
                            aria-invalid={
                                Boolean(form.errors.password) || undefined
                            }
                        />
                        <InputError message={form.errors.password} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="set-password-confirmation">
                            Ulangi kata sandi
                        </Label>
                        <PasswordInput
                            id="set-password-confirmation"
                            value={form.data.password_confirmation}
                            onChange={(event) =>
                                form.setData(
                                    'password_confirmation',
                                    event.target.value,
                                )
                            }
                            autoComplete="new-password"
                            required
                        />
                    </div>
                </>
            )}

            <label className="flex items-start gap-2 text-[15px]">
                <Checkbox
                    checked={
                        form.data.mode === 'default' || form.data.must_change
                    }
                    disabled={form.data.mode === 'default'}
                    onCheckedChange={(checked) =>
                        form.setData('must_change', checked === true)
                    }
                    className="mt-0.5"
                />
                <span>
                    Wajib ganti kata sandi saat login berikutnya
                    <span className="block text-meta text-text-muted">
                        {form.data.mode === 'default'
                            ? 'Selalu untuk sandi bawaan: semua karyawan mengetahuinya.'
                            : `Disarankan: hanya ${target.name} yang tahu kata sandinya.`}
                    </span>
                </span>
            </label>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Batal
                </Button>
                <Button
                    type="submit"
                    disabled={form.processing}
                    data-test="set-password-submit"
                >
                    <KeyRound aria-hidden />
                    {form.data.mode === 'default'
                        ? 'Pakai sandi bawaan'
                        : 'Simpan kata sandi'}
                </Button>
            </DialogFooter>
        </form>
    );
}

type Reveal =
    | { state: 'hidden' }
    | { state: 'loading' }
    | { state: 'shown'; value: string }
    | { state: 'error' };

/**
 * The default password, masked until HR reveals it (fetched on demand, never
 * part of the page props) so HR can tell the employee in person.
 */
function DefaultPasswordPanel({ target }: { target: SetPasswordTarget }) {
    const [reveal, setReveal] = useState<Reveal>({ state: 'hidden' });
    const [copied, setCopied] = useState(false);
    const shown = reveal.state === 'shown';

    const toggle = () => {
        if (shown) {
            setReveal({ state: 'hidden' });
            setCopied(false);

            return;
        }

        setReveal({ state: 'loading' });
        requestJson<{ password: string }>(defaultPasswordRoute.url(target.id))
            .then(({ password }) =>
                setReveal({ state: 'shown', value: password }),
            )
            .catch(() => setReveal({ state: 'error' }));
    };

    return (
        <div className="space-y-2">
            <p className="text-[15px] font-medium" id="default-password-label">
                Kata sandi bawaan
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 p-2 pl-3">
                <code
                    aria-labelledby="default-password-label"
                    className={cn(
                        'min-w-0 flex-1 font-mono text-[18px] font-semibold break-all',
                        shown ? 'tracking-wide select-all' : 'text-text-muted',
                    )}
                    data-test="default-password"
                >
                    {shown ? reveal.value : MASKED_PASSWORD}
                </code>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={
                        shown
                            ? 'Sembunyikan kata sandi bawaan'
                            : 'Tampilkan kata sandi bawaan'
                    }
                    aria-pressed={shown}
                    disabled={reveal.state === 'loading'}
                    onClick={toggle}
                    data-test="reveal-default-password"
                >
                    {reveal.state === 'loading' ? (
                        <Spinner />
                    ) : shown ? (
                        <EyeOff aria-hidden />
                    ) : (
                        <Eye aria-hidden />
                    )}
                </Button>
                {shown && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={copied ? 'Tersalin' : 'Salin kata sandi'}
                        onClick={() => {
                            void navigator.clipboard
                                ?.writeText(reveal.value)
                                .then(() => setCopied(true))
                                .catch(() => setCopied(false));
                        }}
                    >
                        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                    </Button>
                )}
            </div>
            {reveal.state === 'error' ? (
                <InputError message="Sandi bawaan gagal dimuat. Coba lagi." />
            ) : (
                <p className="text-meta text-text-muted">
                    Sama untuk semua karyawan baru. Sampaikan langsung kepada{' '}
                    {target.name}, jangan lewat grup obrolan.
                </p>
            )}
        </div>
    );
}
