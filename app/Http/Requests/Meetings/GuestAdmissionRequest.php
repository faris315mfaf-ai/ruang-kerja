<?php

namespace App\Http\Requests\Meetings;

use App\Domain\Meetings\Guests\GuestNames;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * "Minta masuk" on the public guest page: just the name the guest wants to be
 * shown under. No account, so authorization is the token itself.
 */
class GuestAdmissionRequest extends FormRequest
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
        return ['name' => ['required', 'string', 'min:2', 'max:'.GuestNames::MAX]];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['name' => 'nama'];
    }

    public function guestName(): ?string
    {
        return GuestNames::clean($this->input('name'));
    }
}
