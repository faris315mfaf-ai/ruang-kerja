<?php

namespace App\Http\Controllers\Api\Account;

use App\Domain\Organization\Actions\SendDesktopLink;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\DesktopLinkRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;

/**
 * "Kirim tautan ke email saya" for web-only features: queues an email with
 * the absolute web URL to the CALLER's own address. The path is validated
 * against an allowlist (config/api_app_links.php); no other recipient or host
 * can be supplied.
 */
class DesktopLinkController extends Controller
{
    public function __invoke(#[CurrentUser] User $user, DesktopLinkRequest $request, SendDesktopLink $send): JsonResponse
    {
        $send->handle($user, $request->path());

        return response()->json([
            'message' => 'Tautan dikirim ke '.$user->email.'.',
            'email' => $user->email,
        ]);
    }
}
