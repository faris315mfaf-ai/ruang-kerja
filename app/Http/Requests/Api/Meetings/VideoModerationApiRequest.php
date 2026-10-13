<?php

namespace App\Http\Requests\Api\Meetings;

use App\Http\Requests\Meetings\OccurrenceRequest;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Organizer moderation from the app: POST …/video/bisukan {user_id,
 * track_sid}, …/video/keluarkan {user_id}, …/video/izinkan-masuk
 * {user_id}. The person is named in the body (the web puts the LiveKit
 * identity = user ULID in the path); muting names the published
 * microphone track (LiveKit track SID "TR_…").
 */
class VideoModerationApiRequest extends OccurrenceRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'user_id' => ['required', 'string', 'ulid'],
            'track_sid' => [$this->routeIs('api.v1.meetings.video.mute') ? 'required' : 'nullable', 'string', 'max:64', 'regex:/^TR_[A-Za-z0-9]+$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'user_id.required' => 'Pilih peserta.',
            'user_id.ulid' => 'Peserta tidak dikenal.',
            'track_sid.required' => 'Mikrofon peserta tidak ditemukan.',
            'track_sid.regex' => 'Mikrofon peserta tidak ditemukan.',
        ];
    }

    public function userId(): string
    {
        return $this->string('user_id')->toString();
    }

    public function trackSid(): string
    {
        return $this->string('track_sid')->toString();
    }
}
