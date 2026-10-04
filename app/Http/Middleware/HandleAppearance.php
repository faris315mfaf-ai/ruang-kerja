<?php

namespace App\Http\Middleware;

use App\Domain\Organization\Enums\Theme;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\View;
use Symfony\Component\HttpFoundation\Response;

class HandleAppearance
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        View::share('appearance', $this->resolveAppearance($request)->value);

        return $next($request);
    }

    /**
     * Authenticated user's saved theme wins, then the `appearance` cookie, then System.
     */
    private function resolveAppearance(Request $request): Theme
    {
        $userTheme = $request->user()?->getAttribute('theme');

        if ($userTheme !== null) {
            return Theme::fromValue($userTheme);
        }

        return Theme::fromValue($request->cookie('appearance'));
    }
}
