<?php

namespace App\Http\Requests\Meetings;

use App\Domain\Meetings\Enums\Rsvp;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/** "Kehadiran Anda": Hadir / Mungkin / Tidak hadir. */
class RsvpRequest extends MeetingRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return ['rsvp' => ['required', Rule::enum(Rsvp::class)->only([Rsvp::Yes, Rsvp::Maybe, Rsvp::No])]];
    }

    public function rsvp(): Rsvp
    {
        return Rsvp::from($this->string('rsvp')->toString());
    }
}
