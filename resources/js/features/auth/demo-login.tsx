import { Form } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { demo } from '@/routes/login';
import type { DemoAccount } from './types';

/** One-click demo accounts (APP_ENV=local + DEMO_LOGIN_ENABLED only). */
export function DemoLoginSection({ accounts }: { accounts: DemoAccount[] }) {
    return (
        <section
            aria-labelledby="demo-login-title"
            className="flex flex-col gap-3 rounded-lg border border-dashed border-border-strong bg-surface p-4"
        >
            <div className="flex flex-col gap-1">
                <h2
                    id="demo-login-title"
                    className="text-sm font-semibold text-text"
                >
                    Masuk cepat (demo lokal)
                </h2>
                <p className="text-xs text-text-muted">
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
                                            <span className="truncate text-sm font-medium text-text">
                                                {account.name}
                                            </span>
                                            <span className="truncate text-xs font-normal text-text-muted">
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
