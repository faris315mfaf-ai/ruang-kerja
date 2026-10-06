import { CheckCircle2, MessageCircle, Send, Smartphone } from 'lucide-react';
import { useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import { DEMO_OTP } from '@/features/automation/fixtures';
import { formatPhone, normalizePhone } from '@/features/automation/phone';
import type { WhatsappState } from '@/features/automation/whatsapp/use-whatsapp';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS = {
    disconnected: { label: 'Belum terhubung', tone: 'neutral' },
    verifying: { label: 'Menunggu verifikasi', tone: 'warning' },
    connected: { label: 'Terhubung', tone: 'success' },
} as const;

/**
 * "Kanal WhatsApp": the connect flow — number (08xx/+62, validated and
 * normalized) → 6-digit code → connected, plus test message and disconnect.
 */
export function ConnectionCard({ wa }: { wa: WhatsappState }) {
    const { status } = wa.settings;
    const badge = STATUS[status];

    return (
        <Panel
            title={
                <>
                    <span
                        aria-hidden
                        className="flex size-10 items-center justify-center rounded-[12px] bg-success-soft text-success"
                    >
                        <MessageCircle className="size-5" strokeWidth={2} />
                    </span>
                    Kanal WhatsApp
                </>
            }
            action={
                <Badge variant="status" tone={badge.tone} dot>
                    {badge.label}
                </Badge>
            }
            bodyClassName="gap-4"
        >
            {status === 'disconnected' && <PhoneStep wa={wa} />}
            {status === 'verifying' && <OtpStep wa={wa} />}
            {status === 'connected' && <ConnectedStep wa={wa} />}
        </Panel>
    );
}

function PhoneStep({ wa }: { wa: WhatsappState }) {
    const id = useId();
    const preview = normalizePhone(wa.phoneInput);

    return (
        <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(event) => {
                event.preventDefault();
                void wa.submitPhone();
            }}
        >
            <p className="text-[15px] leading-[22px] text-text-muted md:text-body">
                Terima pengingat dan persetujuan penting di WhatsApp. Kami
                mengirim kode 6 digit untuk memastikan nomor ini milik Anda.
            </p>
            <div className="flex flex-col gap-2">
                <Label htmlFor={id}>Nomor WhatsApp</Label>
                <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative min-w-0 flex-1">
                        <Smartphone
                            aria-hidden
                            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-text-subtle"
                        />
                        <Input
                            id={id}
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="0812-3456-7890"
                            value={wa.phoneInput}
                            onChange={(event) =>
                                wa.setPhoneInput(event.target.value)
                            }
                            aria-invalid={wa.phoneError ? true : undefined}
                            aria-describedby={`${id}-hint`}
                            className="h-12 pl-11 text-[17px] md:h-11 md:text-[16px]"
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={wa.sendingCode}
                        className="h-12 md:h-11"
                    >
                        <Send aria-hidden />
                        {wa.sendingCode ? 'Mengirim…' : 'Kirim kode'}
                    </Button>
                </div>
                <p
                    id={`${id}-hint`}
                    role={wa.phoneError ? 'alert' : undefined}
                    className={cn(
                        'text-meta',
                        wa.phoneError
                            ? 'font-semibold text-danger'
                            : 'text-text-muted',
                    )}
                >
                    {wa.phoneError ??
                        (preview.ok
                            ? `Kode dikirim ke ${preview.display}`
                            : 'Format 08xx atau +62 8xx. Hanya nomor Indonesia.')}
                </p>
            </div>
        </form>
    );
}

