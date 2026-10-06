<?php

namespace App\Http\Requests\Hiring;

use Illuminate\Contracts\Validation\ValidationRule;

/** "Tambah kandidat manual" (with position_id) or HR correcting contact data. */
class CandidateRequest extends HiringRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...($this->isMethod('post') ? ['position_id' => ['required', 'string', 'ulid']] : []),
            'full_name' => ['required', 'string', 'min:2', 'max:150'],
            'email' => ['nullable', 'string', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40'],
            'cv_url' => ['nullable', 'string', 'url:http,https', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'position_id' => 'lowongan',
            'full_name' => 'nama lengkap',
            'email' => 'email',
            'phone' => 'nomor HP',
            'cv_url' => 'tautan CV',
        ];
    }

    /**
     * @return array{full_name: string, email: string|null, phone: string|null, cv_url: string|null}
     */
    public function payload(): array
    {
        return [
            'full_name' => $this->string('full_name')->toString(),
            'email' => $this->filled('email') ? $this->string('email')->toString() : null,
            'phone' => $this->filled('phone') ? $this->string('phone')->toString() : null,
            'cv_url' => $this->filled('cv_url') ? $this->string('cv_url')->toString() : null,
        ];
    }
}
