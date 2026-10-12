<?php

namespace App\Http\Controllers\Api\Privacy;

use App\Domain\Privacy\Actions\ExportMyData;
use App\Domain\Privacy\Services\ConsentOverview;
use App\Domain\Privacy\Services\MyData;
use App\Domain\Privacy\Services\PrivacyPolicy;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\MyDataExportRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

/**
 * "Privasi & Data Saya" for the mobile app (UU PDP right of access): the
 * signed-in user's own data only — every query inside MyData is keyed by the
 * caller's id, there is no id/user parameter. Same figures as the web page
 * (profile with NIK always masked, consent, attendance totals + latest days,
 * requests, approval decisions); the export streams the very same workbook /
 * PDF as the web (audited as `privacy.data_exported`).
 */
class MyDataController extends Controller
{
    public function show(
        #[CurrentUser] User $user,
        MyData $data,
        PrivacyPolicy $policy,
        ConsentOverview $consent,
    ): JsonResponse {
        Gate::authorize('viewOwnData');

        return response()->json([
            'policy' => ['version' => $policy->version(), 'effective_date' => $policy->effectiveDate()],
            'profile' => $data->profile($user),
            'consent' => $consent->for($user),
            'status_labels' => MyData::statusLabels(),
            'attendance' => $data->attendance($user, config()->integer('privacy.page.attendance_days')),
            'requests' => $data->requests($user, config()->integer('privacy.page.requests')),
            'decisions' => $data->decisions($user, config()->integer('privacy.page.decisions')),
        ]);
    }

    public function export(#[CurrentUser] User $user, MyDataExportRequest $request, ExportMyData $export): Response
    {
        Gate::authorize('viewOwnData');

        return $export->handle($user, $request->exportFormat());
    }
}
