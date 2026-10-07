<?php

namespace App\Http\Controllers\Notulen;

use App\Domain\Meetings\Transcripts\Actions\RecordTranscriptUpdate;
use App\Domain\Meetings\Transcripts\Services\NotulenConfig;
use App\Domain\Meetings\Transcripts\Services\NotulenSignature;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * POST /api/notulen/transcript: status and transcripts from the transcriber
 * worker. No session, cookies or CSRF; authenticity = HMAC with
 * TRANSCRIBER_SECRET over "<timestamp>.<body>" (NotulenSignature), 5-minute
 * window, each signature accepted once. 404 not configured · 413 too large ·
 * 401 bad/stale/replayed signature · 422 not JSON · 200 recorded/ignored.
 */
class TranscriptIngestController extends Controller
{
    public function __invoke(Request $request, NotulenConfig $config, NotulenSignature $signature, RecordTranscriptUpdate $record): JsonResponse
    {
        if (! $config->configured()) {
            return response()->json(['message' => 'Notulen otomatis belum disiapkan.'], 404);
        }

        $body = $request->getContent();

        if (strlen($body) > max(1024, (int) config('notulen.transcriber.max_body_bytes'))) {
            return response()->json(['message' => 'Isi kiriman terlalu besar.'], 413);
        }

        $problem = $signature->verify(
            $body,
            $request->header(NotulenSignature::TIMESTAMP_HEADER),
            $request->header(NotulenSignature::SIGNATURE_HEADER),
        );

        if ($problem !== null) {
            return response()->json(['message' => 'Tanda tangan tidak valid.', 'reason' => $problem], 401);
        }

        $payload = json_decode($body, true);

        if (! is_array($payload) || array_is_list($payload)) {
            return response()->json(['message' => 'Isi kiriman harus JSON.'], 422);
        }

        return response()->json(['status' => $record->handle($payload)]);
    }
}
