import { router } from '@inertiajs/react';
import { CalendarClock } from 'lucide-react';
import { useId, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import { Spinner } from '@/components/ui/spinner';
import { formatDate, formatTime } from '@/lib/format';
import { interview as interviewRoute } from '@/routes/hiring/candidates';
import type { CandidateInterview } from './types';

/** "2026-10-20 10:30" → ["2026-10-20", "10:30"]. */
export function splitLocal(local: string | null): [string, string] {
    if (!local) {
        return ['', ''];
    }

    const [date = '', time = ''] = local.split(/[ T]/);

    return [date, time.slice(0, 5)];
}

/** Body of PUT /hiring/kandidat/{id}/wawancara (empty date clears it). */
export function interviewPayload(
    date: string,
    time: string,
    location: string,
): { interview_at: string | null; interview_location: string | null } {
    return {
        interview_at:
            date === '' ? null : `${date} ${time === '' ? '09:00' : time}`,
        interview_location: location.trim() === '' ? null : location.trim(),
    };
}

/**
 * "Jadwal wawancara" on the candidate profile (Ruang HR › Jadwal shows it).
 * HR / Super Admin set, move or clear it; others read it.
 */
export function InterviewScheduleCard({
    candidateId,
    interview,
}: {
    candidateId: string;
    interview: CandidateInterview;
}) {
    const ids = useId();
    const [initialDate, initialTime] = splitLocal(interview.local);
    const [date, setDate] = useState(initialDate);
    const [time, setTime] = useState(initialTime);
    const [location, setLocation] = useState(interview.location ?? '');
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const save = (clear = false) =>
        router.put(
            interviewRoute.url(candidateId),
            clear
                ? { interview_at: null, interview_location: null }
                : interviewPayload(date, time, location),
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onError: (errors) =>
                    setError(
                        errors.interview_at ??
                            errors.interview_location ??
                            'Jadwal gagal disimpan.',
                    ),
                onSuccess: () => {
                    setError(null);

                    if (clear) {
                        setDate('');
                        setTime('');
                        setLocation('');
                    }
                },
            },
        );

    const summary = interview.at
        ? `${formatDate(interview.at)} · ${formatTime(interview.at)}${interview.location ? ` · ${interview.location}` : ''}`
        : 'Belum dijadwalkan';

    if (!interview.can_schedule) {
        return (
            <Panel title="Jadwal wawancara">
                <p className="flex items-center gap-2.5 text-[16px]">
                    <CalendarClock
                        aria-hidden
                        className="size-5 shrink-0 text-text-muted"
                    />
                    <span
                        className={
                            interview.at ? 'font-semibold' : 'text-text-muted'
                        }
                    >
                        {summary}
                    </span>
                </p>
            </Panel>
        );
    }

    return (
        <Panel title="Jadwal wawancara">
            <form
                noValidate
                className="flex flex-col gap-3.5"
                onSubmit={(event) => {
                    event.preventDefault();
                    save();
                }}
            >
                <p className="text-meta text-text-muted">
                    {interview.at
                        ? `Terjadwal: ${summary}`
                        : 'Belum dijadwalkan. Jadwal tampil di Ruang HR › Jadwal.'}
                </p>
                <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <Label htmlFor={`${ids}-date`}>Tanggal</Label>
                        <DateInput
                            id={`${ids}-date`}
                            value={date}
                            onChange={setDate}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`${ids}-time`}>Jam</Label>
                        <Input
                            id={`${ids}-time`}
                            type="time"
                            value={time}
                            onChange={(event) => setTime(event.target.value)}
                            aria-invalid={error ? true : undefined}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${ids}-location`}>Tempat</Label>
                    <Input
                        id={`${ids}-location`}
                        value={location}
                        maxLength={200}
                        placeholder="Ruang Rapat 2 / tautan rapat"
                        onChange={(event) => setLocation(event.target.value)}
                    />
                </div>
                <InputError message={error ?? undefined} role="alert" />
                <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={processing || date === ''}>
                        {processing && <Spinner />}
                        Simpan jadwal
                    </Button>
                    {interview.at && (
                        <Button
                            type="button"
                            variant="quiet"
                            disabled={processing}
                            onClick={() => save(true)}
                        >
                            Hapus jadwal
                        </Button>
                    )}
                </div>
            </form>
        </Panel>
    );
}
