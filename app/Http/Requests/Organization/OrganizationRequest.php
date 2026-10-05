<?php

namespace App\Http\Requests\Organization;

use App\Domain\Organization\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Exists;
use LogicException;

/**
 * Shared helpers for the organization master-data forms.
 *
 * authorize() asks the model policy (create, or update for the bound model) so
 * that unauthorized users get 403 before validation can reveal anything (e.g.
 * whether a code exists). Controllers still call Gate::authorize() as well.
 */
abstract class OrganizationRequest extends FormRequest
{
    /**
     * @return class-string<Model>
     */
    abstract protected function modelClass(): string;

    abstract protected function routeKey(): string;

    public function authorize(): bool
    {
        $model = $this->route($this->routeKey());

        return $model instanceof Model
            ? $this->actor()->can('update', $model)
            : $this->actor()->can('create', $this->modelClass());
    }

    protected function actor(): User
    {
        $user = $this->user();

        if (! $user instanceof User) {
            throw new LogicException('Organization forms require a signed-in user.');
        }

        return $user;
    }

    /**
     * An active employee of the actor's company (division head, team lead).
     */
    protected function activeEmployee(): Exists
    {
        return (new Exists('users', 'id'))
            ->where('company_id', $this->actor()->company_id)
            ->where('status', UserStatus::Active->value);
    }

    /**
     * The active-employee rule, unless the submitted person is the one already stored.
     *
     * @return list<Exists>
     */
    protected function unlessUnchanged(?string $currentId, string $key): array
    {
        $submitted = $this->nullableId($key);

        return $currentId !== null && $submitted === $currentId ? [] : [$this->activeEmployee()];
    }

    /**
     * Upper-cased, trimmed code; empty becomes null.
     */
    protected function normalizedCode(): ?string
    {
        $code = $this->input('code');

        if (! is_string($code) || trim($code) === '') {
            return null;
        }

        return mb_strtoupper(trim($code));
    }

    protected function nullableId(string $key): ?string
    {
        $value = $this->input($key);

        return is_string($value) && $value !== '' ? $value : null;
    }
}
