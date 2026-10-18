<?php

namespace App\Http\Requests\Api;

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
 * POST /api/v1/workspace — a team or project workspace, optionally from a
 * workspace template (`template_id`: the template decides the type, the
 * columns and the labels; then `type` may be left out). Same field rules as
 * the web StoreWorkspaceRequest / WorkspaceFromTemplateRequest; `visibility`
 * defaults to `private`. Authorization is WorkspacePolicy::create (controller).
 */
class WorkspaceStoreRequest extends FormRequest
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
        $companyId = $this->user() instanceof User ? (string) $this->user()->company_id : '';

        return [
            'template_id' => ['nullable', 'string', 'ulid'],
            'type' => ['required_without:template_id', 'nullable', Rule::in([WorkspaceType::Team->value, WorkspaceType::Project->value])],
            'name' => ['required', 'string', 'max:120'],
            'key' => ['nullable', 'string', 'regex:'.WorkspaceKeyGenerator::PATTERN, function (string $attribute, mixed $value, Closure $fail) use ($companyId): void {
                if (is_string($value) && $value !== '' && app(WorkspaceKeyGenerator::class)->taken($companyId, $value)) {
                    $fail("Key {$value} sudah dipakai workspace lain.");
                }
            }],
            'description' => ['nullable', 'string', 'max:2000'],
            'visibility' => ['nullable', Rule::enum(WorkspaceVisibility::class)],
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
            'type.required_without' => 'Pilih jenis workspace: Tim atau Proyek.',
            'type.in' => 'Pilih jenis workspace: Tim atau Proyek.',
            'name.required' => 'Nama workspace wajib diisi.',
            'name.max' => 'Nama workspace maksimal 120 karakter.',
            'key.regex' => 'Key 2–10 huruf kapital/angka dan diawali huruf, mis. PLQ.',
            'team_id.exists' => 'Tim tidak ditemukan.',
            'template_id.ulid' => 'Template tidak valid.',
        ];
    }

    public function templateId(): ?string
    {
        $id = $this->string('template_id')->toString();

        return $id === '' ? null : strtolower($id);
    }

    public function type(): ?WorkspaceType
    {
        return WorkspaceType::tryFrom($this->string('type')->toString());
    }

    public function visibility(): WorkspaceVisibility
    {
        return WorkspaceVisibility::tryFrom($this->string('visibility')->toString()) ?? WorkspaceVisibility::Private;
    }

    public function keyOrNull(): ?string
    {
        $key = $this->string('key')->toString();

        return $key === '' ? null : $key;
    }

    public function descriptionOrNull(): ?string
    {
        $description = $this->string('description')->trim()->toString();

        return $description === '' ? null : $description;
    }

    public function teamId(): ?string
    {
        $id = $this->string('team_id')->toString();

        return $id === '' ? null : $id;
    }
}
