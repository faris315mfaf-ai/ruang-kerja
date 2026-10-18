<?php

namespace App\Http\Controllers\Notifications;

use App\Domain\Notifications\Actions\UpdateNotificationPreference;
use App\Domain\Notifications\Actions\UpdateNotificationSettings;
use App\Domain\Notifications\Digest\DailyDigestMail;
use App\Domain\Notifications\Digest\DigestBuilder;
use App\Domain\Notifications\Enums\NotificationCategory;
use App\Domain\Notifications\Enums\NotificationChannel;
use App\Domain\Notifications\Enums\NotificationEvent;
use App\Domain\Notifications\Services\NotificationPreferenceResolver;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Http\Controllers\Controller;
use App\Http\Requests\Notifications\UpdateNotificationPreferenceRequest;
use App\Http\Requests\Notifications\UpdateNotificationSettingsRequest;
use App\Models\NotificationPreference;
use App\Models\NotificationSetting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Pengaturan › Notifikasi: event × channel matrix, daily digest, quiet hours.
 * Every change is saved immediately ("Tersimpan otomatis").
 */
class NotificationSettingsController extends Controller
{
    public function edit(#[CurrentUser] User $user, NotificationPreferenceResolver $preferences, DigestBuilder $digests): Response
    {
        $setting = NotificationSetting::for($user);

        Gate::authorize('view', $setting);

        return Inertia::render('notifications/settings', [
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
            'quietWindow' => [
                'start' => (string) config('notifications.quiet_hours.start'),
                'end' => (string) config('notifications.quiet_hours.end'),
            ],
            'digestPreview' => Inertia::defer(fn (): array => $digests->build(
                $user,
                CarbonImmutable::now()->setTimezone(CurrentCompany::timezone())->startOfDay(),
            )->toArray()),
            'email' => $user->email,
        ]);
    }

    public function update(UpdateNotificationSettingsRequest $request, #[CurrentUser] User $user, UpdateNotificationSettings $update): JsonResponse|RedirectResponse
    {
        Gate::authorize('update', NotificationSetting::for($user));

        $setting = $update->handle($user, $request->settings());

        if ($request->expectsJson()) {
            return response()->json([
                'digest_time' => $setting->digestTimeShort(),
                'quiet_hours' => $setting->quiet_hours,
                'pause_while_on_leave' => $setting->pause_while_on_leave,
            ]);
        }

        return back();
    }

    public function preference(UpdateNotificationPreferenceRequest $request, #[CurrentUser] User $user, UpdateNotificationPreference $update): JsonResponse|RedirectResponse
    {
        Gate::authorize('manage', [NotificationPreference::class, $user]);

        $preference = $update->handle($user, $request->event(), $request->channel(), $request->boolean('enabled'));

        if ($request->expectsJson()) {
            return response()->json([
                'event' => $preference->event->value,
                'channel' => $preference->channel->value,
                'enabled' => $preference->enabled,
            ]);
        }

        return back();
    }

    /**
     * The digest email exactly as it would be sent today ("Lihat di browser").
     */
    public function digestPreview(#[CurrentUser] User $user, DigestBuilder $digests): DailyDigestMail
    {
        $setting = NotificationSetting::for($user);

        Gate::authorize('view', $setting);

        $digest = $digests->build(
            $user,
            CarbonImmutable::now()->setTimezone(CurrentCompany::timezone())->startOfDay(),
        );

        return new DailyDigestMail($digest, $setting->digestTimeShort());
    }
}
