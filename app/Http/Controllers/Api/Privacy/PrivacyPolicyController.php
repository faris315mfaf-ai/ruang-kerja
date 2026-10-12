<?php

namespace App\Http\Controllers\Api\Privacy;

use App\Domain\Privacy\Services\PolicyDocument;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/**
 * The privacy policy as JSON (public, no sign-in: Play Store review and the
 * login screen link to it). Same Markdown source as the web page.
 */
class PrivacyPolicyController extends Controller
{
    public function __invoke(PolicyDocument $document): JsonResponse
    {
        return response()->json($document->toArray())
            ->header('Cache-Control', 'public, max-age=300');
    }
}
