<?php

namespace App\Policies;

use App\Models\NotificationSetting;
use App\Models\User;

/**
 * Digest time, quiet hours and "hold while on leave" are personal settings.
 */
class NotificationSettingPolicy
{
    public function view(User $actor, NotificationSetting $setting): bool
    {
        return $setting->user_id === $actor->id;
    }

    public function update(User $actor, NotificationSetting $setting): bool
    {
        return $setting->user_id === $actor->id;
    }
}
