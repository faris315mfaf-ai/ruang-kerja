<?php

namespace App\Domain\Search\Providers;

use App\Domain\Requests\Services\ApprovalQueue;
use App\Domain\Requests\Support\RequestFormatter;
use App\Domain\Search\Contracts\SearchProvider;
use App\Domain\Search\Data\SearchResult;
use App\Domain\Search\Support\LikePattern;
use App\Models\EmployeeRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * "Pengajuan" (Sprint 4, wired in Sprint 10): the viewer's own requests and
 * the requests waiting for their decision (ApprovalQueue), by number, type,
 * requester or reason. Always inside EmployeeRequest::visibleTo($viewer).
 * Own requests open /pengajuan/{id}; requests to decide open /persetujuan/{id}.
 */
final class RequestSearchProvider implements SearchProvider
{
    public function __construct(private readonly ApprovalQueue $queue) {}

    public function key(): string
    {
        return 'requests';
    }

    public function label(): string
    {
        return 'Pengajuan';
    }

    public function minQueryLength(): int
    {
        return 2;
    }

    public function search(User $viewer, string $query, int $limit): array
    {
        $pattern = LikePattern::contains($query);
        $toDecide = $this->queue->waitingFor($viewer)->select('request_approvals.request_id');

        $requests = EmployeeRequest::query()
            ->visibleTo($viewer)
            ->where(fn (Builder $mine) => $mine
                ->where('requests.user_id', $viewer->id)
                ->orWhereIn('requests.id', $toDecide))
            ->where(fn (Builder $match) => $match
                ->where('requests.number', 'ilike', $pattern)
                ->orWhere('requests.reason', 'ilike', $pattern)
                ->orWhereHas('leaveType', fn (Builder $type) => $type->where('name', 'ilike', $pattern))
                ->orWhereHas('user', fn (Builder $user) => $user->where('name', 'ilike', $pattern)))
            ->with(['leaveType:id,name,category', 'user:id,name,avatar_url'])
            ->latest('requests.submitted_at')
            ->limit($limit)
            ->get();

        $results = [];

        foreach ($requests as $request) {
            $own = $request->user_id === $viewer->id;

            $results[] = new SearchResult(
                id: 'request:'.$request->id,
                title: $request->leaveType->name.($own ? '' : ' · '.$request->user->name),
                icon: $own ? 'request' : 'check-check',
                url: ($own ? '/pengajuan/' : '/persetujuan/').$request->id,
                code: $request->number,
                subtitle: RequestFormatter::summary($request),
                meta: $own ? $request->status->label() : 'Menunggu keputusan Anda',
            );
        }

        return $results;
    }
}
