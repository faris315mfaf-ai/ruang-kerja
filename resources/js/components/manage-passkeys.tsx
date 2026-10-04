import { router } from '@inertiajs/react';
import { KeyRound } from 'lucide-react';
import { destroy } from '@/actions/Laravel/Passkeys/Http/Controllers/PasskeyRegistrationController';
import { EmptyState } from '@/components/empty-state';
import Heading from '@/components/heading';
import PasskeyItem from '@/components/passkey-item';
import PasskeyRegistration from '@/components/passkey-register';
import type { Passkey } from '@/types/auth';

export type Props = {
    canManagePasskeys?: boolean;
    passkeys?: Passkey[];
};

export default function ManagePasskeys(props: Props) {
    const passkeys = props.passkeys ?? [];

    const handleDelete = (id: number, onError: () => void) => {
        router.delete(destroy.url(id), {
            preserveScroll: true,
            onError,
        });
    };

    const handleRegisterSuccess = () => {
        router.reload();
    };

    if (!(props.canManagePasskeys ?? false)) {
        return null;
    }

    return (
        <div className="space-y-6">
            <Heading
                variant="small"
                title="Passkey"
                description="Kelola passkey untuk masuk tanpa kata sandi"
            />

            {passkeys.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-border">
                    {passkeys.map((passkey) => (
                        <PasskeyItem
                            key={passkey.id}
                            passkey={passkey}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            ) : (
                <EmptyState
                    icon={KeyRound}
                    title="Belum ada passkey"
                    description="Tambahkan passkey agar bisa masuk tanpa kata sandi."
                    className="py-10"
                />
            )}

            <PasskeyRegistration onSuccess={handleRegisterSuccess} />
        </div>
    );
}
