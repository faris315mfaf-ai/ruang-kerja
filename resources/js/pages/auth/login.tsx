import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { demo, store } from '@/routes/login';
import { request } from '@/routes/password';

type DemoAccount = {
    email: string;
    name: string;
    role_label: string;
};

type Props = {
    status?: string;
    canResetPassword: boolean;
    /** Only filled when APP_ENV=local and DEMO_LOGIN_ENABLED=true. */
    demoAccounts?: DemoAccount[];
};

export default function Login({
    status,
    canResetPassword,
    demoAccounts = [],
}: Props) {
    return (
        <>
            <Head title="Masuk" />

            <PasskeyVerify />

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                    placeholder="nama@perusahaan.co.id"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center">
                                    <Label htmlFor="password">Kata sandi</Label>
                                    {canResetPassword && (
                                        <TextLink
                                            href={request()}
                                            className="ml-auto text-sm"
                                            tabIndex={5}
                                        >
                                            Lupa kata sandi?
                                        </TextLink>
                                    )}
                                </div>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                    placeholder="Kata sandi"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="flex items-center space-x-3">
                                <Checkbox
                                    id="remember"
                                    name="remember"
                                    tabIndex={3}
                                />
                                <Label htmlFor="remember">Ingat saya</Label>
                            </div>

                            <Button
                                type="submit"
                                className="mt-4 w-full"
                                tabIndex={4}
                                disabled={processing}
                                data-test="login-button"
                            >
                                {processing && <Spinner />}
                                Masuk
                            </Button>
                        </div>
                    </>
                )}
            </Form>

            {status && (
                <div className="mb-4 text-center text-sm font-medium text-success">
                    {status}
                </div>
            )}

            {demoAccounts.length > 0 && (
                <DemoLoginSection accounts={demoAccounts} />
            )}
        </>
    );
}

function DemoLoginSection({ accounts }: { accounts: DemoAccount[] }) {
    return (
        <section
            aria-labelledby="demo-login-title"
            className="flex flex-col gap-3 border-t border-border pt-6"
        >
            <div className="flex flex-col gap-1">
                <h2
                    id="demo-login-title"
                    className="text-sm font-semibold text-foreground"
                >
                    Masuk cepat (demo lokal)
                </h2>
                <p className="text-xs text-muted-foreground">
                    Hanya tersedia di lingkungan lokal. Pilih akun untuk masuk
                    tanpa kata sandi.
                </p>
            </div>

            <ul className="grid gap-2">
                {accounts.map((account) => (
                    <li key={account.email}>
                        <Form {...demo.form()}>
                            {({ processing, errors }) => (
                                <>
                                    <input
                                        type="hidden"
                                        name="email"
                                        value={account.email}
                                    />
                                    <Button
                                        type="submit"
                                        variant="outline"
                                        disabled={processing}
                                        aria-label={`Masuk sebagai ${account.name} (${account.role_label})`}
                                        className="h-auto min-h-11 w-full justify-between gap-3 px-3 py-2 text-left"
                                        data-test="demo-login-button"
                                    >
                                        <span className="flex min-w-0 flex-col">
                                            <span className="truncate text-sm font-medium text-foreground">
                                                {account.name}
                                            </span>
                                            <span className="truncate text-xs font-normal text-muted-foreground">
                                                {account.email}
                                            </span>
                                        </span>
                                        <span className="flex shrink-0 items-center gap-2 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                            {processing && <Spinner />}
                                            {account.role_label}
                                        </span>
                                    </Button>
                                    <InputError
                                        message={errors.email}
                                        className="mt-1"
                                    />
                                </>
                            )}
                        </Form>
                    </li>
                ))}
            </ul>
        </section>
    );
}

Login.layout = {
    title: 'Masuk ke akun Anda',
    description: 'Masukkan email dan kata sandi Anda untuk masuk',
};
