<?php

namespace App\Http\Requests\Api\Pengajuan;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Setujui (`note` optional) · Tolak (`reason` required; `note` accepted as
 * alias) · Minta revisi (`note` required). Same limits and Indonesian
 * messages as the web DecideRequestRequest; the actions check again.
 */
final class DecideApiRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->routeIs('api.v1.approvals.reject') && ! $this->filled('reason') && $this->filled('note')) {
            $this->merge(['reason' => $this->input('note')]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        if ($this->routeIs('api.v1.approvals.reject')) {
            return ['reason' => ['required', 'string', 'max:1000']];
        }

        return [
            'note' => [$this->routeIs('api.v1.approvals.revise') ? 'required' : 'nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.required' => 'Alasan wajib diisi saat menolak.',
            'reason.max' => 'Alasan maksimal :max karakter.',
            'note.required' => 'Catatan wajib diisi saat meminta revisi.',
            'note.max' => 'Catatan maksimal :max karakter.',
        ];
    }

    public function note(): ?string
    {
        $value = $this->input($this->routeIs('api.v1.approvals.reject') ? 'reason' : 'note');

        return is_string($value) ? $value : null;
    }
}
