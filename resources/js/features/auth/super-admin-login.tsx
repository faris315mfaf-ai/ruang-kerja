import { Form } from '@inertiajs/react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
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
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    canResetPassword: boolean;
};

/**
 * Collapsible emergency sign-in: email + password, Super Admin only, followed
 * by the TOTP challenge (or a forced TOTP setup).
 */
export function SuperAdminLogin({
    open,
    onOpenChange,
    canResetPassword,
}: Props) {
    return (
        <Collapsible open={open} onOpenChange={onOpenChange}>
            <CollapsibleTrigger asChild>
                <button
                    type="button"
                    className="mx-auto flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-text-muted underline underline-offset-4 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:mx-0"
                    data-test="super-admin-toggle"
                >
                    <ShieldCheck className="size-4" aria-hidden />
                    <span>
                        Masuk darurat (Super Admin
                        <span className="hidden lg:inline">, wajib 2FA</span>)
                    </span>
                    <ChevronDown
                        className={cn(
                            'size-4 transition-transform duration-200 ease-brand',
                            open && 'rotate-180',
                        )}
                        aria-hidden
                    />
                </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
                <Form
                    {...store.form()}
                    resetOnSuccess={['password']}
                    resetOnError={['password']}
                    className="mt-4 grid gap-4 rounded-lg border border-border bg-surface-2 p-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <p className="text-sm text-text-muted">
                                Hanya untuk Super Admin saat Google tidak bisa
                                dipakai. Setelah kata sandi, Anda diminta kode
                                autentikator (TOTP).
                            </p>

                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoComplete="username"
                                    placeholder="admin@perusahaan.co.id"
                                    className="h-11 text-base md:text-sm"
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
                                        >
                                            Lupa kata sandi?
                                        </TextLink>
                                    )}
                                </div>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    autoComplete="current-password"
                                    placeholder="Kata sandi"
                                    className="h-11 text-base md:text-sm"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <Button
                                type="submit"
                                className="h-11 w-full"
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
