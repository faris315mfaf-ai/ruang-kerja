<?php

namespace App\Http\Controllers\Api\Requests;

use App\Domain\Requests\Actions\DeleteApprovalDelegation;
use App\Domain\Requests\Actions\SaveApprovalDelegation;
use App\Domain\Requests\Support\OfficeTime;
use App\Http\Controllers\Api\Requests\Concerns\AuthorizesRequests;
use App\Http\Controllers\Controller;
use App\Http\Presenters\RequestPresenter;
use App\Http\Requests\Api\Pengajuan\UpdateDelegationApiRequest;
use App\Http\Requests\Requests\SaveApprovalDelegationRequest;
use App\Models\ApprovalDelegation;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

/**
 * "Delegasi saat penyetuju cuti" of the mobile app: my delegations (current
 * and upcoming) plus the ones I received ("Mewakili X"); create / change /
 * end through the web actions (SaveApprovalDelegation: active colleague,
 * not myself, no overlap, no cycle; RouteToDelegates moves waiting steps,
 * respecting the flow's allow_delegation). The colleague picker is
 * GET /orang.
 */
class ApprovalDelegationController extends Controller
{
    use AuthorizesRequests;

    public function index(#[CurrentUser] User $user): JsonResponse
    {
        $this->allow($user, 'viewAny', ApprovalDelegation::class, 'Akun Anda tidak bisa membuka delegasi.');

        $today = OfficeTime::todayString();

        $mine = ApprovalDelegation::query()
            ->where('delegator_id', $user->id)
            ->whereDate('ends_on', '>=', $today)
            ->with('delegate.position', 'delegate.division')
            ->orderBy('starts_on')
            ->get();

        $received = ApprovalDelegation::query()
            ->where('delegate_id', $user->id)
            ->whereDate('ends_on', '>=', $today)
            ->with('delegator.position', 'delegator.division')
            ->orderBy('starts_on')
            ->get();

        return response()->json([
            'today' => $today,
            'mine' => $mine->map(fn (ApprovalDelegation $delegation): array => self::item($delegation, $today))->values()->all(),
            'received' => $received->map(fn (ApprovalDelegation $delegation): array => self::item($delegation, $today))->values()->all(),
        ]);
    }

    public function store(SaveApprovalDelegationRequest $form, #[CurrentUser] User $user, SaveApprovalDelegation $save): JsonResponse
    {
        $this->allow($user, 'create', ApprovalDelegation::class, 'Akun Anda tidak bisa membuat delegasi.');

        $delegation = $save->handle($user, $form->delegationData());

        return response()->json(['delegation' => self::item($delegation->load(['delegator.position', 'delegator.division', 'delegate.position', 'delegate.division']), OfficeTime::todayString())], 201);
    }

    public function update(UpdateDelegationApiRequest $form, #[CurrentUser] User $user, ApprovalDelegation $delegation, SaveApprovalDelegation $save): JsonResponse
    {
        $this->found($user, $delegation);
        $this->allow($user, 'update', $delegation, 'Hanya pemberi delegasi yang bisa mengubah delegasi ini.');

        $delegation = $save->handle($user, $form->delegationData(), $delegation);

        return response()->json(['delegation' => self::item($delegation->load(['delegator.position', 'delegator.division', 'delegate.position', 'delegate.division']), OfficeTime::todayString())]);
    }

    public function destroy(#[CurrentUser] User $user, ApprovalDelegation $delegation, DeleteApprovalDelegation $delete): Response
    {
        $this->found($user, $delegation);
        $this->allow($user, 'delete', $delegation, 'Hanya pemberi delegasi atau HR yang bisa menghentikan delegasi ini.');

        $delete->handle($user, $delegation);

        return response()->noContent();
    }

    private function found(User $user, ApprovalDelegation $delegation): void
    {
        if (Gate::forUser($user)->denies('view', $delegation)) {
            abort(404);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private static function item(ApprovalDelegation $delegation, string $today): array
    {
        return [
            'id' => $delegation->id,
            'delegator' => RequestPresenter::person($delegation->delegator),
            'delegate' => RequestPresenter::person($delegation->delegate),
            'starts_on' => $delegation->starts_on->toDateString(),
            'ends_on' => $delegation->ends_on->toDateString(),
            'reason' => $delegation->reason,
            'active' => $delegation->starts_on->toDateString() <= $today && $delegation->ends_on->toDateString() >= $today,
        ];
    }
}
