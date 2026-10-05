<?php

namespace App\Http\Controllers\Auth;

use App\Domain\Auth\Jobs\SendSuperAdminPasswordResetLink;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Support\Facades\Password;
use Laravel\Fortify\Contracts\SuccessfulPasswordResetLinkRequestResponse;
use Laravel\Fortify\Fortify;
use Laravel\Fortify\Http\Controllers\PasswordResetLinkController as FortifyPasswordResetLinkController;
use Laravel\Fortify\Http\Requests\SendPasswordResetLinkRequest;

/**
 * Replaces Fortify's controller (container binding in FortifyServiceProvider):
 * - only active Super Admins get a link (queued job decides),
 * - every request gets the same generic status, so registered addresses are
 *   never revealed,
 * - throttled per IP (`password-reset` limiter).
 */
class PasswordResetLinkController extends FortifyPasswordResetLinkController
{
    public function __construct()
    {
        $this->middleware('throttle:password-reset')->only('store');
    }

    public function store(SendPasswordResetLinkRequest $request): Responsable
    {
        SendSuperAdminPasswordResetLink::dispatch($request->string(Fortify::email())->toString());

        return app(SuccessfulPasswordResetLinkRequestResponse::class, ['status' => Password::RESET_LINK_SENT]);
    }
}