function OtpStep({ wa }: { wa: WhatsappState }) {
    const id = useId();

    return (
        <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
                event.preventDefault();
                void wa.verify();
            }}
        >
            <p className="text-[15px] leading-[22px] text-text-muted md:text-body">
                Masukkan kode 6 digit yang kami kirim ke{' '}
                <strong className="font-semibold text-text tnum">
                    {wa.pendingPhoneDisplay}
                </strong>
                .
            </p>
            <div className="flex flex-col gap-2">
                <Label htmlFor={id}>Kode verifikasi</Label>
                <InputOTP
                    id={id}
                    maxLength={6}
                    autoFocus
                    value={wa.otp}
                    onChange={wa.setOtp}
                    inputMode="numeric"
                    pattern="^[0-9]*$"
                    autoComplete="one-time-code"
                    disabled={wa.locked}
                    aria-invalid={wa.otpError ? true : undefined}
                    aria-describedby={`${id}-hint`}
                    onComplete={() => void wa.verify()}
                >
                    <InputOTPGroup>
                        {Array.from({ length: 6 }, (_, index) => (
                            <InputOTPSlot key={index} index={index} />
                        ))}
                    </InputOTPGroup>
                </InputOTP>
                <p
                    id={`${id}-hint`}
                    role={wa.otpError ? 'alert' : undefined}
                    className={cn(
                        'text-meta',
                        wa.otpError
                            ? 'font-semibold text-danger'
                            : 'text-text-muted',
                    )}
                >
                    {wa.otpError ?? (
                        <>
                            Pratinjau: kode yang diterima{' '}
                            <span className="font-mono font-semibold text-text">
                                {DEMO_OTP}
                            </span>
                            . Kode lain dianggap salah.
                        </>
                    )}
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <Button
                    type="submit"
                    disabled={
                        wa.otp.length !== 6 || wa.locked || wa.verifyingCode
                    }
                    className="h-12 md:h-11"
                >
                    <CheckCircle2 aria-hidden />
                    {wa.verifyingCode ? 'Memeriksa…' : 'Verifikasi'}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    disabled={wa.resendIn > 0 || wa.sendingCode}
                    onClick={() => void wa.resend()}
                    className="h-12 tnum md:h-11"
                >
                    {wa.resendIn > 0
                        ? `Kirim ulang (${String(Math.floor(wa.resendIn / 60)).padStart(2, '0')}.${String(wa.resendIn % 60).padStart(2, '0')})`
                        : 'Kirim ulang kode'}
                </Button>
                <Button
                    type="button"
                    variant="quiet"
                    onClick={wa.changeNumber}
                    className="h-12 md:h-11"
                >
                    Ganti nomor
                </Button>
            </div>
        </form>
    );
}

function ConnectedStep({ wa }: { wa: WhatsappState }) {
    const [confirm, setConfirm] = useState(false);
    const { phone, connected_at: connectedAt } = wa.settings;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 rounded-lg bg-success-soft px-4 py-3.5">
                <p className="text-body font-bold text-success tnum">
                    {phone ? formatPhone(phone) : '–'}
                </p>
                <p className="text-[15px] leading-[22px] text-text">
                    Terhubung {connectedAt ? formatDateTime(connectedAt) : ''}.
                    Pesan dikirim sesuai pilihan kejadian di bawah dan jam
                    tenang.
                </p>
            </div>
            <div className="flex flex-wrap gap-3">
                <Button
                    variant="outline"
                    onClick={() => void wa.sendTest()}
                    disabled={wa.sendingCode}
                    className="h-12 md:h-11"
                >
                    <Send aria-hidden />
                    Kirim pesan uji
                </Button>
                <Button
                    variant="outline"
                    className="h-12 text-danger md:h-11"
                    onClick={() => setConfirm(true)}
                >
                    Putuskan sambungan
                </Button>
            </div>

            <Dialog open={confirm} onOpenChange={setConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Putuskan WhatsApp?</DialogTitle>
                        <DialogDescription>
                            Tidak ada pesan WhatsApp yang dikirim lagi.
                            Notifikasi tetap masuk lewat aplikasi dan email.
                            Anda bisa menghubungkan nomor lagi kapan saja.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="quiet">Batal</Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            disabled={wa.disconnecting}
                            onClick={async () => {
                                await wa.disconnect();
                                setConfirm(false);
                            }}
                        >
                            {wa.disconnecting ? 'Memutuskan…' : 'Putuskan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
