<?php

namespace App\Domain\Organization\Support;

use Closure;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Validation\ValidationException;

/**
 * Turns a unique-index violation into a validation error. FormRequests check
 * uniqueness first, but two simultaneous saves can both pass validation; the
 * database index then decides and the loser gets the same friendly message
 * instead of a 500.
 */
final class UniqueViolations
{
    /**
     * @template T
     *
     * @param  Closure(): T  $callback  usually the DB::transaction(...) call
     * @param  array<string, array{0: string, 1: string}>  $messages  index name → [field, message]
     * @return T
     *
     * @throws ValidationException
     */
    public static function asValidation(Closure $callback, array $messages): mixed
    {
        try {
            return $callback();
        } catch (UniqueConstraintViolationException $exception) {
            foreach ($messages as $index => [$field, $message]) {
                if (str_contains($exception->getMessage(), $index)) {
                    throw ValidationException::withMessages([$field => $message]);
                }
            }

            throw $exception;
        }
    }
}
