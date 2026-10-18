<?php

namespace App\Http\Requests\Meetings;

use App\Domain\Meetings\Guests\GuestNames;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Organizer invites an external guest to a video meeting: e-mail (their
 * identity on the invitation, never mailed by the app) and an optional name
 * that is pre-filled on the guest page.
 */
class StoreMeetingGuestRequest extends OccurrenceRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'email' => ['required', 'string', 'email', 'max:190'],
            'name' => ['nullable', 'string', 'max:'.GuestNames::MAX],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['email' => 'email tamu', 'name' => 'nama tamu'];
    }

    public function guestName(): ?string
    {
        return GuestNames::clean($this->input('name'));
    }
}
