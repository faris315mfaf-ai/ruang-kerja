<?php

namespace App\Http\Requests\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Approve (note optional) / reject & revision (note required — enforced by the actions too).
 */
class DecideRequestRequest extends FormRequest
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
        $required = $this->routeIs('approvals.reject', 'approvals.revise') ? 'required' : 'nullable';

        return [
            'note' => [$required, 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'note.required' => $this->routeIs('approvals.reject') ? 'Alasan wajib diisi saat menolak.' : 'Catatan wajib diisi saat meminta revisi.',
            'note.max' => 'Catatan maksimal :max karakter.',
        ];
    }

    public function note(): ?string
    {
        $note = $this->input('note');

        return is_string($note) ? $note : null;
    }
}
