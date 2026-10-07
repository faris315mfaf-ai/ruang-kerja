<?php

namespace App\Http\Requests\Meetings;

use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Organizer mutes / removes someone in the video room. Muting names the
 * published microphone track (LiveKit track SID "TR_…").
 */
class VideoModerationRequest extends OccurrenceRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'track_sid' => [$this->isMethod('DELETE') ? 'nullable' : 'required', 'string', 'max:64', 'regex:/^TR_[A-Za-z0-9]+$/'],
        ];
    }

    public function trackSid(): string
    {
        return $this->string('track_sid')->toString();
    }
}
