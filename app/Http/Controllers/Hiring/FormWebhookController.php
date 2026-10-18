<?php

namespace App\Http\Controllers\Hiring;

use App\Domain\Hiring\Actions\ReceiveFormSubmission;
use App\Domain\Hiring\Services\WebhookSignature;
use App\Domain\Tenancy\CompanyContext;
use App\Http\Controllers\Controller;
use App\Models\HiringPosition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * POST /api/hiring/form/{token}: a Google Form response pushed by the Apps
 * Script of docs/fitur/hiring.md. No session, cookies or CSRF; the body must
 * be signed with the position's secret (X-RuangKerja-Signature, HMAC-SHA256).
 *
 * 404 unknown token · 401 bad signature · 410 position closed · 413 too large
 * · 422 invalid body · 201 new candidate · 200 already received (retry).
 * Applicant data is never logged.
 */
class FormWebhookController extends Controller
{
    public const int MAX_BODY_BYTES = 512 * 1024;

    public function __invoke(Request $request, string $token, ReceiveFormSubmission $receive): JsonResponse
    {
        $position = HiringPosition::query()->where('webhook_token', $token)->first();

        if ($position === null) {
            return response()->json(['message' => 'Tautan formulir tidak dikenal.'], 404);
        }

        // Public webhook: run in the position's company (Fase 1 CompanyContext).
        app(CompanyContext::class)->set($position->company_id);

        $body = $request->getContent();

        if (strlen($body) > self::MAX_BODY_BYTES) {
            return response()->json(['message' => 'Isi kiriman terlalu besar.'], 413);
        }

        if (! WebhookSignature::verify($body, $position->webhook_secret, $request->header(WebhookSignature::HEADER))) {
            return response()->json(['message' => 'Tanda tangan tidak valid.'], 401);
        }

        if (! $position->status->acceptsApplicants()) {
            return response()->json(['message' => 'Lowongan ini sudah ditutup.'], 410);
        }

        $payload = json_decode($body, true);

        if (! is_array($payload)) {
            return response()->json(['message' => 'Isi kiriman harus JSON.'], 422);
        }

        $validator = Validator::make($payload, [
            'response_id' => ['required', 'string', 'max:191'],
            'submitted_at' => ['nullable', 'string', 'max:64'],
            'answers' => ['sometimes', 'array', 'max:200'],
            'files' => ['sometimes', 'nullable', 'array', 'max:50'],
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Isi kiriman tidak lengkap.', 'errors' => $validator->errors()], 422);
        }

        /** @var array{response_id: string, submitted_at?: string|null, answers?: array<array-key, mixed>, files?: array<array-key, mixed>|null} $payload */
        $result = $receive->handle($position, [
            'response_id' => $payload['response_id'],
            'submitted_at' => $payload['submitted_at'] ?? null,
            'answers' => $payload['answers'] ?? [],
            'files' => $payload['files'] ?? [],
        ]);

        return response()->json([
            'status' => $result['created'] ? 'created' : 'duplicate',
            'candidate_id' => $result['candidate']->id,
        ], $result['created'] ? 201 : 200);
    }
}
