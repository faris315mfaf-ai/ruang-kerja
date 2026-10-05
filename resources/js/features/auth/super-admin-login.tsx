import { Form, Link } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { authLinkClass } from './parts';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    canResetPassword: boolean;
    /** Right side of the link row (DLogin: "Kebijakan privasi"). */
    aside?: ReactNode;
    className?: string;
};

/**
 * Emergency sign-in (DLogin "Masuk sebagai Super Admin"): email + password,
 * Super Admin only, followed by the TOTP challenge (or a forced TOTP setup).
 */
export function SuperAdminLogin({
    open,
    onOpenChange,
    canResetPassword,
    aside,
    className,
}: Props) {
    return (
        <Collapsible
            open={open}
            onOpenChange={onOpenChange}
            className={className}
        >
            <div className="flex flex-wrap items-center justify-between gap-x-4">
                <CollapsibleTrigger asChild>
                    <button
                        type="button"
                        className={authLinkClass}
                        data-test="super-admin-toggle"
                    >
                        Masuk sebagai Super Admin
                        <ChevronDown
                            className={cn(
                                'size-4 transition-transform duration-180 ease-brand motion-reduce:transition-none',
                                open && 'rotate-180',
                            )}
                            aria-hidden
                        />
                    </button>
                </CollapsibleTrigger>
                {aside}
            </div>

            <CollapsibleContent>
                <Form
                    {...store.form()}
                    resetOnSuccess={['password']}
                    resetOnError={['password']}
                    className="mt-3 flex flex-col gap-4 rounded-[18px] border border-border bg-surface p-5"
                >
                    {({ processing, errors }) => (
                        <>
                            <p className="text-label font-normal text-text-muted">
                                Hanya untuk Super Admin saat Google tidak bisa
                                dipakai. Setelah kata sandi, Anda diminta kode
                                autentikator (TOTP).
                            </p>

                            <div className="flex flex-col gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoComplete="username"
                                    placeholder="admin@perusahaan.co.id"
                                    aria-invalid={
                                        errors.email ? true : undefined
                                    }
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex items-center">
                                    <Label htmlFor="password">Kata sandi</Label>
                                    {canResetPassword && (
                                        <Link
                                            href={request()}
                                            className={cn(
                                                authLinkClass,
                                                '-my-2 ml-auto',
                                            )}
                                        >
                                            Lupa kata sandi?
                                        </Link>
                                    )}
                                </div>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    autoComplete="current-password"
                                    placeholder="Kata sandi"
                                    aria-invalid={
                                        errors.password ? true : undefined
                                    }
                                />
                                <InputError message={errors.password} />
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={processing}
                                data-test="login-button"
                            >
                                {processing && <Spinner />}
                                Masuk sebagai Super Admin
                            </Button>
                        </>
                    )}
                </Form>
            </CollapsibleContent>
        </Collapsible>
    );
}
