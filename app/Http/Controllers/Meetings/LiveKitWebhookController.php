<?php

namespace App\Http\Controllers\Meetings;

use App\Domain\Meetings\Actions\RecordVideoEvent;
use App\Domain\Meetings\Services\LiveKitTokens;
use App\Domain\Meetings\Services\VideoRooms;
use App\Http\Controllers\Controller;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * POST /api/livekit/webhook: LiveKit room events (livekit.yaml `webhook`).
 * No session, cookies or CSRF; the request must carry LiveKit's signature —
 * an Authorization JWT signed with the API key pair whose `sha256` claim is
 * the body hash (LiveKitTokens::verifyWebhook).
 *
 * Replays: the JWT expires after 5 minutes, events older than
 * `livekit.webhook_tolerance` seconds are refused, and an event id is
 * processed once (cache). 404 not configured · 413 too large · 401 bad
 * signature · 422 not JSON / stale · 200 recorded, ignored or duplicate.
 */
class LiveKitWebhookController extends Controller
{
    public const int MAX_BODY_BYTES = 64 * 1024;

    public function __invoke(Request $request, VideoRooms $rooms, LiveKitTokens $tokens, RecordVideoEvent $record): JsonResponse
    {
        if (! $rooms->configured()) {
            return response()->json(['message' => 'Video RuangKerja belum disiapkan.'], 404);
        }

        $body = $request->getContent();

        if (strlen($body) > self::MAX_BODY_BYTES) {
            return response()->json(['message' => 'Isi kiriman terlalu besar.'], 413);
        }

        if ($tokens->verifyWebhook($body, $request->header('Authorization')) === null) {
            return response()->json(['message' => 'Tanda tangan tidak valid.'], 401);
        }

        $event = json_decode($body, true);

        if (! is_array($event)) {
            return response()->json(['message' => 'Isi kiriman harus JSON.'], 422);
        }

        $tolerance = max(30, (int) config('livekit.webhook_tolerance', 300));
        $createdAt = $event['createdAt'] ?? $event['created_at'] ?? null;

        if (is_numeric($createdAt) && abs(CarbonImmutable::now()->getTimestamp() - (int) $createdAt) > $tolerance) {
            return response()->json(['message' => 'Kejadian sudah kedaluwarsa.'], 422);
        }

        $id = is_string($event['id'] ?? null) ? $event['id'] : '';

        if ($id !== '' && ! Cache::add('livekit:webhook:'.hash('sha256', $id), true, $tolerance * 2)) {
            return response()->json(['status' => 'duplicate']);
        }

        return response()->json(['status' => $record->handle($event) ? 'recorded' : 'ignored']);
    }
}
