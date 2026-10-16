<?php

namespace App\Http\Requests\Api;

use App\Domain\Meetings\Enums\Rsvp;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST /api/v1/rapat/{meeting}/kehadiran — the token owner's own RSVP.
 * Same values as the web RsvpRequest (Hadir `yes` / Mungkin `maybe` /
 * Tidak hadir `no`; `pending` is not an answer). Reading rights (404 for
 * an invisible meeting, 403 for a non-participant) are checked by the
 * controller behind MeetingPolicy::respond.
 */
class MeetingRsvpRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'rsvp' => ['required', Rule::enum(Rsvp::class)->only([Rsvp::Yes, Rsvp::Maybe, Rsvp::No])],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'rsvp.required' => 'Jawaban kehadiran wajib dipilih.',
            'rsvp.Illuminate\Validation\Rules\Enum' => 'Jawaban kehadiran tidak dikenal.',
        ];
    }

    public function rsvp(): Rsvp
    {
        return Rsvp::from($this->string('rsvp')->toString());
    }
}
