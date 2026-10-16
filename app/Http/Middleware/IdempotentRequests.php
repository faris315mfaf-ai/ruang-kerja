<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Idempotent writes for the authenticated API v1 (offline-first Android app,
 * owner decision 14 Oct 2026). A POST/PUT/PATCH/DELETE that carries an
 * `Idempotency-Key` header (16–64 chars of [A-Za-z0-9_-]) is executed once
 * per (user, key): the key is claimed atomically before the handler runs and
 * completed with the stored response; a retry replays that response with
 * `Idempotent-Replayed: true` and never reaches the handler again.
 *
 * - same key, other method/path        → 422 `idempotency_conflict`
 * - same key still being processed     → 409 `idempotency_in_progress` (+ Retry-After)
 * - results stored: 2xx and deterministic 4xx (400, 403, 404, 409, 410, 422);
 *   401, 419, 429 and 5xx release the claim so a retry runs again
 * - a claim whose worker vanished without a response is taken over after
 *   STALE_AFTER_SECONDS
 *
 * The request body is never read or stored (multipart uploads stay out of the
 * table); only the response (≤ MAX_BODY_BYTES) is kept, for 72 hours
 * (`api:prune-idempotency`). Bodies are never logged.
 */
final class IdempotentRequests
{
    public const string HEADER = 'Idempotency-Key';

    public const string REPLAY_HEADER = 'Idempotent-Replayed';

    public const string TABLE = 'api_idempotency_keys';

    /** How long a stored result is kept (hours). */
    public const int RETENTION_HOURS = 72;

    /** Response bodies above this size are not stored (bytes). */
    public const int MAX_BODY_BYTES = 262_144;

    /** A claim without a result older than this is considered abandoned. */
    public const int STALE_AFTER_SECONDS = 120;

    private const string KEY_PATTERN = '/^[A-Za-z0-9_-]{16,64}$/';

    /** @var list<string> */
    private const array METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

    /** @var list<int> */
    private const array STORED_CLIENT_ERRORS = [400, 403, 404, 409, 410, 422];

    public function handle(Request $request, Closure $next): Response
    {
        $key = $request->headers->get(self::HEADER);
        $user = $request->user();

        if ($key === null || ! in_array($request->getMethod(), self::METHODS, true) || ! $user instanceof User) {
            return $next($request);
        }

        if (preg_match(self::KEY_PATTERN, $key) !== 1) {
            return $this->problem(422, 'Kunci idempotensi tidak valid.', 'idempotency_key_invalid');
        }

        $method = $request->getMethod();
        $pathHash = hash('sha256', $request->path());

        $claim = $this->claim($user->id, $key, $method, $pathHash);

        if ($claim instanceof Response) {
            return $claim;
        }

        try {
            $response = $next($request);
        } catch (Throwable $exception) {
            $this->release($claim);

            throw $exception;
        }

        $this->complete($claim, $response);

        return $response;
    }

    /**
     * The claim id when this request owns the key, otherwise the response to
     * return (replay, conflict, in progress).
     */
    private function claim(string $userId, string $key, string $method, string $pathHash): string|Response
    {
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $id = (string) Str::ulid();

            $inserted = DB::table(self::TABLE)->insertOrIgnore([
                'id' => $id,
                'user_id' => $userId,
                'key' => $key,
                'method' => $method,
                'path_hash' => $pathHash,
                'created_at' => Carbon::now(),
            ]);

            if ($inserted === 1) {
                return $id;
            }

            $found = DB::table(self::TABLE)->where('user_id', $userId)->where('key', $key)->first();

            // Released between our insert and select: claim again.
            if ($found === null) {
                continue;
            }

            /** @var array<string, mixed> $row */
            $row = (array) $found;

            if ($row['method'] !== $method || $row['path_hash'] !== $pathHash) {
                return $this->problem(422, 'Kunci idempotensi sudah dipakai untuk permintaan lain.', 'idempotency_conflict');
            }

            if ($row['completed_at'] !== null) {
                return $this->replay($row);
            }

            if (is_string($row['id']) && $this->takeOver($row['id'])) {
                return $row['id'];
            }

            return $this->problem(409, 'Permintaan yang sama masih diproses.', 'idempotency_in_progress')
                ->withHeaders(['Retry-After' => '2']);
        }

        return $this->problem(409, 'Permintaan yang sama masih diproses.', 'idempotency_in_progress')
            ->withHeaders(['Retry-After' => '2']);
    }

    /** Atomically adopts an abandoned (stale, unfinished) claim. */
    private function takeOver(string $id): bool
    {
        return DB::table(self::TABLE)
            ->where('id', $id)
            ->whereNull('completed_at')
            ->where('created_at', '<', Carbon::now()->subSeconds(self::STALE_AFTER_SECONDS))
            ->update(['created_at' => Carbon::now()]) === 1;
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function replay(array $row): Response
    {
        $status = is_numeric($row['status']) ? (int) $row['status'] : 200;
        /** @var array<string, string> $headers */
        $headers = is_string($row['response_headers']) ? (json_decode($row['response_headers'], true) ?: []) : [];

        // Body above the cap was not stored: a successful call is confirmed
        // without its payload (the app re-reads the resource if it needs it).
        if ($row['response_body'] === null) {
            $response = new JsonResponse(['message' => 'Sudah diproses.', 'replayed' => true], 200);
        } else {
            $response = new Response(is_string($row['response_body']) ? $row['response_body'] : '', $status, $headers);
        }

        $response->headers->set(self::REPLAY_HEADER, 'true');

        return $response;
    }

    private function complete(string $claim, Response $response): void
    {
        $status = $response->getStatusCode();
        $success = $status >= 200 && $status < 300;

        if (! $success && ! in_array($status, self::STORED_CLIENT_ERRORS, true)) {
            $this->release($claim);

            return;
        }

        $body = $response->getContent();

        // Streamed / file responses cannot be replayed.
        if ($body === false) {
            $this->release($claim);

            return;
        }

        if (strlen($body) > self::MAX_BODY_BYTES) {
            if (! $success) {
                $this->release($claim);

                return;
            }

            $body = null;
        }

        $headers = array_filter([
            'Content-Type' => $response->headers->get('Content-Type'),
            'Location' => $response->headers->get('Location'),
        ], fn (?string $value): bool => $value !== null);

        DB::table(self::TABLE)->where('id', $claim)->update([
            'status' => $status,
            'response_headers' => json_encode($headers, JSON_THROW_ON_ERROR),
            'response_body' => $body,
            'completed_at' => Carbon::now(),
        ]);
    }

    private function release(string $claim): void
    {
        DB::table(self::TABLE)->where('id', $claim)->whereNull('completed_at')->delete();
    }

    private function problem(int $status, string $message, string $reason): JsonResponse
    {
        return new JsonResponse(['message' => $message, 'reason' => $reason], $status);
    }
}
