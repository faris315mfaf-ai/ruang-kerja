<?php

namespace App\Domain\Notifications\Actions;

use App\Models\NotificationSetting;
use App\Models\User;

/**
 * Updates digest time, quiet hours and "hold while on leave".
 */
final class UpdateNotificationSettings
{
    /**
     * @param  array{digest_time?: string, quiet_hours?: bool, pause_while_on_leave?: bool}  $attributes
     */
    public function handle(User $user, array $attributes): NotificationSetting
    {
        $setting = NotificationSetting::for($user);

        if (isset($attributes['digest_time'])) {
            $time = NotificationSetting::normalizeTime($attributes['digest_time']);

            // A new time may legitimately trigger today's digest again.
            if ($time !== $setting->digest_time) {
                $setting->digest_last_run_on = null;
            }

            $setting->digest_time = $time;
        }

        if (isset($attributes['quiet_hours'])) {
            $setting->quiet_hours = $attributes['quiet_hours'];
        }

        if (isset($attributes['pause_while_on_leave'])) {
            $setting->pause_while_on_leave = $attributes['pause_while_on_leave'];
        }

        $setting->save();

        return $setting;
    }
}
