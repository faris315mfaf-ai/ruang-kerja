<?php

namespace App\Domain\Google\Jobs\Concerns;

use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Exceptions\GoogleException;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Domain\Google\Services\GoogleBackoff;
use Closure;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Log;

/**
 * Shared retry policy for Google jobs (config google.retry):
 * - Google not configured → log once at info level and finish (no-op);
 * - rate limit (429 / 403 rate reasons), 5xx, timeouts → release() with
 *   exponential backoff honouring Retry-After, until `tries` is reached;
 * - any other Google error (404, 403 forbidden, 400, too large, reconnect
 *   required) → fail permanently.
 * Logs carry operation/status/reason only, never tokens.
 *
 * @phpstan-require-implements ShouldQueue
 */
trait HandlesGoogleFailures
{
    public function tries(): int
    {
        return max(1, (int) config('google.retry.tries', 6));
    }

    /**
     * Backoff for unexpected (non-Google) exceptions thrown by the job.
     *
     * @return list<int>
     */
    public function backoff(): array
    {
        return GoogleBackoff::schedule($this->tries());
    }

    /**
     * Short identifier of what the job works on, for logs.
     */
    abstract protected function subject(): string;

    /**
     * @template TResult
     *
     * @param  Closure(): TResult  $callback
     * @param  (Closure(DriveRequestFailed): bool)|null  $handleNotFound  return true when the 404 was handled
     * @return TResult|null null when the job was released, failed or skipped
     */
    protected function runGoogle(Closure $callback, ?Closure $handleNotFound = null): mixed
    {
        try {
            return $callback();
        } catch (GoogleNotConfigured $exception) {
            Log::info('google.job.skipped', [
                'job' => class_basename($this),
                'subject' => $this->subject(),
                'missing' => $exception->missing,
            ]);

            return null;
        } catch (DriveRequestFailed $exception) {
            $context = $exception->context() + [
                'job' => class_basename($this),
                'subject' => $this->subject(),
                'attempt' => $this->attempts(),
            ];

            if ($exception->isNotFound() && $handleNotFound !== null && $handleNotFound($exception)) {
                return null;
            }

            if ($exception->isRetryable() && $this->attempts() < $this->tries()) {
                $delay = GoogleBackoff::delay($this->attempts(), $exception->retryAfter);

                Log::warning('google.job.retrying', $context + ['delay' => $delay]);
                $this->release($delay);

                return null;
            }

            Log::error('google.job.failed', $context);
            $this->fail($exception);

            return null;
        } catch (GoogleException $exception) {
            Log::error('google.job.failed', [
                'job' => class_basename($this),
                'subject' => $this->subject(),
                'code' => $exception->errorCode(),
            ]);
            $this->fail($exception);

            return null;
        }
    }
}
