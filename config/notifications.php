<?php

use App\Domain\Notifications\Digest\Sections\InboxActionSection;
use App\Domain\Requests\Digest\PendingApprovalsSection;

return [

    /*
    |--------------------------------------------------------------------------
    | Default channels per event
    |--------------------------------------------------------------------------
    |
    | Used when a user has no row in `notification_preferences` for an
    | (event, channel) pair. Keys are NotificationEvent values; channels are
    | NotificationChannel values. Events missing here fall back to
    | in_app = on, email = off, whatsapp = off.
    |
    */

    'defaults' => [
        'task.assigned' => ['in_app' => true, 'email' => true, 'whatsapp' => false],
        'mention' => ['in_app' => true, 'email' => true, 'whatsapp' => false],
        'task.commented' => ['in_app' => true, 'email' => false, 'whatsapp' => false],
        'task.due_soon' => ['in_app' => true, 'email' => false, 'whatsapp' => false],
        'task.overdue' => ['in_app' => true, 'email' => true, 'whatsapp' => false],
        'request.pending' => ['in_app' => true, 'email' => true, 'whatsapp' => false],
        'request.decided' => ['in_app' => true, 'email' => true, 'whatsapp' => false],
        'attendance.check_in_reminder' => ['in_app' => true, 'email' => false, 'whatsapp' => false],
        'attendance.check_out_reminder' => ['in_app' => true, 'email' => false, 'whatsapp' => false],
        'project.activity' => ['in_app' => true, 'email' => true, 'whatsapp' => false],
        'system' => ['in_app' => true, 'email' => false, 'whatsapp' => false],
        'digest.daily' => ['email' => true],
    ],

    /*
    |--------------------------------------------------------------------------
    | Channels
    |--------------------------------------------------------------------------
    |
    | WhatsApp is a Phase 2 channel: the interface exists, the provider is not
    | chosen yet. While disabled it never appears in via() and the settings
    | matrix shows it as "Segera hadir".
    |
    */

    'channels' => [
        'whatsapp' => [
            'enabled' => (bool) env('NOTIFICATIONS_WHATSAPP_ENABLED', false),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Inbox retention
    |--------------------------------------------------------------------------
    |
    | `notifications:prune` deletes notifications older than this many days,
    | except ones that still require action and are unresolved.
    |
    */

    'retention_days' => (int) env('NOTIFICATIONS_RETENTION_DAYS', 30),

    /*
    |--------------------------------------------------------------------------
    | Quiet hours (office timezone)
    |--------------------------------------------------------------------------
    |
    | When a user enables quiet hours, email (and WhatsApp) notifications that
    | would be sent outside working hours are delayed until `end` on the next
    | working day. In-app notifications are always recorded immediately.
    |
    */

    'quiet_hours' => [
        'start' => '17:30',
        'end' => '07:00',
        // ISO-8601 weekdays (1 = Monday … 7 = Sunday) that count as working days.
        'workdays' => [1, 2, 3, 4, 5],
    ],

    /*
    |--------------------------------------------------------------------------
    | Daily digest
    |--------------------------------------------------------------------------
    |
    | Sent once per working day at each user's preferred time (office
    | timezone). `sections` lists DigestSection providers in display order;
    | modules append their own class here (one line each). A digest whose
    | sections are all empty is never sent.
    |
    */

    'digest' => [
        'default_time' => '07:30',
        // A digest is still sent when the scheduler runs up to this many minutes late.
        'catch_up_minutes' => 60,
        'workdays' => [1, 2, 3, 4, 5],
        'sections' => [
            PendingApprovalsSection::class,
            InboxActionSection::class,
        ],
    ],

];
