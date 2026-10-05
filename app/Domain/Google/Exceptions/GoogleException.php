<?php

namespace App\Domain\Google\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use RuntimeException;

/**
 * Base class for Google integration failures that carry a friendly
 * Indonesian message for the UI. Messages never contain tokens or secrets.
 */
abstract class GoogleException extends RuntimeException
{
    /**
     * Indonesian message safe to show to the signed-in user.
     */
    abstract public function userMessage(): string;

    /**
     * Stable machine-readable code for the frontend (e.g. "google_not_configured").
     */
    abstract public function errorCode(): string;

    public function httpStatus(): int
    {
        return 409;
    }

    /**
     * JSON callers get `{code, message}`; Inertia/form visits go back with an error toast.
     */
    public function render(Request $request): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson()) {
            return new JsonResponse([
                'code' => $this->errorCode(),
                'message' => $this->userMessage(),
            ], $this->httpStatus());
        }

        Inertia::flash('toast', ['type' => 'error', 'message' => $this->userMessage()]);

        return back();
    }

    /**
     * Expected conditions are not reported as application errors.
     */
    public function report(): void
    {
        //
    }
}
