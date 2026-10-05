<?php

namespace App\Http\Requests\Organization;

use App\Models\Team;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class TeamRequest extends OrganizationRequest
{
    protected function modelClass(): string
    {
        return Team::class;
    }

    protected function routeKey(): string
    {
        return 'team';
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => is_string($this->input('name')) ? trim($this->input('name')) : $this->input('name'),
            'code' => $this->normalizedCode(),
            'division_id' => $this->nullableId('division_id'),
            'lead_user_id' => $this->nullableId('lead_user_id'),
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $team = $this->route('team');
        $teamId = $team instanceof Team ? $team->id : null;

        return [
            'division_id' => [
                'required', 'string',
                Rule::exists('divisions', 'id')->where('company_id', $this->actor()->company_id)->whereNull('deleted_at'),
            ],
            'name' => ['required', 'string', 'max:120'],
            'code' => [
                'nullable', 'string', 'max:10', 'regex:/^[A-Z0-9]+$/',
                Rule::unique('teams', 'code')
                    ->where('division_id', $this->input('division_id'))
                    ->whereNull('deleted_at')
                    ->ignore($teamId),
            ],
            // Only a changed lead must be active (see DivisionRequest).
            'lead_user_id' => ['nullable', 'string', ...$this->unlessUnchanged($team instanceof Team ? $team->lead_user_id : null, 'lead_user_id')],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'division_id.required' => 'Pilih divisi untuk tim ini.',
            'division_id.exists' => 'Divisi tidak ditemukan.',
            'name.required' => 'Nama tim wajib diisi.',
            'name.max' => 'Nama tim maksimal 120 karakter.',
            'code.max' => 'Kode tim maksimal 10 karakter.',
            'code.regex' => 'Kode tim hanya boleh berisi huruf dan angka, tanpa spasi.',
            'code.unique' => 'Kode :input sudah dipakai tim lain di divisi ini.',
            'lead_user_id.exists' => 'Ketua tim harus karyawan aktif di perusahaan ini.',
        ];
    }

    /**
     * @return array{division_id: string, name: string, code: string|null, lead_user_id: string|null}
     */
    public function payload(): array
    {
        return [
            'division_id' => $this->string('division_id')->toString(),
            'name' => $this->string('name')->toString(),
            'code' => $this->normalizedCode(),
            'lead_user_id' => $this->nullableId('lead_user_id'),
        ];
    }
}
