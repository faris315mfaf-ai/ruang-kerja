<?php

namespace App\Domain\Tenancy;

use App\Domain\Tenancy\Support\OfficeTimezone;
use App\Models\Company;
use Closure;

/**
 * The company the current request or queued job works for (Fase 1 multi-
 * perusahaan, docs/sesi/fase1.md).
 *
 * Scoped singleton (TenancyServiceProvider): one per HTTP request or queue job.
 * Filled by ResolveCompanyContext (web & api: the signed-in user, or the kiosk
 * device), by public endpoints from the row their token/webhook resolves to,
 * and by RestoreCompanyContext for jobs and notifications (CompanyAware).
 *
 * It is information, not a filter: isolation is still enforced by the
 * existing `visibleTo()` scopes and Policies (no automatic global scope). An
 * empty context (guest pages, scheduler jobs) keeps today's behaviour.
 */
final class CompanyContext
{
    private ?string $id = null;

    private ?Company $company = null;

    private bool $loaded = false;

    public function id(): ?string
    {
        return $this->id;
    }

    public function has(): bool
    {
        return $this->id !== null;
    }

    /**
     * The company row, loaded once (soft-deleted company → null).
     */
    public function company(): ?Company
    {
        if ($this->id === null) {
            return null;
        }

        if (! $this->loaded) {
            $this->company = Company::query()->find($this->id);
            $this->loaded = true;
        }

        return $this->company;
    }

    /**
     * The company's office timezone, or the app-wide one without a context
     * (also when the stored value is not a valid IANA identifier).
     */
    public function timezone(): string
    {
        return OfficeTimezone::of($this->company());
    }

    public function set(Company|string|null $company): void
    {
        if ($company instanceof Company) {
            [$this->id, $this->company, $this->loaded] = [$company->id, $company, true];

            return;
        }

        $id = $company === '' ? null : $company;

        // Same company: keep the row already loaded.
        if ($id === $this->id) {
            return;
        }

        [$this->id, $this->company, $this->loaded] = [$id, null, false];
    }

    public function clear(): void
    {
        $this->set(null);
    }

    /**
     * Runs $callback inside another company's context, then restores the
     * previous one (also when the callback throws).
     *
     * @template TReturn
     *
     * @param  Closure(): TReturn  $callback
     * @return TReturn
     */
    public function run(Company|string|null $company, Closure $callback): mixed
    {
        [$id, $row, $loaded] = [$this->id, $this->company, $this->loaded];

        $this->set($company);

        try {
            return $callback();
        } finally {
            [$this->id, $this->company, $this->loaded] = [$id, $row, $loaded];
        }
    }
}
