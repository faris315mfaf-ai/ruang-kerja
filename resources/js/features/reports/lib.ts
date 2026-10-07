import { formatTime } from '@/lib/format';
import type {
    DailyReportData,
    ReportFormItem,
    ReportFormState,
    ReportStatus,
    TaskCategory,
} from './types';

let counter = 0;

/** Stable client key of a new form row. */
export function newRowKey(): string {
    counter += 1;

    return `row-${Date.now().toString(36)}-${counter}`;
}

export function emptyRow(taskId: string | null = null): ReportFormItem {
    return {
        key: newRowKey(),
        task_id: taskId,
        progress_note: '',
        percent: '',
        hours: '',
        move_status_id: '',
    };
}

/** Form state from the stored report. */
export function formFromReport(report: DailyReportData): ReportFormState {
    return {
        summary: report.summary ?? '',
        blockers: report.blockers ?? '',
        notes: report.notes ?? '',
        items: report.items.map((item) => ({
            key: item.id,
            task_id: item.task_id,
            progress_note: item.progress_note,
            percent: item.percent === null ? '' : String(item.percent),
            hours: item.hours === null ? '' : String(item.hours),
            move_status_id: item.move_status_id ?? '',
        })),
    };
}

const numberOrNull = (value: string): number | null => {
    const trimmed = value.trim().replace(',', '.');

    return trimmed === '' || Number.isNaN(Number(trimmed))
        ? null
        : Number(trimmed);
};

/** Request body of PUT /laporan/hari-ini and POST /laporan/hari-ini/kirim. */
export function reportPayload(date: string, state: ReportFormState) {
    return {
        report_date: date,
        summary: state.summary,
        blockers: state.blockers,
        notes: state.notes,
        items: state.items.map((item) => ({
            task_id: item.task_id,
            progress_note: item.progress_note,
            percent: numberOrNull(item.percent),
            hours: numberOrNull(item.hours),
            move_status_id: item.task_id ? item.move_status_id || null : null,
        })),
    };
}

/** Problems that block "Kirim" (the server checks again). */
export function submitProblems(state: ReportFormState): string[] {
    const problems: string[] = [];

    if (state.items.length === 0) {
        problems.push(
            'Tambahkan minimal satu pekerjaan yang Anda kerjakan hari ini.',
        );
    }

    if (state.items.some((item) => item.progress_note.trim() === '')) {
        problems.push('Setiap pekerjaan butuh catatan progres.');
    }

    return problems;
}

export const STATUS_LABELS: Record<ReportStatus, string> = {
    missing: 'Belum lapor',
    draft: 'Draf',
    submitted: 'Terkirim',
};

export const STATUS_TONES: Record<
    ReportStatus,
    'warning' | 'info' | 'success'
> = {
    missing: 'warning',
    draft: 'info',
    submitted: 'success',
};

/** "Belum lapor" · "Draf" · "Terkirim pukul 16.05". */
export function statusText(
    status: ReportStatus,
    submittedAt: string | null,
): string {
    return status === 'submitted' && submittedAt
        ? `Terkirim pukul ${formatTime(submittedAt)}`
        : STATUS_LABELS[status];
}

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
    backlog: 'Backlog',
    todo: 'Akan dikerjakan',
    in_progress: 'Sedang dikerjakan',
    review: 'Ditinjau',
    done: 'Selesai',
    canceled: 'Dibatalkan',
};

/** "2,5 jam". */
export function hoursText(hours: number | null): string | null {
    if (hours === null) {
        return null;
    }

    return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(hours)} jam`;
}
