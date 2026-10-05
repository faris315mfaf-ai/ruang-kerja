import { Form } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { demo } from '@/routes/login';
import type { DemoAccount } from './types';

/**
 * "Masuk cepat · demo lokal" card (DLogin): one outline button per demo
 * account in a two-column grid. APP_ENV=local + DEMO_LOGIN_ENABLED only.
 */
export function DemoLoginSection({ accounts }: { accounts: DemoAccount[] }) {
    return (
        <section
            aria-labelledby="demo-login-title"
            className="flex flex-col gap-3 rounded-[18px] border border-border bg-surface p-5"
        >
            <h2 id="demo-login-title" className="text-[16px] font-bold">
                Masuk cepat · demo lokal
            </h2>

            <ul className="grid grid-cols-2 gap-2">
                {accounts.map((account) => (
                    <li key={account.email} className="min-w-0">
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
                                        title={account.email}
                                        className="w-full px-3 text-[15px]"
                                        data-test="demo-login-button"
                                    >
                                        {processing && <Spinner />}
                                        <span className="truncate">
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

            <p className="text-meta font-normal text-text-muted">
                Hanya tampil bila APP_ENV=local. Masuk tanpa kata sandi.
            </p>
        </section>
    );
}
