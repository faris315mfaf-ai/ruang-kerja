<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Organization\Mail\DesktopLinkMail;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Illuminate\Support\Facades\Mail;

/**
 * Mails the signed-in user a link to a web-only page. The recipient is ALWAYS
 * the user's own address (never a request parameter); the caller has already
 * checked the path against config('api_app_links.allowed_paths').
 */
final class SendDesktopLink
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(User $user, string $path): string
    {
        $url = rtrim(config()->string('app.url'), '/').$path;

        Mail::to($user->email)->queue(new DesktopLinkMail($user->name, $url));

        $this->audit->log('account.desktop_link_sent', $user, null, ['path' => $path], $user);

        return $url;
    }
}
