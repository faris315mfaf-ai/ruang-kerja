import { describe, expect, it } from 'vite-plus/test';
import {
    notificationDetailRenderer,
    registerNotificationDetail,
} from './detail-renderers';

const TaskPreview = () => null;
const OverduePreview = () => null;

describe('notification detail renderers', () => {
    it('resolves exact types and prefixes, longest key first', () => {
        registerNotificationDetail('task.', TaskPreview);
        registerNotificationDetail('task.overdue', OverduePreview);
        registerNotificationDetail('mention', TaskPreview);

        expect(notificationDetailRenderer('task.assigned')).toBe(TaskPreview);
        expect(notificationDetailRenderer('task.overdue')).toBe(OverduePreview);
        expect(notificationDetailRenderer('mention')).toBe(TaskPreview);
        expect(notificationDetailRenderer('mentions')).toBeNull();
        expect(notificationDetailRenderer('request.submitted')).toBeNull();
    });
});
