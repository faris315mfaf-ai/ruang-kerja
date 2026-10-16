<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Models\ApprovalDelegation;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * "Delegasi saat penyetuju cuti": the signed-in approver names a stand-in for a
 * period, or changes one of their delegations (stand-in and/or dates; the
 * mobile app's "Ubah"). Same rules either way: an active colleague, no
 * overlap with another delegation of the same delegator, no cycle.
 */
final class SaveApprovalDelegation
{
    public function __construct(
        private readonly RouteToDelegates $route,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array{delegate_id: string, starts_on: string, ends_on: string, reason?: string|null}  $data
     */
    public function handle(User $delegator, array $data, ?ApprovalDelegation $existing = null): ApprovalDelegation
    {
        if ($existing !== null && $existing->delegator_id !== $delegator->id) {
            throw ValidationException::withMessages(['delegate_id' => 'Hanya pemberi delegasi yang bisa mengubah delegasi ini.']);
        }

        $delegate = User::query()->active()->where('company_id', $delegator->company_id)->find($data['delegate_id']);

        if ($delegate === null || $delegate->is($delegator)) {
            throw ValidationException::withMessages(['delegate_id' => 'Pilih rekan aktif lain sebagai delegasi.']);
        }

        $overlaps = ApprovalDelegation::query()
            ->where('delegator_id', $delegator->id)
            ->whereDate('starts_on', '<=', $data['ends_on'])
            ->whereDate('ends_on', '>=', $data['starts_on'])
            ->when($existing !== null, fn ($query) => $query->whereKeyNot($existing?->id))
            ->exists();

        if ($overlaps) {
            throw ValidationException::withMessages(['starts_on' => 'Sudah ada delegasi pada rentang tanggal ini.']);
        }

        if ($this->wouldCycle($delegator->id, $delegate->id, $data['starts_on'], $data['ends_on'])) {
            throw ValidationException::withMessages(['delegate_id' => "{$delegate->name} sudah mendelegasikan persetujuannya (langsung atau berantai) kepada Anda pada periode ini. Delegasi tidak boleh melingkar."]);
        }

        $values = [
            'delegate_id' => $delegate->id,
            'starts_on' => $data['starts_on'],
            'ends_on' => $data['ends_on'],
        ];

        if ($existing === null) {
            $delegation = ApprovalDelegation::query()->create([
                'delegator_id' => $delegator->id,
                ...$values,
                'reason' => $data['reason'] ?? null,
            ]);

            $this->audit->log('approval_delegation.created', $delegation, null, $values, $delegator);
        } else {
            $old = [
                'delegate_id' => $existing->delegate_id,
                'starts_on' => $existing->starts_on->toDateString(),
                'ends_on' => $existing->ends_on->toDateString(),
            ];
            $delegation = $existing;
            $delegation->fill([...$values, 'reason' => $data['reason'] ?? null])->save();

            $this->audit->log('approval_delegation.updated', $delegation, $old, $values, $delegator);
        }

        $this->route->handle($delegation);

        return $delegation;
    }

    /**
     * Whether the delegate already hands approvals back to the delegator, directly
     * or along a chain, in an overlapping period.
     */
    private function wouldCycle(string $delegatorId, string $delegateId, string $startsOn, string $endsOn): bool
    {
        $visited = [];
        $queue = [$delegateId];

        while ($queue !== []) {
            $current = array_shift($queue);

            if ($current === $delegatorId) {
                return true;
            }

            if (isset($visited[$current])) {
                continue;
            }

            $visited[$current] = true;

            /** @var list<string> $next */
            $next = ApprovalDelegation::query()
                ->where('delegator_id', $current)
                ->whereDate('starts_on', '<=', $endsOn)
                ->whereDate('ends_on', '>=', $startsOn)
                ->pluck('delegate_id')
                ->all();

            array_push($queue, ...$next);
        }

        return false;
    }
}
