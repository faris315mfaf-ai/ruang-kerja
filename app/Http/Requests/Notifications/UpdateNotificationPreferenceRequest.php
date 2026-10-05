<?php

namespace App\Http\Requests\Notifications;

use App\Domain\Notifications\Enums\NotificationChannel;
use App\Domain\Notifications\Enums\NotificationEvent;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateNotificationPreferenceRequest extends FormRequest
{
    /**
     * Authorization happens in the controller (NotificationPreferencePolicy::manage).
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
            'event' => ['required', 'string', Rule::enum(NotificationEvent::class)],
            'channel' => ['required', 'string', Rule::enum(NotificationChannel::class)],
            'enabled' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'event.required' => 'Pilih kejadian.',
            'event.enum' => 'Kejadian tidak dikenal.',
            'channel.required' => 'Pilih kanal.',
            'channel.enum' => 'Kanal tidak dikenal.',
            'enabled.required' => 'Status aktif wajib diisi.',
            'enabled.boolean' => 'Status aktif tidak valid.',
        ];
    }

    public function event(): NotificationEvent
    {
        return NotificationEvent::from($this->string('event')->toString());
    }

    public function channel(): NotificationChannel
    {
        return NotificationChannel::from($this->string('channel')->toString());
    }
}
