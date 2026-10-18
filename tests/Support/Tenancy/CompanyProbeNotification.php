<?php

namespace Tests\Support\Tenancy;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Tenancy\CompanyContext;
use App\Models\User;

/**
 * Records the CompanyContext its channels render in (CompanyContextTest).
 */
final class CompanyProbeNotification extends BaseNotification
{
    /** @var list<string|null> */
    public static array $seen = [];

    public function type(): NotificationType
    {
        return NotificationType::TaskAssigned;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        self::$seen[] = app(CompanyContext::class)->id();

        return new NotificationPayload(title: 'Uji konteks perusahaan', url: '/inbox');
    }
}
