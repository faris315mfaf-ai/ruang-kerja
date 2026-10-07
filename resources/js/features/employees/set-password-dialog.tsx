import { useForm } from '@inertiajs/react';
import { Check, Copy, KeyRound } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { password as setPasswordRoute } from '@/routes/admin/employees';

export type SetPasswordTarget = { id: string; name: string; email: string };

type Generated = { password: string; mustChange: boolean };

/**
 * Admin › Karyawan › Atur kata sandi (owner decision 6 Oct 2026): HR types a
 * new password or lets the app create a temporary one, which is shown once
 * (never stored in plain text). Every device of the employee is signed out.
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
    const [generated, setGenerated] = useState<Generated | null>(null);
    const form = useForm({
        mode: 'generate' as 'generate' | 'manual',
        password: '',
        password_confirmation: '',
        must_change: true,
    });

    if (generated) {
        return (
            <GeneratedPassword
                name={target.name}
                generated={generated}
                onClose={onClose}
            />
        );
    }

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.post(setPasswordRoute.url(target.id), {
                    preserveScroll: true,
                    onFlash: (flash) => {
                        const data = (
                            flash as { generatedPassword?: Generated }
                        ).generatedPassword;

                        if (data) {
                            setGenerated(data);
                        }
                    },
                    onSuccess: () => {
                        form.reset('password', 'password_confirmation');

                        if (form.data.mode === 'manual') {
                            onClose();
                        }
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

            <fieldset className="space-y-2">
                <legend className="mb-2 text-[15px] font-medium">Cara</legend>
                <div className="grid grid-cols-2 gap-2">
                    {(
                        [
                            ['generate', 'Buat sandi sementara'],
                            ['manual', 'Ketik kata sandi'],
                        ] as const
                    ).map(([value, label]) => (
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

            {form.data.mode === 'manual' ? (
                <>
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
                            placeholder="Minimal 8 karakter"
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
            ) : (
                <p className="rounded-lg bg-surface-2 px-4 py-3 text-label font-normal text-text-muted">
                    Kata sandi acak 12 karakter dibuat dan ditampilkan sekali
                    setelah disimpan. Sampaikan langsung kepada {target.name}.
                </p>
            )}

            <label className="flex items-start gap-2 text-[15px]">
                <Checkbox
                    checked={form.data.must_change}
                    onCheckedChange={(checked) =>
                        form.setData('must_change', checked === true)
                    }
                    className="mt-0.5"
                />
                <span>
                    Wajib ganti kata sandi saat login berikutnya
                    <span className="block text-meta text-text-muted">
                        Disarankan: hanya {target.name} yang tahu kata sandinya.
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
                    {form.data.mode === 'generate'
                        ? 'Buat kata sandi'
                        : 'Simpan kata sandi'}
                </Button>
            </DialogFooter>
        </form>
    );
}

function GeneratedPassword({
    name,
    generated,
    onClose,
}: {
    name: string;
    generated: Generated;
    onClose: () => void;
}) {
    const [copied, setCopied] = useState(false);

    return (
        <div className="space-y-4">
            <DialogHeader>
                <DialogTitle>Kata sandi sementara {name}</DialogTitle>
                <DialogDescription>
                    Hanya ditampilkan sekali. Sampaikan langsung kepada {name}
                    {generated.mustChange
                        ? '; ia wajib menggantinya saat login berikutnya.'
                        : '.'}
                </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 p-3">
                <code
                    className="min-w-0 flex-1 font-mono text-[20px] font-semibold tracking-wide break-all select-all"
                    data-test="generated-password"
                >
                    {generated.password}
                </code>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={copied ? 'Tersalin' : 'Salin kata sandi'}
                    onClick={() => {
                        void navigator.clipboard
                            ?.writeText(generated.password)
                            .then(() => setCopied(true))
                            .catch(() => setCopied(false));
                    }}
                >
                    {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                </Button>
            </div>

            <DialogFooter>
                <Button type="button" onClick={onClose}>
                    Selesai
                </Button>
            </DialogFooter>
        </div>
    );
}
