import { ApiError, requestJson } from '@/features/tasks/lib/api';
import meetingRoutes from '@/routes/meetings';
import itemRoutes from '@/routes/meetings/items';
import minutesRoutes from '@/routes/meetings/minutes';
import type {
    ActionItem,
    AttendanceMark,
    Conflict,
    Minutes,
    MinutesSection,
    Rsvp,
} from './types';

type MinutesResponse = { minutes: Minutes };

/** `?tanggal=` of an occurrence of a series (null for a single meeting). */
function query(date: string | null) {
    return date ? { query: { tanggal: date } } : undefined;
}

/** JSON endpoints of routes/meetings.php (MeetingController, MinutesController). */
export const meetingsApi = {
    rsvp: (meetingId: string, rsvp: Exclude<Rsvp, 'pending'>) =>
        requestJson<{ rsvp: Rsvp }>(meetingRoutes.rsvp(meetingId), { rsvp }),

    conflicts: (params: {
        participants: string[];
        date: string;
        start: string;
        duration: number;
        ignore?: string | null;
    }) =>
        requestJson<{ conflicts: Conflict[]; suggestion: string | null }>(
            meetingRoutes.conflicts({
                query: {
                    peserta: params.participants,
                    tanggal: params.date,
                    mulai: params.start,
                    durasi: params.duration,
                    ...(params.ignore ? { abaikan: params.ignore } : {}),
                },
            }),
        ),

    saveMinutes: (
        meetingId: string,
        date: string | null,
        content: {
            attendance: AttendanceMark[];
            sections: MinutesSection[];
            decisions: string[];
        },
    ) =>
        requestJson<MinutesResponse>(
            minutesRoutes.save(meetingId, query(date)),
            content,
        ),

    finalize: (meetingId: string, date: string | null) =>
        requestJson<MinutesResponse>(
            minutesRoutes.finalize(meetingId, query(date)),
        ),

    reopen: (meetingId: string, date: string | null) =>
        requestJson<MinutesResponse>(
            minutesRoutes.reopen(meetingId, query(date)),
        ),

    makeTasks: (
        meetingId: string,
        date: string | null,
        itemIds: string[],
        workspaceId: string | null,
    ) =>
        requestJson<MinutesResponse & { created: number }>(
            minutesRoutes.tasks(meetingId, query(date)),
            {
                item_ids: itemIds,
                ...(workspaceId ? { workspace_id: workspaceId } : {}),
            },
        ),

    remind: (meetingId: string, date: string | null) =>
        requestJson<{ reminded: string[] }>(
            minutesRoutes.remind(meetingId, query(date)),
        ),

    addItem: (
        meetingId: string,
        date: string | null,
        item: Pick<ActionItem, 'text' | 'assignee_id' | 'due_date'>,
    ) =>
        requestJson<{ item: ActionItem }>(
            itemRoutes.store(meetingId, query(date)),
            item,
        ),

    updateItem: (
        meetingId: string,
        itemId: string,
        changes: Partial<
            Pick<ActionItem, 'text' | 'assignee_id' | 'due_date' | 'done'>
        >,
    ) =>
        requestJson<{ item: ActionItem }>(
            itemRoutes.update({ meeting: meetingId, item: itemId }),
            changes,
        ),

    removeItem: (meetingId: string, itemId: string) =>
        requestJson<{ deleted: boolean }>(
            itemRoutes.destroy({ meeting: meetingId, item: itemId }),
        ),
};

/** Message for a failed meeting request (first validation error first). */
export function errorMessage(error: unknown, fallback: string): string {
    if (error instanceof ApiError) {
        if (error.status === 403) {
            return 'Anda tidak punya akses untuk melakukan ini.';
        }

        if (error.status === 404) {
            return 'Rapat tidak ditemukan.';
        }

        return error.message;
    }

    return fallback;
}

/** All validation messages of one field (e.g. every "minutes" problem). */
export function fieldErrors(error: unknown, field: string): string[] {
    return error instanceof ApiError ? (error.errors[field] ?? []) : [];
}
