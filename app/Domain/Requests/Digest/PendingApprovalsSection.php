<?php

namespace App\Domain\Requests\Digest;

use App\Domain\Notifications\Digest\Contracts\DigestSection;
use App\Domain\Notifications\Digest\Data\DigestItem;
use App\Domain\Notifications\Digest\Data\DigestSectionData;
use App\Domain\Requests\Services\ApprovalQueue;
use App\Domain\Requests\Support\RequestFormatter;
use App\Models\RequestApproval;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Daily digest: "Menunggu persetujuan Anda (n)".
 */
final class PendingApprovalsSection implements DigestSection
{
    private const int LIMIT = 5;

    public function __construct(private readonly ApprovalQueue $queue) {}

    public function build(User $user, CarbonImmutable $date): ?DigestSectionData
    {
        $count = $this->queue->count($user);

        if ($count === 0) {
            return null;
        }

        $items = array_values($this->queue->waitingFor($user)
            ->with(['request.user', 'request.leaveType'])
            ->orderBy('activated_at')
            ->limit(self::LIMIT)
            ->get()
            ->map(fn (RequestApproval $step): DigestItem => new DigestItem(
                title: $step->request->user->name,
                code: $step->request->number,
                detail: RequestFormatter::summary($step->request),
                badge: $step->request->leaveType->name,
                badgeTone: 'info',
                avatarName: $step->request->user->name,
            ))
            ->all());

        $rest = $count - count($items);

        return new DigestSectionData(
            key: 'requests.pending_approval',
            title: "Menunggu persetujuan Anda ({$count})",
            tileLabel: 'Menunggu persetujuan',
            count: $count,
            items: $items,
            more: $rest > 0 ? "dan {$rest} pengajuan lainnya" : null,
        );
    }
}
