import { CheckCheck, ExternalLink, Moon, ServerCog } from 'lucide-react';
import { useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
    boldSegments,
    displayClock,
    renderTemplate,
} from '@/features/automation/helpers';
import type { WhatsappSettings } from '@/features/automation/types';
import type { WhatsappState } from '@/features/automation/whatsapp/use-whatsapp';
import { cn } from '@/lib/utils';

const TIMES = Array.from({ length: 48 }, (_, index) => {
    const h = String(Math.floor(index / 2)).padStart(2, '0');

    return `${h}:${index % 2 === 0 ? '00' : '30'}`;
});

/** Half-hour picker showing the Indonesian clock ("21.00"), not the browser locale. */
function TimeInput({
    label,
    value,
    onCommit,
    disabled,
}: {
    label: string;
    value: string;
    onCommit: (value: string) => void;
    disabled?: boolean;
}) {
    const id = useId();

    return (
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Select value={value} onValueChange={onCommit} disabled={disabled}>
                <SelectTrigger
                    id={id}
                    className="h-12 w-full font-mono text-[17px] font-semibold tnum md:h-11 md:text-[16px]"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                    {TIMES.map((time) => (
                        <SelectItem
                            key={time}
                            value={time}
                            className="font-mono tnum"
                        >
                            {displayClock(time)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

/** Jam tenang (MFondasi "Notifikasi & getar": 21.00–06.00, high priority only). */
export function QuietHoursCard({ wa }: { wa: WhatsappState }) {
    const quiet = wa.settings.quiet_hours;
    const id = useId();

    return (
        <Panel
            title={
                <>
                    <Moon
                        aria-hidden
                        className="size-5 text-text-muted"
                        strokeWidth={2}
                    />
                    Jam tenang
                </>
            }
            action={
                <span className="text-[15px] text-text-muted tnum">
                    {quiet.enabled
                        ? `${displayClock(quiet.start)}–${displayClock(quiet.end)}`
                        : 'Mati'}
                </span>
            }
            bodyClassName="gap-4"
        >
            <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                    <p
                        id={`${id}-t`}
                        className="text-body font-semibold text-text"
                    >
                        Tahan pesan di malam hari
                    </p>
                    <p
                        id={`${id}-d`}
                        className="text-label font-normal text-text-muted"
                    >
                        Pesan ditahan lalu dikirim saat jam tenang berakhir.
                    </p>
                </div>
                <Switch
                    size="md"
                    checked={quiet.enabled}
                    aria-labelledby={`${id}-t`}
                    aria-describedby={`${id}-d`}
                    onCheckedChange={(enabled) => wa.setQuietHours({ enabled })}
                />
            </div>
            <div className="flex gap-3">
                <TimeInput
                    label="Mulai"
                    value={quiet.start}
                    disabled={!quiet.enabled}
                    onCommit={(start) => wa.setQuietHours({ start })}
                />
                <TimeInput
                    label="Selesai"
                    value={quiet.end}
                    disabled={!quiet.enabled}
                    onCommit={(end) => wa.setQuietHours({ end })}
                />
            </div>
            <div className="flex items-start gap-4 border-t border-divider pt-4">
                <div className="min-w-0 flex-1">
                    <p
                        id={`${id}-p`}
                        className="text-body font-semibold text-text"
                    >
                        Prioritas tinggi tetap dikirim
                    </p>
                    <p className="text-label font-normal text-text-muted">
                        Pengingat check-in, persetujuan masuk, tugas lewat
                        tenggat.
                    </p>
                </div>
                <Switch
                    size="md"
                    checked={quiet.allow_high_priority}
                    disabled={!quiet.enabled}
                    aria-labelledby={`${id}-p`}
                    onCheckedChange={(allow) =>
                        wa.setQuietHours({ allow_high_priority: allow })
                    }
                />
            </div>
        </Panel>
    );
}

/**
 * Message preview: Indonesian provider template rendered as a chat bubble,
 * with a toggle to show the raw {{n}} placeholders.
 */
export function TemplatePreviewCard({
    templates,
}: {
    templates: WhatsappSettings['templates'];
}) {
    const [event, setEvent] = useState<string>(templates[0]?.event ?? '');
    const [raw, setRaw] = useState(false);
    const selectId = useId();
    const rawId = useId();
    const template = templates.find((t) => t.event === event) ?? templates[0];

    if (!template) {
        return null;
    }

    const text = raw
        ? template.body
        : renderTemplate(template.body, template.sample);
    const label = (key: string) =>
        ({
            'task.assigned': 'Ditugaskan tugas baru',
            'task.due_soon': 'Tenggat H-1',
            'request.pending': 'Pengajuan menunggu persetujuan',
            'request.decided': 'Status pengajuan saya',
            'attendance.check_in_reminder': 'Pengingat check-in',
        })[key] ?? key;

    return (
        <Panel title="Pratinjau pesan" bodyClassName="gap-4">
            <div className="flex flex-col gap-1.5">
                <Label htmlFor={selectId}>Kejadian</Label>
                <Select value={template.event} onValueChange={setEvent}>
                    <SelectTrigger
                        id={selectId}
                        className="h-12 w-full text-[17px] md:h-11 md:text-[16px]"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {templates.map((t) => (
                            <SelectItem key={t.event} value={t.event}>
                                {label(t.event)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <figure className="m-0 flex flex-col gap-2 rounded-[18px] bg-surface-2 p-4">
                <figcaption className="text-meta font-semibold text-text-muted">
                    RuangKerja · akun bisnis
                </figcaption>
                <div className="max-w-[320px] rounded-[16px] rounded-tl-[4px] bg-surface shadow-card">
                    <p className="px-3.5 pt-3 text-[15px] leading-[22px] whitespace-pre-line text-text">
                        {boldSegments(text).map((segment, index) =>
                            segment.bold ? (
                                <strong key={index} className="font-bold">
                                    {segment.text}
                                </strong>
                            ) : (
                                <span key={index}>{segment.text}</span>
                            ),
                        )}
                    </p>
                    <p className="flex items-center justify-end gap-1 px-3.5 pt-1 pb-2 text-[12px] text-text-muted tnum">
                        08.02
                        <CheckCheck
                            aria-label="Terkirim"
                            className="size-4 text-accent-blue-strong"
                        />
                    </p>
                    {template.button && (
                        <p className="flex items-center justify-center gap-1.5 border-t border-divider py-2.5 text-[15px] font-semibold text-link">
                            <ExternalLink aria-hidden className="size-4" />
                            {template.button}
                        </p>
                    )}
                </div>
            </figure>

            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <p id={rawId} className="text-label text-text">
                        Tampilkan variabel
                    </p>
                    <p className="truncate font-mono text-meta text-text-muted">
                        {template.name} · id
                    </p>
                </div>
                <Switch
                    checked={raw}
                    onCheckedChange={setRaw}
                    aria-labelledby={rawId}
                    size="md"
                />
            </div>
        </Panel>
    );
}

/** Admin info: the provider is still undecided (PRD M6, open question 2). */
export function ProviderCard({
    provider,
}: {
    provider: WhatsappSettings['provider'];
}) {
    const rows: [string, string][] = [
        [
            'Penyedia',
            provider.name ?? 'Belum dipilih (Meta Cloud API / gateway)',
        ],
        ['Nomor pengirim', provider.sender ?? 'Belum ada'],
        ['Template pesan', provider.name ? 'Disetujui' : 'Menunggu penyedia'],
        [
            'Batas kirim harian',
            provider.daily_limit ? `${provider.daily_limit}` : '–',
        ],
    ];

    return (
        <Panel
            title={
                <>
                    <ServerCog
                        aria-hidden
                        className="size-5 text-text-muted"
                        strokeWidth={2}
                    />
                    Layanan WhatsApp
                </>
            }
            action={<Badge variant="label">Info admin</Badge>}
            bodyClassName="gap-3"
        >
            <dl className="divide-y divide-divider">
                {rows.map(([term, value]) => (
                    <div
                        key={term}
                        className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2.5"
                    >
                        <dt className="text-label font-normal text-text-muted">
                            {term}
                        </dt>
                        <dd
                            className={cn(
                                'text-label text-text',
                                value.startsWith('Belum') && 'text-warning',
                            )}
                        >
                            {value}
                        </dd>
                    </div>
                ))}
            </dl>
            <p className="text-meta text-text-muted">
                Pilihan penyedia ditunda ke keputusan pemilik produk. Pesan baru
                benar-benar terkirim setelah Super Admin menghubungkan penyedia
                di Pengaturan sistem.
            </p>
        </Panel>
    );
}
