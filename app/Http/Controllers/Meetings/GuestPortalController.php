<?php

namespace App\Http\Controllers\Meetings;

use App\Domain\Meetings\Guests\Actions\IssueGuestVideoToken;
use App\Domain\Meetings\Guests\Actions\RequestGuestAdmission;
use App\Domain\Meetings\Guests\GuestAccessException;
use App\Domain\Meetings\Guests\Queries\GuestPortal;
use App\Domain\Meetings\Guests\Services\GuestAccess;
use App\Domain\Meetings\Guests\Services\GuestLinks;
use App\Domain\Meetings\Services\VideoRooms;
use App\Http\Controllers\Controller;
use App\Http\Requests\Meetings\GuestAdmissionRequest;
use App\Models\MeetingParticipant;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Inertia\Inertia;

/**
 * External guests, public side (docs/sesi/rapat-tamu-eksternal.md §2): the
 * personal link /tamu/{token} and its JSON endpoints under /api/tamu/{token}.
 * No account, no session needed for the JSON endpoints (no cookies / CSRF /
 * Inertia, throttled per IP and per token). Whatever the token does not
 * resolve to — unknown, rotated, revoked, deleted meeting — answers the same
 * generic 404, so nothing about meetings or guests leaks. Every answer is
 * `Cache-Control: no-store`; the page also sends no referrer.
 */
class GuestPortalController extends Controller
{
    public function __construct(
        private readonly GuestLinks $links,
        private readonly GuestAccess $access,
        private readonly GuestPortal $portal,
        private readonly VideoRooms $rooms,
    ) {}

    /** GET /tamu/{token} — the guest page (Inertia `meetings/guest`, a full document load). */
    public function page(Request $request, string $token): Response|\Symfony\Component\HttpFoundation\Response
    {
        $guest = $this->links->resolve($token);

        if ($guest === null) {
            return $this->hardened(Inertia::render('meetings/guest', ['token' => null, 'guest' => ['status' => 'unknown', 'status_label' => 'Tautan tidak dikenal']])
                ->toResponse($request)->setStatusCode(404));
        }

        $state = $this->access->inspect($guest);

        return $this->hardened(Inertia::render('meetings/guest', ['token' => $token, 'guest' => $this->portal->info($state)])->toResponse($request));
    }

    /** GET /api/tamu/{token}/info */
    public function info(string $token): JsonResponse
    {
        return $this->json($this->portal->info($this->access->inspect($this->guest($token))));
    }

    /** POST /api/tamu/{token}/minta-masuk {name} — join the waiting room. */
    public function admission(GuestAdmissionRequest $request, string $token, RequestGuestAdmission $admission): JsonResponse
    {
        $guest = $this->guest($token);

        try {
            $state = $admission->handle($guest, $request->guestName(), $request->ip());
        } catch (GuestAccessException $exception) {
            return $this->failure($exception);
        }

        return $this->json($this->portal->status($state));
    }

    /** GET /api/tamu/{token}/status — poll while waiting (every {@see GuestPortal::POLL_SECONDS} s). */
    public function status(string $token): JsonResponse
    {
        return $this->json($this->portal->status($this->access->inspect($this->guest($token))));
    }

    /** POST /api/tamu/{token}/token — LiveKit token once admitted. */
    public function token(string $token, IssueGuestVideoToken $issue): JsonResponse
    {
        $guest = $this->guest($token);

        if (! $this->rooms->configured()) {
            return $this->json(['message' => 'Video RuangKerja belum disiapkan di server ini.', 'code' => 'video_belum_siap'], 503);
        }

        try {
            $payload = $issue->handle($guest);
        } catch (GuestAccessException $exception) {
            return $this->failure($exception);
        }

        return $this->json([
            ...$payload,
            'role' => 'guest',
            'can' => ['moderate' => false, 'call_participants' => false, 'edit_minutes' => false],
        ]);
    }

    private function guest(string $token): MeetingParticipant
    {
        $guest = $this->links->resolve($token);

        if ($guest === null) {
            throw new HttpResponseException($this->json(['message' => 'Tautan tidak dikenal.', 'code' => 'tidak_dikenal'], 404));
        }

        return $guest;
    }

    private function failure(GuestAccessException $exception): JsonResponse
    {
        return $this->json(['message' => $exception->getMessage(), 'code' => $exception->reason], $exception->status);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function json(array $data, int $status = 200): JsonResponse
    {
        return response()->json($data, $status)->header('Cache-Control', 'no-store');
    }

    private function hardened(\Symfony\Component\HttpFoundation\Response $response): \Symfony\Component\HttpFoundation\Response
    {
        $response->headers->set('Cache-Control', 'no-store, private');
        $response->headers->set('Referrer-Policy', 'no-referrer');
        $response->headers->set('X-Robots-Tag', 'noindex, nofollow');

        return $response;
    }
}
