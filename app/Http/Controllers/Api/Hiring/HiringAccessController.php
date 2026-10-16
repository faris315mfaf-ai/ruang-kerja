<?php

namespace App\Http\Controllers\Api\Hiring;

use App\Domain\Hiring\Queries\HiringOverview;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;

/**
 * GET /api/v1/hiring/akses — the "Rekrutmen" row of Lainnya: whether the
 * signed-in user may enter Hiring at all (HR, Super Admin, assigned
 * interviewers / final approvers) and the badge counts. Always 200 so the
 * menu can hide the row; the Hiring screens themselves answer 404.
 */
class HiringAccessController extends Controller
{
    public function __invoke(#[CurrentUser] User $user, HiringOverview $overview): JsonResponse
    {
        $card = $overview->card($user);

        if ($card === null) {
            return response()->json(['has_access' => false, 'can_manage' => false, 'counts' => null, 'badge' => 0]);
        }

        $manager = $card['can_manage'];

        return response()->json([
            'has_access' => true,
            'can_manage' => $manager,
            'counts' => $card['counts'],
            // Manager: new applicants + candidates in "Keputusan akhir";
            // reviewer: candidates waiting for *their* decision.
            'badge' => $manager
                ? $card['counts']['new_candidates'] + $card['counts']['awaiting_decision']
                : $card['counts']['awaiting_decision'],
        ]);
    }
}
