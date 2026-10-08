<?php

namespace App\Domain\Notifications\Enums;

/**
 * Groups events in the settings matrix and the Inbox filter.
 */
enum NotificationCategory: string
{
    case Task = 'task';
    case Request = 'request';
    case Attendance = 'attendance';
    case System = 'system';
    case Info = 'info';

    public function label(): string
    {
        return match ($this) {
            self::Task => 'Tugas',
            self::Request => 'Pengajuan',
            self::Attendance => 'Absensi',
            self::System => 'Sistem',
            self::Info => 'Informatif',
        };
    }

    /**
     * @return list<NotificationType>
     */
    public function types(): array
    {
        return array_values(array_filter(
            NotificationType::cases(),
            fn (NotificationType $type): bool => $type->category() === $this,
        ));
    }
}
