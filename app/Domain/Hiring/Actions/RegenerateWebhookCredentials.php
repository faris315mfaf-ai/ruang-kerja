<?php

namespace App\Domain\Hiring\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Models\HiringPosition;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * New webhook URL token and secret for a position. The secret is returned
 * once (shown to HR to paste into the Apps Script) and stored encrypted; the
 * old URL stops working immediately.
 */
final class RegenerateWebhookCredentials
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @return array{url: string, secret: string}
     */
    public function handle(User $actor, HiringPosition $position): array
    {
        $secret = Str::random(48);

        $position->forceFill([
            'webhook_token' => CreateHiringPosition::token(),
            'webhook_secret' => $secret,
        ])->save();

        // Never the secret itself (AuditLogger masks *secret* keys anyway).
        $this->audit->log('hiring.webhook_regenerated', $position, null, null, $actor);

        return ['url' => $position->webhookUrl(), 'secret' => $secret];
    }
}
