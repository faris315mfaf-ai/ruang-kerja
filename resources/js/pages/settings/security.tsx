import { Form, Head } from '@inertiajs/react';
import { ShieldAlert } from 'lucide-react';
import { useRef } from 'react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import { Spinner } from '@/components/ui/spinner';
import { edit as editProfile } from '@/routes/profile';
import { edit } from '@/routes/security';
import type { Props as ManageTwoFactorProps } from '@/components/manage-two-factor';
import ManageTwoFactor from '@/components/manage-two-factor';

type Props = {
    passwordRules: string;
    /** Super Admin signed in with a password but has no confirmed TOTP yet. */
    twoFactorRequired: boolean;
} & ManageTwoFactorProps;

export default function Security(props: Props) {
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);

    return (
        <>
            <Head title="Pengaturan keamanan" />

            <h1 className="hidden md:sr-only md:block">Pengaturan keamanan</h1>

            {props.twoFactorRequired && (
                <div
                    role="alert"
                    className="flex gap-3 rounded-lg bg-warning-soft px-4 py-3.5"
                >
                    <ShieldAlert
                        aria-hidden
                        className="mt-0.5 size-5 shrink-0 text-warning"
                    />
                    <div className="flex flex-col gap-0.5">
                        <p className="text-body font-bold text-warning">
                            Wajib aktifkan autentikasi dua faktor
                        </p>
                        <p className="text-label font-normal text-text">
                            Login dengan email dan kata sandi hanya untuk Super
                            Admin dan wajib memakai kode TOTP. Aktifkan 2FA di
                            bawah untuk melanjutkan ke aplikasi.
                        </p>
                    </div>
                </div>
            )}

            <ManageTwoFactor
                canManageTwoFactor={props.canManageTwoFactor}
                requiresConfirmation={props.requiresConfirmation}
                twoFactorEnabled={props.twoFactorEnabled}
            />

            <Panel title="Ubah kata sandi" bodyClassName="gap-5">
                <p className="text-label font-normal text-text-muted">
                    Gunakan kata sandi yang panjang dan acak agar akun Anda
                    tetap aman.
                </p>

                <Form
                    {...SecurityController.update.form()}
                    options={{
                        preserveScroll: true,
                    }}
                    resetOnError={[
                        'password',
                        'password_confirmation',
                        'current_password',
                    ]}
                    resetOnSuccess
                    onError={(errors) => {
                        if (errors.password) {
                            passwordInput.current?.focus();
                        }

                        if (errors.current_password) {
                            currentPasswordInput.current?.focus();
                        }
                    }}
                    className="flex max-w-[480px] flex-col gap-5"
                >
                    {({ errors, processing }) => (
                        <>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="current_password">
                                    Kata sandi saat ini
                                </Label>

                                <PasswordInput
                                    id="current_password"
                                    ref={currentPasswordInput}
                                    name="current_password"
                                    autoComplete="current-password"
                                    placeholder="Kata sandi saat ini"
                                />

                                <InputError message={errors.current_password} />
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label htmlFor="password">
                                    Kata sandi baru
                                </Label>

                                <PasswordInput
                                    id="password"
                                    ref={passwordInput}
                                    name="password"
                                    autoComplete="new-password"
                                    placeholder="Kata sandi baru"
                                    passwordrules={props.passwordRules}
                                />

                                <InputError message={errors.password} />
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label htmlFor="password_confirmation">
                                    Konfirmasi kata sandi
                                </Label>

                                <PasswordInput
                                    id="password_confirmation"
                                    name="password_confirmation"
                                    autoComplete="new-password"
                                    placeholder="Ulangi kata sandi baru"
                                    passwordrules={props.passwordRules}
                                />

                                <InputError
                                    message={errors.password_confirmation}
                                />
                            </div>

                            <Button
                                className="self-start"
                                disabled={processing}
                                data-test="update-password-button"
                            >
                                {processing && <Spinner />}
                                Simpan kata sandi
                            </Button>
                        </>
                    )}
                </Form>
            </Panel>
        </>
    );
}

Security.layout = {
    breadcrumbs: [
        { title: 'Pengaturan', href: editProfile() },
        { title: 'Keamanan', href: edit() },
    ],
    title: 'Keamanan',
    back: '/settings/profile',
};
