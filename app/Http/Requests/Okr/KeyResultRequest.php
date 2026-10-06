<?php

namespace App\Http\Requests\Okr;

use App\Domain\Okr\Enums\KeyResultUnit;
use App\Domain\Okr\Services\OkrPeople;
use App\Models\KeyResult;
use App\Models\Objective;
use Closure;
use Illuminate\Auth\Access\Response;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Add / edit a key result (same rules as validateKrDraft in features/okr/lib.ts).
 */
class KeyResultRequest extends FormRequest
{
    private const float MAX_VALUE = 999_999_999_999.99;

    /**
     * Before validation, so an invisible objective answers 404, not 422.
     */
    public function authorize(): Response
    {
        $keyResult = $this->route('keyResult');

        if ($keyResult instanceof KeyResult) {
            return Gate::inspect('update', $keyResult);
        }

        $objective = $this->route('objective');

        return $objective instanceof Objective ? Gate::inspect('createKeyResult', $objective) : Response::denyAsNotFound();
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $percent = $this->input('unit') === KeyResultUnit::Percent->value;
        $value = fn (): array => ['required', 'numeric', 'decimal:0,2', ...($percent ? ['between:0,100'] : ['between:-'.self::MAX_VALUE.','.self::MAX_VALUE])];

        return [
            'title' => ['required', 'string', 'min:5', 'max:160'],
            'unit' => ['required', Rule::enum(KeyResultUnit::class)],
            'unit_label' => ['nullable', 'string', 'max:20'],
            'start_value' => $value(),
            'target_value' => [...$value(), 'different:start_value'],
            'current_value' => $value(),
            'weight' => ['required', 'integer', 'between:1,100'],
            'owner_id' => ['required', 'string', function (string $attribute, mixed $value, Closure $fail): void {
                $objective = $this->objective();

                if ($objective !== null && (! is_string($value) || ! app(OkrPeople::class)->isEligible($objective->division, $value))) {
                    $fail('Pemilik harus karyawan aktif atau kepala divisi objective ini.');
                }
            }],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.required' => 'Tulis key result minimal 5 karakter.',
            'title.min' => 'Tulis key result minimal 5 karakter.',
            'title.max' => 'Maksimal 160 karakter.',
            'unit.required' => 'Pilih satuan.',
            'start_value.required' => 'Isi angka awal.',
            'target_value.required' => 'Isi angka target.',
            'target_value.different' => 'Target harus berbeda dari nilai awal.',
            'current_value.required' => 'Isi nilai saat ini.',
            '*.numeric' => 'Isi berupa angka.',
            '*.decimal' => 'Maksimal 2 angka di belakang koma.',
            'start_value.between' => $this->input('unit') === KeyResultUnit::Percent->value ? 'Persen harus 0–100.' : 'Angka terlalu besar.',
            'target_value.between' => $this->input('unit') === KeyResultUnit::Percent->value ? 'Persen harus 0–100.' : 'Angka terlalu besar.',
            'current_value.between' => $this->input('unit') === KeyResultUnit::Percent->value ? 'Persen harus 0–100.' : 'Angka terlalu besar.',
            'weight.*' => 'Bobot bilangan bulat 1–100.',
            'owner_id.required' => 'Pilih pemilik.',
        ];
    }

    public function objective(): ?Objective
    {
        $objective = $this->route('objective');
        $keyResult = $this->route('keyResult');

        return match (true) {
            $objective instanceof Objective => $objective,
            $keyResult instanceof KeyResult => $keyResult->objective,
            default => null,
        };
    }

    /**
     * @return array{title: string, unit: KeyResultUnit, unit_label: string, start_value: float, target_value: float, current_value: float, weight: float, owner_id: string}
     */
    public function payload(): array
    {
        return [
            'title' => $this->string('title')->trim()->toString(),
            'unit' => KeyResultUnit::from($this->string('unit')->toString()),
            'unit_label' => $this->string('unit_label')->trim()->toString(),
            'start_value' => $this->float('start_value'),
            'target_value' => $this->float('target_value'),
            'current_value' => $this->float('current_value'),
            'weight' => (float) $this->integer('weight'),
            'owner_id' => $this->string('owner_id')->toString(),
        ];
    }
}
