<?php

namespace App\Domain\Google\Exceptions;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * A Google API call failed. Carries only status, reason and Google's error
 * message (never request headers, so never tokens).
 */
final class DriveRequestFailed extends GoogleException
{
    public function __construct(
        public readonly string $operation,
        public readonly int $status,
        public readonly ?string $reason = null,
        string $message = '',
        public readonly ?int $retryAfter = null,
    ) {
        parent::__construct(trim("Google request [{$operation}] failed with status {$status}".($reason ? " ({$reason})" : '').($message !== '' ? ': '.$message : '')));
    }

    public static function fromResponse(string $operation, Response $response): self
    {
        $error = $response->json('error');
        $reason = null;
        $message = '';

        if (is_array($error)) {
            $first = $error['errors'][0] ?? null;
            $reason = is_array($first) && is_string($first['reason'] ?? null)
                ? $first['reason']
                : (is_string($error['status'] ?? null) ? $error['status'] : null);
            $message = is_string($error['message'] ?? null) ? $error['message'] : '';
        } elseif (is_string($error)) {
            // OAuth token endpoint: {"error": "invalid_grant", "error_description": "..."}
            $reason = $error;
            $description = $response->json('error_description');
            $message = is_string($description) ? $description : '';
        }

        $retryAfter = $response->header('Retry-After');

        return new self(
            $operation,
            $response->status(),
            $reason,
            Str::limit($message, 300),
            is_numeric($retryAfter) ? max(0, (int) $retryAfter) : null,
        );
    }

    public static function fromConnection(string $operation, ConnectionException $exception): self
    {
        return new self($operation, 0, 'connection', Str::limit($exception->getMessage(), 200));
    }

    public function isRateLimited(): bool
    {
        if ($this->status === 429) {
            return true;
        }

        /** @var list<string> $reasons */
        $reasons = config('google.retry.rate_limit_reasons', []);

        return $this->status === 403 && in_array($this->reason, $reasons, true);
    }

    public function isServerError(): bool
    {
        return $this->status >= 500 || $this->status === 0 || $this->status === 408;
    }

    public function isRetryable(): bool
    {
        return $this->isRateLimited() || $this->isServerError();
    }

    public function isNotFound(): bool
    {
        return $this->status === 404;
    }

    public function isUnauthorized(): bool
    {
        return $this->status === 401;
    }

    public function userMessage(): string
    {
        return match (true) {
            $this->isRateLimited() => 'Google Drive sedang sibuk. Coba lagi beberapa saat lagi.',
            $this->status === 0 || $this->status === 408 => 'Google Drive tidak merespons. Coba lagi beberapa saat lagi.',
            $this->isNotFound() => 'File atau folder tidak ditemukan di Google Drive, atau Anda tidak punya akses.',
            $this->status === 403 || $this->status === 401 => 'Akses ke Google Drive ditolak. Hubungi admin RuangKerja.',
            default => 'Terjadi galat saat menghubungi Google Drive. Coba lagi.',
        };
    }

    public function errorCode(): string
    {
        return $this->isRateLimited() ? 'drive_rate_limited' : 'drive_request_failed';
    }

    public function httpStatus(): int
    {
        return $this->isRateLimited() ? 429 : 502;
    }

    /**
     * Safe log context (no tokens, no URLs with capabilities).
     *
     * @return array{operation: string, status: int, reason: string|null}
     */
    public function context(): array
    {
        return ['operation' => $this->operation, 'status' => $this->status, 'reason' => $this->reason];
    }

    /**
     * Failures during a web request (e.g. creating a document) are logged as warnings.
     */
    public function report(): void
    {
        Log::warning('google.request_failed', $this->context());
    }
}
