<?php

namespace App\Http\Controllers\Api\Meetings;

use App\Domain\Meetings\Actions\UpdateRsvp;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\MeetingRsvpRequest;
use App\Models\Meeting;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * POST /api/v1/rapat/{meeting}/kehadiran — "Kehadiran Anda": the token
 * owner answers their own invitation (Hadir / Mungkin / Tidak hadir), the
 * web UpdateRsvp action unchanged (the answer applies to the whole series,
 * like the web). MeetingPolicy::respond keeps the same verdicts as the web
 * JSON endpoint: an invisible meeting 404, a non-participant 403 with the
 * web message, and the body {rsvp} is identical.
 */
class RsvpController extends Controller
{
    public function store(MeetingRsvpRequest $request, Meeting $meeting, #[CurrentUser] User $user, UpdateRsvp $rsvp): JsonResponse
    {
        Gate::authorize('respond', $meeting);

        $participant = $rsvp->handle($meeting, $user, $request->rsvp());

        return response()->json(['rsvp' => $participant->rsvp->value]);
    }
}
