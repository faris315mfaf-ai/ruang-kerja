import { registerNotificationDetail } from '@/features/notifications/detail-renderers';
import { TaskNotificationPreview } from './detail/task-notification-preview';

/** Task notifications (task.*, mention) get the rich task preview in the Inbox. */
registerNotificationDetail('task.', TaskNotificationPreview);
registerNotificationDetail('mention', TaskNotificationPreview);
