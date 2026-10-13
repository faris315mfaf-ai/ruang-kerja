<?php

namespace App\Http\Controllers\Api\Briefings;

use App\Domain\Briefings\Actions\DelegateBriefing;
use App\Domain\Briefings\Actions\SaveBriefing;
use App\Domain\Briefings\Queries\BriefingWindow;
use App\Domain\Briefings\Queries\LatestBriefing;
use App\Http\Controllers\Controller;
use App\Http\Requests\Briefings\DelegateBriefingRequest;
use App\Http\Requests\Briefings\SaveBriefingRequest;
use App\Models\Briefing;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Writing side of the briefing for the Android app (Bagian 2 / B2-B): the
 * recording window ("Catat briefing" card), saving the minutes and appointing
 * a delegate — the web BriefingController's Actions (SaveBriefing: window,
 * recorder/delegate rule, idempotent upsert, notify once; DelegateBriefing:
 * HR / Super Admin, replaces the target, notifies the delegate) behind the
 * same BriefingPolicy gates. The window and the date are always decided by
 * the server clock; the web has no "remove delegation".
 */
class BriefingController extends Controller
{
    /**
     * Today's two windows, the saved notes, the viewer's recording right and
     * today's delegations. `jendela` is null for employees who may not record
     * (not HR / Super Admin, not appointed today) — they see no card.
     */
    public function window(#[CurrentUser] User $user, BriefingWindow $window): JsonResponse
    {
        $card = $window->card($user);

        if ($card !== null) {
            unset($card['urls']);
        }

        return response()->json([
            'jendela' => $card,
            'can_delegate' => $card !== null && Gate::forUser($user)->allows('delegate', Briefing::class),
        ]);
    }

    /**
     * Save (or replace) the note of an open period: 201 on the first save of
     * the day + period, 200 on later saves. Outside the window or for someone
     * who may not record → 422 on `period`; not a recorder at all → 403.
     */
    public function store(SaveBriefingRequest $form, #[CurrentUser] User $user, SaveBriefing $save): JsonResponse
    {
        Gate::authorize('create', Briefing::class);

        $briefing = $save->handle($user, $form->period(), $form->content());
        $briefing->loadMissing('creator:id,name');
        $created = $briefing->wasRecentlyCreated;

        return response()->json([
            'message' => $created ? 'Briefing tersimpan dan dikirim ke semua karyawan.' : 'Briefing diperbarui.',
            'created' => $created,
            'briefing' => ['id' => $briefing->id, ...LatestBriefing::present($briefing)],
        ], $created ? 201 : 200);
    }

    /**
     * HR / Super Admin appoints the recorder of today's period.
     */
    public function delegate(DelegateBriefingRequest $form, #[CurrentUser] User $user, DelegateBriefing $delegate): JsonResponse
    {
        Gate::authorize('delegate', Briefing::class);

        $target = User::query()->where('company_id', $user->company_id)->find($form->string('user_id')->toString());

        if ($target === null) {
            return response()->json(['message' => 'Karyawan tidak ditemukan.', 'errors' => ['user_id' => ['Karyawan tidak ditemukan.']]], 422);
        }

        $delegation = $delegate->handle($user, $target, $form->period());

        return response()->json([
            'message' => 'Delegasi pencatatan briefing disimpan.',
            'delegation' => [
                'date' => $delegation->briefing_date->toDateString(),
                'period' => $delegation->period->value,
                'to' => ['id' => $target->id, 'name' => $target->name],
                'by' => ['id' => $user->id, 'name' => $user->name],
            ],
        ]);
    }
}
