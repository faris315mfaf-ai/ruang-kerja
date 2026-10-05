import { Eye, EyeOff } from 'lucide-react';
import type { ComponentProps, Ref } from 'react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function PasswordInput({
    className,
    ref,
    ...props
}: Omit<ComponentProps<'input'>, 'type'> & { ref?: Ref<HTMLInputElement> }) {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="relative">
            <Input
                type={showPassword ? 'text' : 'password'}
                className={cn('pr-12', className)}
                ref={ref}
                {...props}
            />
            <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-3.5 text-text-muted transition-colors duration-120 ease-brand hover:text-text focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                aria-label={
                    showPassword
                        ? 'Sembunyikan kata sandi'
                        : 'Tampilkan kata sandi'
                }
                tabIndex={-1}
            >
                {showPassword ? (
                    <EyeOff className="size-5" aria-hidden />
                ) : (
                    <Eye className="size-5" aria-hidden />
                )}
            </button>
        </div>
    );
}
