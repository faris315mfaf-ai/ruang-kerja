import { MessageSquareText } from 'lucide-react';
import { useCallback, useId, useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { EmptyState } from '@/components/empty-state';
import { Panel } from '@/components/ui/panel';
import { Textarea } from '@/components/ui/textarea';
import { requestJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import { formatScore, hiringUrls, scoreTotal } from './lib';
import type { CandidateProfileProps, InterviewQuestion } from './types';
import { autosaveLabel, useAutosave } from './use-autosave';

function SaveStatus({
    status,
}: {
    status: Parameters<typeof autosaveLabel>[0];
}) {
    const label = autosaveLabel(status);

    return (
        <p
            aria-live="polite"
            className={cn(
                'min-h-5 text-meta',
                status === 'error' ? 'text-danger' : 'text-text-muted',
            )}
        >
            {label}
        </p>
    );
}

/** "Jawaban kandidat": typed by HR during the interview, autosaved. */
function AnswerField({
    candidateId,
    question,
    editable,
}: {
    candidateId: string;
    question: InterviewQuestion;
    editable: boolean;
}) {
    const id = useId();
    const [value, setValue] = useState(question.answer ?? '');
    const save = useCallback(
        (answer: string) =>
            requestJson(hiringUrls.answer(candidateId, question.id), {
                method: 'PUT',
                body: { answer },
            }),
        [candidateId, question.id],
    );
    const autosave = useAutosave(save);

    if (!editable) {
        return (
            <div className="flex flex-col gap-1.5">
                <p className="text-meta font-semibold text-text-muted">
                    Jawaban kandidat
                </p>
                <p className="text-body break-words whitespace-pre-wrap text-text">
                    {question.answer ?? (
                        <span className="text-text-muted">
                            Belum dicatat HR.
                        </span>
                    )}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-label text-text">
                Jawaban kandidat
            </label>
            <Textarea
                id={id}
                value={value}
                maxLength={20000}
                placeholder="Catat jawaban kandidat selama wawancara"
                onChange={(event) => {
                    setValue(event.target.value);
                    autosave.schedule(event.target.value);
                }}
                onBlur={autosave.flush}
            />
            <SaveStatus status={autosave.status} />
        </div>
    );
}

/** The signed-in interviewer's own points (1..max) and note. */
function MyScore({
    candidateId,
    question,
}: {
    candidateId: string;
    question: InterviewQuestion;
}) {
    const noteId = useId();
    const [score, setScore] = useState<number | null>(
        question.my_score?.score ?? null,
    );
    const [note, setNote] = useState(question.my_score?.note ?? '');
    const send = useCallback(
        (next: { score: number | null; note: string }) =>
            requestJson(hiringUrls.score(candidateId, question.id), {
                method: 'PUT',
                body: { score: next.score, note: next.note },
            }),
        [candidateId, question.id],
    );
    const autosave = useAutosave(send);

    const pick = (next: number) => {
        // Picking the selected value again clears the points (and the note).
        const value = score === next ? null : next;
        const nextNote = value === null ? '' : note;

        setScore(value);
        setNote(nextNote);
        // Points are saved right away (replacing a pending note save), the note debounced.
        autosave.schedule({ score: value, note: nextNote });
        autosave.flush();
    };

    return (
        <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface-2/60 p-4">
            <p id={`${noteId}-label`} className="text-label text-text">
                Poin saya
            </p>
            <div
                role="radiogroup"
                aria-labelledby={`${noteId}-label`}
                className="flex flex-wrap gap-2"
            >
                {Array.from(
                    { length: question.max_score },
                    (_, index) => index + 1,
                ).map((value) => (
                    <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={score === value}
                        aria-label={`${value} dari ${question.max_score}`}
                        onClick={() => pick(value)}
                        className={cn(
                            'flex size-11 items-center justify-center rounded-control border text-[16px] font-bold tnum transition-colors duration-120 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                            score === value
                                ? 'border-transparent bg-primary bg-grad-aksi text-on-brand'
                                : 'border-border-strong bg-surface text-text hover:bg-surface-2',
                        )}
                    >
                        {value}
                    </button>
                ))}
            </div>
            <label htmlFor={noteId} className="sr-only">
                Catatan poin
            </label>
            <Textarea
                id={noteId}
                value={note}
                maxLength={5000}
                disabled={score === null}
                placeholder={
                    score === null
                        ? 'Pilih poin dulu untuk menulis catatan'
                        : 'Catatan untuk poin ini (opsional)'
                }
                className="min-h-16"
                onChange={(event) => {
                    setNote(event.target.value);
                    autosave.schedule({ score, note: event.target.value });
                }}
                onBlur={autosave.flush}
            />
            <SaveStatus status={autosave.status} />
        </div>
    );
}

/** Every interviewer's points (HR & final approvers only). */
function AllScores({ question }: { question: InterviewQuestion }) {
    if (question.scores === null) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2">
            <p className="flex items-baseline justify-between gap-3 text-label text-text">
                Poin pewawancara
                <span className="text-meta font-semibold text-text-muted tnum">
                    {question.average !== null
                        ? `Rata-rata ${formatScore(question.average)} / ${question.max_score}`
                        : 'Belum ada poin'}
                </span>
            </p>
            {question.scores.length > 0 && (
                <ul className="flex flex-col divide-y divide-divider rounded-lg border border-border">
                    {question.scores.map((entry, index) => (
                        <li
                            key={entry.interviewer?.id ?? index}
                            className="flex items-start gap-3 px-4 py-3"
                        >
                            <UserAvatar
                                name={entry.interviewer?.name ?? 'Pewawancara'}
                                src={entry.interviewer?.avatar}
                                className="size-8"
                            />
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="flex items-baseline justify-between gap-3">
                                    <span className="truncate text-[15px] font-semibold text-text">
                                        {entry.interviewer?.name ??
                                            'Pewawancara'}
                                    </span>
                                    <span className="text-[15px] font-bold text-text tnum">
                                        {entry.score}/{question.max_score}
                                    </span>
                                </span>
                                {entry.note && (
                                    <span className="text-meta break-words whitespace-pre-wrap text-text-muted">
                                        {entry.note}
                                    </span>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/**
 * Tab Wawancara: the position's questions in order. HR types the
 * candidate's answers; each interviewer gives their own points; HR and the
 * final approvers see everyone's points, the average and the total.
 */
export function InterviewTab({
    candidate,
    questions,
    can,
}: Pick<CandidateProfileProps, 'candidate' | 'questions' | 'can'>) {
    const total = can.see_all_scores ? scoreTotal(questions) : null;

    if (questions.length === 0) {
        return (
            <EmptyState
                icon={MessageSquareText}
                title="Belum ada pertanyaan wawancara"
                description={
                    can.manage
                        ? 'Siapkan pertanyaan di pengaturan lowongan.'
                        : 'HR belum menyiapkan pertanyaan untuk lowongan ini.'
                }
            />
        );
    }

    return (
        <div className="flex flex-col gap-5">
            {can.see_all_scores && (
                <p className="rounded-lg border border-border bg-surface px-5 py-4 text-body text-text">
                    Total poin:{' '}
                    <b className="tnum">
                        {total
                            ? `${formatScore(total.total)} dari ${total.max}`
                            : 'belum ada'}
                    </b>
                    {total && total.scored < questions.length && (
                        <span className="text-text-muted">
                            {' '}
                            ({total.scored} dari {questions.length} pertanyaan
                            sudah diberi poin)
                        </span>
                    )}
                </p>
            )}
            <ol className="flex flex-col gap-5">
                {questions.map((question, index) => (
                    <li key={question.id}>
                        <Panel
                            title={
                                <span className="flex items-start gap-3">
                                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[15px] font-bold text-text-muted tnum">
                                        {index + 1}
                                    </span>
                                    <span className="text-[18px] leading-7 font-bold md:text-[19px]">
                                        {question.prompt}
                                    </span>
                                </span>
                            }
                            bodyClassName="gap-4"
                        >
                            {question.guidance && (
                                <p className="text-meta text-text-muted">
                                    Panduan: {question.guidance}
                                </p>
                            )}
                            <AnswerField
                                candidateId={candidate.id}
                                question={question}
                                editable={can.manage}
                            />
                            {can.score && (
                                <MyScore
                                    candidateId={candidate.id}
                                    question={question}
                                />
                            )}
                            <AllScores question={question} />
                        </Panel>
                    </li>
                ))}
            </ol>
        </div>
    );
}
