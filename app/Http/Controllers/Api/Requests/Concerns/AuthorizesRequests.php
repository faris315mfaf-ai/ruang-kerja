<?php

namespace App\Http\Controllers\Api\Requests\Concerns;

use App\Models\EmployeeRequest;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Gate;

/**
 * Policy checks of the request API with Indonesian 403 messages (a bare
 * Gate::authorize answers Laravel's English default) and 404 for a request
 * the caller may not see at all — its existence never leaks.
 */
trait AuthorizesRequests
{
    protected function visible(User $user, EmployeeRequest $request): void
    {
        if (Gate::forUser($user)->denies('view', $request)) {
            abort(404);
        }
    }

    /**
     * @throws AuthorizationException
     */
    protected function allow(User $user, string $ability, mixed $subject, string $message): void
    {
        if (Gate::forUser($user)->denies($ability, $subject)) {
            throw new AuthorizationException($message);
        }
    }
}
