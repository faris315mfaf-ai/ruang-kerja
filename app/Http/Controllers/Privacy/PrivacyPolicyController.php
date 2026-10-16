<?php

namespace App\Http\Controllers\Privacy;

use App\Domain\Privacy\Services\PrivacyPolicy;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Privacy policy, versioned (linked from the login page and the consent
 * screen). Guests (Play Store reviewers, applicants) get a standalone Blade
 * page: no account, no Inertia shell, no JS required. Signed-in employees
 * keep the in-app Inertia page rendering resources/markdown/privacy-policy.md.
 */
class PrivacyPolicyController extends Controller
{
    public function __invoke(Request $request, PrivacyPolicy $policy): Response|View
    {
        $user = $request->user();
        $user = $user instanceof User ? $user : null;

        if ($user === null) {
            return view('privacy.public', [
                'version' => $policy->version(),
                'effectiveDate' => $policy->effectiveDate(),
                'appName' => config()->string('branding.name', config()->string('app.name')),
                'companyName' => config()->string('branding.company_name', '[Nama Perusahaan]'),
                'contact' => config()->string('privacy.policy.contact'),
                'selfieRetentionMonths' => config()->integer('attendance.selfie.retention_months'),
                'transcriptRetentionDays' => config()->integer('notulen.retention_days', 90),
            ]);
        }

        return Inertia::render('privacy/policy', [
            'version' => $policy->version(),
            'effective_date' => $policy->effectiveDate(),
            'html' => $policy->html($user),
            'signedIn' => true,
        ]);
    }
}
