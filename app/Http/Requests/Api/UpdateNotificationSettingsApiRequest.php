<?php

namespace App\Http\Requests\Api;

use App\Domain\Notifications\Enums\NotificationChannel;
use App\Domain\Notifications\Enums\NotificationEvent;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * PUT /api/v1/pengaturan/notifikasi — everything of the settings screen in
 * one call: the web fields (digest_time, quiet_hours, pause_while_on_leave),
 * the daily-digest switch and any number of (event, channel) cells. All keys
 * optional; the call is atomic.
 */
class UpdateNotificationSettingsApiRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // Digest times on a 5-minute grid (the scheduler runs every 5 minutes), like the web.
            'digest_time' => ['sometimes', 'string', 'regex:/^([01]\d|2[0-3]):[0-5][05]$/'],
            'digest_enabled' => ['sometimes', 'boolean'],
            'quiet_hours' => ['sometimes', 'boolean'],
            'pause_while_on_leave' => ['sometimes', 'boolean'],
            'preferences' => ['sometimes', 'array', 'max:60'],
            'preferences.*.event' => ['required', 'string', Rule::enum(NotificationEvent::class)],
            'preferences.*.channel' => ['required', 'string', Rule::enum(NotificationChannel::class)],
            'preferences.*.enabled' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'digest_time.regex' => 'Jam kirim harus berformat JJ:MM dengan kelipatan 5 menit, mis. 07:30.',
            'digest_enabled.boolean' => 'Pilihan ringkasan harian tidak valid.',
            'quiet_hours.boolean' => 'Pilihan jam tenang tidak valid.',
            'pause_while_on_leave.boolean' => 'Pilihan tahan saat cuti tidak valid.',
            'preferences.array' => 'Daftar preferensi tidak valid.',
            'preferences.max' => 'Terlalu banyak preferensi sekaligus.',
            'preferences.*.event.required' => 'Pilih kejadian.',
            'preferences.*.event.enum' => 'Kejadian tidak dikenal.',
            'preferences.*.channel.required' => 'Pilih kanal.',
            'preferences.*.channel.enum' => 'Kanal tidak dikenal.',
            'preferences.*.enabled.required' => 'Status aktif wajib diisi.',
            'preferences.*.enabled.boolean' => 'Status aktif tidak valid.',
        ];
    }

    /**
     * @return array{digest_time?: string, quiet_hours?: bool, pause_while_on_leave?: bool}
     */
    public function settings(): array
    {
        $settings = [];

        if ($this->has('digest_time')) {
            $settings['digest_time'] = $this->string('digest_time')->toString();
        }

        if ($this->has('quiet_hours')) {
            $settings['quiet_hours'] = $this->boolean('quiet_hours');
        }

        if ($this->has('pause_while_on_leave')) {
            $settings['pause_while_on_leave'] = $this->boolean('pause_while_on_leave');
        }

        return $settings;
    }

    /**
     * Preference cells to write, the digest switch included.
     *
     * @return list<array{event: NotificationEvent, channel: NotificationChannel, enabled: bool}>
     */
    public function cells(): array
    {
        $cells = [];

        if ($this->has('digest_enabled')) {
            $cells[] = ['event' => NotificationEvent::DailyDigest, 'channel' => NotificationChannel::Email, 'enabled' => $this->boolean('digest_enabled')];
        }

        foreach ((array) $this->input('preferences', []) as $row) {
            if (! is_array($row)) {
                continue;
            }

            $cells[] = [
                'event' => NotificationEvent::from((string) $row['event']),
                'channel' => NotificationChannel::from((string) $row['channel']),
                'enabled' => filter_var($row['enabled'], FILTER_VALIDATE_BOOLEAN),
            ];
        }

        return $cells;
    }
}
