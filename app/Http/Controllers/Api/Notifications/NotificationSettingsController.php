<?php

namespace App\Http\Controllers\Api\Notifications;

use App\Domain\Notifications\Actions\SendTestNotification;
use App\Domain\Notifications\Actions\UpdateNotificationPreference;
use App\Domain\Notifications\Actions\UpdateNotificationSettings;
use App\Domain\Notifications\Digest\DigestBuilder;
use App\Domain\Notifications\Enums\AndroidChannel;
use App\Domain\Notifications\Enums\NotificationCategory;
use App\Domain\Notifications\Enums\NotificationChannel;
use App\Domain\Notifications\Enums\NotificationEvent;
use App\Domain\Notifications\Services\FcmClient;
use App\Domain\Notifications\Services\NotificationPreferenceResolver;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\UpdateNotificationSettingsApiRequest;
use App\Models\NotificationPreference;
use App\Models\NotificationSetting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * Pengaturan › Notifikasi of the mobile app: the same matrix, settings and
 * Actions as the web screen (NotificationPolicy rules: strictly the owner's
 * own settings), in one read and one atomic write.
 */
class NotificationSettingsController extends Controller
{
    public function show(#[CurrentUser] User $user, NotificationPreferenceResolver $preferences, FcmClient $fcm): JsonResponse
    {
        return response()->json($this->payload($user, $preferences, $fcm));
    }

    public function update(UpdateNotificationSettingsApiRequest $request, #[CurrentUser] User $user, UpdateNotificationSettings $settings, UpdateNotificationPreference $preference, NotificationPreferenceResolver $preferences, FcmClient $fcm): JsonResponse
    {
        Gate::authorize('update', NotificationSetting::for($user));
        Gate::authorize('manage', [NotificationPreference::class, $user]);

        // A locked or unavailable cell throws a ValidationException (422) and rolls everything back.
        DB::transaction(function () use ($request, $user, $settings, $preference): void {
            if ($request->settings() !== []) {
                $settings->handle($user, $request->settings());
            }

            foreach ($request->cells() as $cell) {
                $preference->handle($user, $cell['event'], $cell['channel'], $cell['enabled']);
            }
        });

        return response()->json($this->payload($user, $preferences, $fcm));
    }

    /**
     * Today's digest exactly as it would be mailed — JSON for the
     * "Contoh ringkasan hari ini" screen; `sections` is empty when nothing
     * would be sent.
     */
    public function digest(#[CurrentUser] User $user, DigestBuilder $digests): JsonResponse
    {
        $setting = NotificationSetting::for($user);

        Gate::authorize('view', $setting);

        $digest = $digests->build(
            $user,
            CarbonImmutable::now()->setTimezone(config()->string('app.office_timezone'))->startOfDay(),
        );

        return response()->json([
            'digest' => $digest->toArray(),
            'empty' => $digest->isEmpty(),
            'digest_time' => $setting->digestTimeShort(),
        ]);
    }

    /** "Kirim notifikasi uji": a system.test notification through the user's own channels. */
    public function test(#[CurrentUser] User $user, SendTestNotification $send): JsonResponse
    {
        Gate::authorize('manage', [NotificationPreference::class, $user]);

        $send->handle($user);

        return response()->json(['message' => 'Notifikasi uji dikirim. Periksa Inbox dan bilah notifikasi ponsel.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(User $user, NotificationPreferenceResolver $preferences, FcmClient $fcm): array
    {
        $setting = NotificationSetting::for($user);

        Gate::authorize('view', $setting);

        return [
            'matrix' => $preferences->matrix($user),
            'categories' => array_map(fn (NotificationCategory $category): array => [
                'value' => $category->value,
                'label' => $category->label(),
            ], NotificationCategory::cases()),
            'channels' => array_map(fn (NotificationChannel $channel): array => [
                'value' => $channel->value,
                'label' => $channel->label(),
                'available' => $channel->isAvailable(),
            ], NotificationChannel::cases()),
            'settings' => [
                'digest_enabled' => $preferences->isEnabled($user, NotificationEvent::DailyDigest, NotificationChannel::Email),
                'digest_time' => $setting->digestTimeShort(),
                'quiet_hours' => $setting->quiet_hours,
                'pause_while_on_leave' => $setting->pause_while_on_leave,
            ],
            'quiet_window' => [
                'start' => config()->string('notifications.quiet_hours.start'),
                'end' => config()->string('notifications.quiet_hours.end'),
            ],
            'email' => $user->email,
            // Push has no switch of its own: it follows the In-app column of each row.
            'push' => [
                'follows' => NotificationChannel::InApp->value,
                'server_ready' => $fcm->isConfigured(),
                'android_channels' => AndroidChannel::definitions(),
            ],
        ];
    }
}
