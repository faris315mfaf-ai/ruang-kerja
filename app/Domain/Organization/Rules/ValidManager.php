<?php

namespace App\Domain\Organization\Rules;

use App\Domain\Organization\Services\ManagerHierarchy;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Validates a `manager_id` input: the manager must exist in the same company,
 * be active, and must not create a reporting cycle with $subject.
 *
 * Usage: 'manager_id' => ['nullable', 'string', new ValidManager($employee, $companyId)]
 * ($employee is null when creating a new employee).
 */
final readonly class ValidManager implements ValidationRule
{
    public function __construct(
        private ?User $subject,
        private string $companyId,
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if ($value === null || $value === '') {
            return;
        }

        $manager = is_string($value) ? User::query()->find($value) : null;

        if ($manager === null || $manager->company_id !== $this->companyId) {
            $fail('Atasan langsung tidak ditemukan.');

            return;
        }

        if (! $manager->isActive()) {
            $fail('Atasan langsung harus karyawan aktif.');

            return;
        }

        if ($this->subject !== null && app(ManagerHierarchy::class)->wouldCreateCycle($this->subject, $manager)) {
            $fail($manager->is($this->subject)
                ? 'Karyawan tidak bisa menjadi atasan dirinya sendiri.'
                : 'Atasan ini akan membuat siklus atasan (bawahan tidak boleh menjadi atasan).');
        }
    }
}
