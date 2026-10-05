<?php

namespace App\Http\Requests\Notifications;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateNotificationSettingsRequest extends FormRequest
{
    /**
     * Authorization happens in the controller (NotificationSettingPolicy::update).
     */
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
            // Digest times on a 5-minute grid (the scheduler runs every 5 minutes).
            'digest_time' => ['sometimes', 'string', 'regex:/^([01]\d|2[0-3]):[0-5][05]$/'],
            'quiet_hours' => ['sometimes', 'boolean'],
            'pause_while_on_leave' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'digest_time.regex' => 'Jam kirim harus berformat JJ:MM dengan kelipatan 5 menit, mis. 07:30.',
            'quiet_hours.boolean' => 'Pilihan jam tenang tidak valid.',
            'pause_while_on_leave.boolean' => 'Pilihan tahan saat cuti tidak valid.',
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
}
