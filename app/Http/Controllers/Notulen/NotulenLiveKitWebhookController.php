<?php

namespace App\Http\Controllers\Notulen;

use App\Domain\Meetings\Services\LiveKitTokens;
use App\Domain\Meetings\Transcripts\Actions\HandleNotulenRoomEvent;
use App\Domain\Meetings\Transcripts\Services\NotulenConfig;
use App\Http\Controllers\Controller;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * POST /api/notulen/livekit: a second LiveKit webhook URL (livekit.yaml
 * `webhook.urls`) that starts/finishes the hidden recorder for meetings
 * with auto_minutes. Same verification as the attendance webhook
 * (LiveKitTokens::verifyWebhook: JWT with the API key pair + body sha256),
 * stale events refused, each event id handled once.
 */
class NotulenLiveKitWebhookController extends Controller
{
    public const int MAX_BODY_BYTES = 64 * 1024;

    public function __invoke(Request $request, NotulenConfig $config, LiveKitTokens $tokens, HandleNotulenRoomEvent $handle): JsonResponse
    {
        if (! $config->configured()) {
            return response()->json(['message' => 'Notulen otomatis belum disiapkan.'], 404);
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

        if ($id !== '' && ! Cache::add('notulen:livekit:'.hash('sha256', $id), true, $tolerance * 2)) {
            return response()->json(['status' => 'duplicate']);
        }

        return response()->json(['status' => $handle->handle($event)]);
    }
}
