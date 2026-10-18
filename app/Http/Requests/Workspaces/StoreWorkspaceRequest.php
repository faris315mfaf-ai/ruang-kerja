<?php

namespace App\Http\Requests\Workspaces;

use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Domain\Workspaces\Services\WorkspaceKeyGenerator;
use App\Models\Division;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Manual workspace (team or project). Authorization: WorkspacePolicy::create.
 */
class StoreWorkspaceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('key'))) {
            $this->merge(['key' => WorkspaceKeyGenerator::normalize($this->input('key'))]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $companyId = $this->user() instanceof User ? $this->user()->company_id : '';

        return [
            'type' => ['required', Rule::in([WorkspaceType::Team->value, WorkspaceType::Project->value])],
            'name' => ['required', 'string', 'max:120'],
            'key' => ['nullable', 'string', 'regex:'.WorkspaceKeyGenerator::PATTERN, function (string $attribute, mixed $value, Closure $fail) use ($companyId): void {
                if (is_string($value) && $value !== '' && app(WorkspaceKeyGenerator::class)->taken($companyId, $value)) {
                    $fail("Key {$value} sudah dipakai workspace lain.");
                }
            }],
            'description' => ['nullable', 'string', 'max:2000'],
            'visibility' => ['required', Rule::enum(WorkspaceVisibility::class)],
            // A team of the actor's company (teams belong to it through their division).
            'team_id' => ['nullable', 'string', Rule::exists('teams', 'id')->whereNull('deleted_at')
                ->where(fn ($query) => $query->whereIn('division_id', Division::query()->withTrashed()->where('company_id', $companyId)->select('id')))],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.in' => 'Pilih jenis workspace: Tim atau Proyek.',
            'name.required' => 'Nama workspace wajib diisi.',
            'name.max' => 'Nama workspace maksimal 120 karakter.',
            'key.regex' => 'Key 2–10 huruf kapital/angka dan diawali huruf, mis. PLQ.',
            'team_id.exists' => 'Tim tidak ditemukan.',
        ];
    }

    public function type(): WorkspaceType
    {
        return WorkspaceType::from($this->string('type')->toString());
    }

    /**
     * @return array{type: WorkspaceType, name: string, key: string|null, description: string|null, visibility: WorkspaceVisibility, team_id: string|null}
     */
    public function payload(): array
    {
        $type = $this->type();
        $key = $this->string('key')->toString();
        $description = $this->string('description')->trim()->toString();
        $teamId = $this->string('team_id')->toString();

        return [
            'type' => $type,
            'name' => $this->string('name')->trim()->toString(),
            'key' => $key === '' ? null : $key,
            'description' => $description === '' ? null : $description,
            'visibility' => WorkspaceVisibility::from($this->string('visibility')->toString()),
            'team_id' => $type === WorkspaceType::Team && $teamId !== '' ? $teamId : null,
        ];
    }
}
