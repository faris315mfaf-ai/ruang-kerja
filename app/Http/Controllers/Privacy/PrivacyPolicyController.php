<?php

namespace App\Http\Controllers\Privacy;

use App\Domain\Privacy\Services\PrivacyPolicy;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Public, versioned privacy policy (linked from the login page and the
 * consent screen). Content: resources/markdown/privacy-policy.md.
 */
class PrivacyPolicyController extends Controller
{
    public function __invoke(Request $request, PrivacyPolicy $policy): Response
    {
        $user = $request->user();
        $user = $user instanceof User ? $user : null;

        return Inertia::render('privacy/policy', [
            'version' => $policy->version(),
            'effective_date' => $policy->effectiveDate(),
            'html' => $policy->html($user),
            'signedIn' => $user !== null,
        ]);
    }
}
