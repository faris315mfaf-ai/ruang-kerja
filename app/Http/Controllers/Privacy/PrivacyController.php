<?php

namespace App\Http\Controllers\Privacy;

use App\Domain\Privacy\Actions\ExportMyData;
use App\Domain\Privacy\Services\MyData;
use App\Domain\Privacy\Services\PrivacyPolicy;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * Privasi › Data Saya: view and export the signed-in user's own data
 * (profile, consent, attendance, requests, approval decisions).
 */
class PrivacyController extends Controller
{
    public function index(#[CurrentUser] User $user, MyData $data, PrivacyPolicy $policy): Response
    {
        Gate::authorize('viewOwnData');

        return Inertia::render('privacy/index', [
            'policy' => ['version' => $policy->version(), 'effective_date' => $policy->effectiveDate()],
            'profile' => $data->profile($user),
            'consent' => $data->consent($user),
            'statusLabels' => MyData::statusLabels(),
            'attendance' => Inertia::defer(fn (): array => $data->attendance($user, config()->integer('privacy.page.attendance_days'))),
            'requests' => Inertia::defer(fn (): array => $data->requests($user, config()->integer('privacy.page.requests')), 'approvals'),
            'decisions' => Inertia::defer(fn (): array => $data->decisions($user, config()->integer('privacy.page.decisions')), 'approvals'),
        ]);
    }

    /**
     * @param  'xlsx'|'pdf'  $format
     */
    public function export(#[CurrentUser] User $user, string $format, ExportMyData $export): HttpResponse
    {
        Gate::authorize('viewOwnData');

        return $export->handle($user, $format);
    }
}
