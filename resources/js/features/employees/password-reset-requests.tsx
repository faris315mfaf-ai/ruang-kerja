import { Link, router, useForm } from '@inertiajs/react';
import { Check, KeyRound, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import InputError from '@/components/input-error';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { show } from '@/routes/admin/employees';
import { approve, reject } from '@/routes/admin/employees/password-resets';
import type { PasswordResetItem } from './types';

/**
 * "Permintaan reset sandi" (owner decision 6 Oct 2026): employees who used
 * "Lupa kata sandi" are waiting on their screen. HR approves (the employee then
 * sets a new password within 30 minutes) or rejects with a reason. Shown on
 * Admin › Karyawan (all requests) and on an employee's profile (theirs).
 */
export function PasswordResetRequests({
    requests,
    showEmployee = true,
    className,
}: {
    requests: PasswordResetItem[];
    /** false on the employee's own profile (name already in the header). */
    showEmployee?: boolean;
    className?: string;
}) {
    const [rejecting, setRejecting] = useState<PasswordResetItem | null>(null);
    const [approving, setApproving] = useState<string | null>(null);

    if (requests.length === 0) {
        return null;
    }

    const approveRequest = (request: PasswordResetItem) => {
        setApproving(request.id);
        router.post(
            approve.url(request.id),
            {},
            {
                preserveScroll: true,
                onError: (errors) =>
                    toast.error(
                        errors.request ??
                            'Permintaan gagal disetujui. Coba lagi.',
                    ),
                onFinish: () => setApproving(null),
            },
        );
    };

    return (
        <>
            <Panel
                title={
                    <>
                        <KeyRound aria-hidden className="size-5 text-warning" />
                        {showEmployee
                            ? 'Permintaan reset sandi'
                            : 'Meminta reset kata sandi'}
                        {showEmployee && (
                            <Badge
                                variant="count"
                                aria-label={`${requests.length} permintaan menunggu`}
                            >
                                {requests.length}
                            </Badge>
                        )}
                    </>
                }
                className={cn('border-warning/40', className)}
                bodyClassName="gap-3"
                flush={showEmployee}
            >
                <p
                    className={cn(
                        'text-label font-normal text-text-muted',
                        showEmployee && 'px-6 md:px-7',
                    )}
                >
                    Pastikan permintaan benar dari karyawan tersebut (mis. lewat
                    telepon) sebelum menyetujui. Karyawan menunggu di layarnya
                    dan langsung membuat kata sandi baru setelah disetujui.
                </p>
                <ul
                    className={cn(
                        'flex flex-col',
                        showEmployee &&
                            'divide-y divide-divider border-t border-divider',
                    )}
                    data-test="password-reset-requests"
                >
                    {requests.map((request) => (
                        <li
                            key={request.id}
                            className={cn(
                                'flex flex-wrap items-center gap-3 py-3',
                                showEmployee && 'px-6 md:px-7',
                            )}
                        >
                            {showEmployee && (
                                <UserAvatar
                                    name={request.employee.name}
                                    src={request.employee.avatar_url}
                                    className="size-10"
                                />
                            )}
                            <div className="flex min-w-0 flex-1 flex-col">
                                {showEmployee &&
                                    (request.employee.id ? (
                                        <Link
                                            href={show(request.employee.id)}
                                            className={cn(
                                                'truncate rounded-sm text-[16px] font-semibold text-text hover:underline',
                                                focusRing,
                                            )}
                                        >
                                            {request.employee.name}
                                        </Link>
                                    ) : (
                                        <span className="truncate text-[16px] font-semibold">
                                            {request.employee.name}
                                        </span>
                                    ))}
                                <span className="text-meta text-text-muted">
                                    Diajukan{' '}
                                    <time
                                        dateTime={request.requested_at}
                                        title={formatDateTime(
                                            request.requested_at,
                                        )}
                                    >
                                        {formatRelative(request.requested_at)}
                                    </time>
                                    {' · '}berlaku sampai{' '}
                                    {formatDateTime(request.expires_at)}
                                </span>
                            </div>
                            <div className="flex w-full gap-2 sm:w-auto">
                                <Button
                                    variant="outline"
                                    className="flex-1 sm:flex-none"
                                    onClick={() => setRejecting(request)}
                                    disabled={approving === request.id}
                                    aria-label={`Tolak permintaan ${request.employee.name}`}
                                >
                                    <X aria-hidden />
                                    Tolak
                                </Button>
                                <Button
                                    className="flex-1 sm:flex-none"
                                    onClick={() => approveRequest(request)}
                                    disabled={approving === request.id}
                                    aria-label={`Setujui permintaan ${request.employee.name}`}
                                    data-test="approve-password-reset"
                                >
                                    <Check aria-hidden />
                                    Setujui
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            </Panel>

            <RejectDialog
                request={rejecting}
                onClose={() => setRejecting(null)}
            />
        </>
    );
}

function RejectDialog({
    request,
    onClose,
}: {
    request: PasswordResetItem | null;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={request !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="sm:max-w-md">
                {request && (
                    <RejectForm
                        key={request.id}
                        request={request}
                        onClose={onClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function RejectForm({
    request,
    onClose,
}: {
    request: PasswordResetItem;
    onClose: () => void;
}) {
    const form = useForm({ reason: '' });

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.post(reject.url(request.id), {
                    preserveScroll: true,
                    onSuccess: onClose,
                });
            }}
            className="space-y-4"
        >
            <DialogHeader>
                <DialogTitle>
                    Tolak permintaan {request.employee.name}?
                </DialogTitle>
                <DialogDescription>
                    Alasan ditampilkan di layar karyawan dan tercatat di audit
                    log.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
                <Label htmlFor="reject-reset-reason">Alasan</Label>
                <Textarea
                    id="reject-reset-reason"
                    value={form.data.reason}
                    onChange={(event) =>
                        form.setData('reason', event.target.value)
                    }
                    placeholder="Mis. tidak bisa dikonfirmasi lewat telepon"
                    maxLength={500}
                    required
                    className="min-h-24"
                    aria-invalid={Boolean(form.errors.reason) || undefined}
                />
                <InputError message={form.errors.reason} />
                <InputError
                    message={(form.errors as Record<string, string>).request}
                />
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Batal
                </Button>
                <Button
                    type="submit"
                    variant="destructive"
                    disabled={form.processing}
                >
                    Tolak permintaan
                </Button>
            </DialogFooter>
        </form>
    );
}
