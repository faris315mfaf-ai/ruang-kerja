<?php

namespace App\Domain\Privacy\Actions;

use App\Domain\Analytics\Exports\DashboardExport;
use App\Domain\Analytics\Exports\DashboardSheet;
use App\Domain\Attendance\Support\OfficeClock;
use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Privacy\Exports\MyDataSections;
use App\Domain\Privacy\Services\PrivacyPolicy;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\Response;

/**
 * "Unduh data saya" (UU PDP right of access): the user's own data as Excel
 * (one worksheet per kind of data) or PDF. Every export is audited.
 */
final class ExportMyData
{
    public function __construct(
        private readonly MyDataSections $sections,
        private readonly PrivacyPolicy $policy,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  'xlsx'|'pdf'  $format
     */
    public function handle(User $user, string $format): Response
    {
        $sections = $this->sections->build($user);
        $now = CarbonImmutable::now();
        $filename = 'data-saya-'.Str::slug($user->name).'-'.OfficeClock::local($now)->format('Ymd').'.'.$format;

        $this->audit->log('privacy.data_exported', $user, null, [
            'format' => $format,
            'rows' => array_combine(
                array_column($sections, 'title'),
                array_map(fn (array $section): int => count($section['rows']), $sections),
            ),
        ], $user);

        if ($format === 'pdf') {
            return Pdf::loadView('exports.my-data', [
                'title' => 'Data saya · '.$user->name,
                'generatedAt' => OfficeClock::date($now).' '.OfficeClock::time($now),
                'policyVersion' => $this->policy->version(),
                'sections' => $sections,
            ])
                ->setPaper('a4', 'landscape')
                ->download($filename);
        }

        return Excel::download(new DashboardExport(array_map(
            fn (array $section): DashboardSheet => new DashboardSheet($section['title'], $section['headings'], $section['rows']),
            $sections,
        )), $filename);
    }
}
