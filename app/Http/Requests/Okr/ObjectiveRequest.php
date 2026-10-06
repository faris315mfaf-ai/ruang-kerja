<?php

namespace App\Http\Requests\Okr;

use App\Domain\Analytics\Okr\Quarter;
use App\Domain\Okr\Enums\ObjectiveStatus;
use App\Domain\Okr\Services\OkrPeople;
use App\Models\Division;
use App\Models\Objective;
use App\Models\User;
use Closure;
use Illuminate\Auth\Access\Response;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Create / edit an objective. The division is chosen on create only; the
 * owner must be an active employee (or the head) of that division.
 */
class ObjectiveRequest extends FormRequest
{
    /**
     * Before validation, so an invisible objective answers 404, not 422.
     */
    public function authorize(): Response
    {
        $objective = $this->route('objective');

        if ($objective instanceof Objective) {
            return Gate::inspect('update', $objective);
        }

        $division = $this->division();

        // Unknown division: the validator reports it.
        return $division === null ? Response::allow() : Gate::inspect('create', $division);
    }

    protected function prepareForValidation(): void
    {
        if ($this->input('description') === '') {
            $this->merge(['description' => null]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $user = $this->user();
        $companyId = $user instanceof User ? $user->company_id : '';
        $creating = ! $this->route('objective') instanceof Objective;

        return [
            'division_id' => $creating
                ? ['required', 'string', Rule::exists('divisions', 'id')->where('company_id', $companyId)->whereNull('deleted_at')]
                : ['prohibited'],
            'quarter' => ['required', 'string', 'regex:'.Quarter::PATTERN],
            'title' => ['required', 'string', 'min:5', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
            'owner_id' => ['required', 'string', function (string $attribute, mixed $value, Closure $fail): void {
                $division = $this->division();

                if ($division !== null && (! is_string($value) || ! app(OkrPeople::class)->isEligible($division, $value))) {
                    $fail('Pemilik harus karyawan aktif atau kepala divisi ini.');
                }
            }],
            'status' => ['sometimes', Rule::in([ObjectiveStatus::Draft->value, ObjectiveStatus::Active->value])],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'division_id.required' => 'Pilih divisi.',
            'division_id.exists' => 'Divisi tidak ditemukan.',
            'quarter.required' => 'Pilih kuartal.',
            'quarter.regex' => 'Kuartal tidak valid.',
            'title.required' => 'Tulis objective minimal 5 karakter.',
            'title.min' => 'Tulis objective minimal 5 karakter.',
            'title.max' => 'Maksimal 200 karakter.',
            'description.max' => 'Deskripsi maksimal 2.000 karakter.',
            'owner_id.required' => 'Pilih pemilik.',
        ];
    }

    /**
     * Division of the objective (route on edit, input on create).
     */
    public function division(): ?Division
    {
        $objective = $this->route('objective');

        if ($objective instanceof Objective) {
            return $objective->division;
        }

        $id = $this->input('division_id');
        $user = $this->user();

        return is_string($id) && $user instanceof User
            ? Division::query()->where('company_id', $user->company_id)->find($id)
            : null;
    }

    /**
     * @return array{quarter: string, title: string, description: string|null, owner_id: string, status: ObjectiveStatus}
     */
    public function payload(): array
    {
        $description = $this->input('description');

        return [
            'quarter' => $this->string('quarter')->toString(),
            'title' => $this->string('title')->trim()->toString(),
            'description' => is_string($description) && trim($description) !== '' ? trim($description) : null,
            'owner_id' => $this->string('owner_id')->toString(),
            'status' => ObjectiveStatus::from($this->string('status', ObjectiveStatus::Active->value)->toString()),
        ];
    }
}
