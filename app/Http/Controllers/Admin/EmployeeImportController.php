<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Organization\Actions\CommitEmployeeImport;
use App\Domain\Organization\Actions\PreviewEmployeeImport;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\WorkMode;
use App\Domain\Organization\Exports\EmployeeImportTemplate;
use App\Domain\Organization\Imports\EmployeeImportValidator;
use App\Domain\Organization\Imports\EmployeeSheetReader;
use App\Domain\Organization\Services\EmployeeImportStore;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\EmployeeImportRequest;
use App\Models\Company;
use App\Models\Division;
use App\Models\Position;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Excel as ExcelType;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Admin › Karyawan › Impor: template → upload → dry-run preview → commit.
 */
class EmployeeImportController extends Controller
{
    public function show(Request $request, #[CurrentUser] User $user, EmployeeImportStore $store): Response
    {
        Gate::authorize('manage', User::class);

        $token = $request->string('token')->toString();
        $state = $token === '' ? null : $store->get($token, $user);

        return Inertia::render('admin/employees/import', [
            'token' => $state === null ? null : $token,
            'fileName' => $state['name'] ?? null,
            'preview' => $state['preview'] ?? null,
            'result' => $state['result'] ?? null,
            'expired' => $token !== '' && $state === null,
            'reference' => [
                'columns' => EmployeeImportValidator::COLUMNS,
                'required' => EmployeeImportValidator::REQUIRED_COLUMNS,
                'maxRows' => EmployeeSheetReader::MAX_ROWS,
                'maxKilobytes' => EmployeeImportRequest::MAX_KILOBYTES,
                'companyDomain' => Company::query()->findOrFail($user->company_id)->google_domain,
                'divisions' => Division::query()->visibleTo($user)->orderBy('name')->get(['code', 'name'])
                    ->map(fn (Division $division): array => $division->only(['code', 'name']))->all(),
                'positions' => Position::query()->visibleTo($user)->orderBy('level')->orderBy('name')->pluck('name')->all(),
                'roles' => array_map(fn (Role $role): array => ['value' => $role->value, 'label' => $role->label()], Role::cases()),
                'workModes' => WorkMode::options(),
            ],
        ]);
    }

    public function template(string $format, #[CurrentUser] User $user): BinaryFileResponse
    {
        Gate::authorize('manage', User::class);

        return Excel::download(
            new EmployeeImportTemplate(Company::query()->findOrFail($user->company_id)),
            "templat-impor-karyawan.{$format}",
            $format === 'xlsx' ? ExcelType::XLSX : ExcelType::CSV,
        );
    }

    public function preview(
        EmployeeImportRequest $request,
        #[CurrentUser] User $user,
        EmployeeImportStore $store,
        PreviewEmployeeImport $previewImport,
    ): RedirectResponse {
        Gate::authorize('manage', User::class);

        $file = $request->file('file');
        abort_unless($file instanceof UploadedFile, 422);

        $token = $store->put($file, $user);
        $state = $store->get($token, $user);
        abort_if($state === null || $state['path'] === false, 500);

        $report = $previewImport->handle($user, EmployeeImportStore::DISK, $state['path']);
        $store->update($token, ['preview' => $report->toArray()]);

        return to_route('admin.employees.import', ['token' => $token]);
    }

    public function commit(
        string $token,
        #[CurrentUser] User $user,
        EmployeeImportStore $store,
        CommitEmployeeImport $commitImport,
    ): RedirectResponse {
        Gate::authorize('manage', User::class);

        $state = $store->get($token, $user);

        if ($state === null || $state['path'] === false) {
            Inertia::flash('toast', ['type' => 'error', 'message' => 'Sesi impor sudah kedaluwarsa. Unggah ulang berkasnya.']);

            return to_route('admin.employees.import');
        }

        // One commit per upload, even on a double click.
        Cache::lock("employee-import:{$token}:commit", 300)->get(function () use ($token, $user, $store, $commitImport, $state): void {
            if ($store->get($token, $user)['result'] ?? null) {
                return;
            }

            $report = $commitImport->handle($user, EmployeeImportStore::DISK, (string) $state['path'], $state['name']);
            $store->deleteFile((string) $state['path']);
            $store->update($token, ['result' => $report->toArray()]);

            Inertia::flash('toast', [
                'type' => 'success',
                'message' => "Impor selesai: {$report->created} ditambahkan, {$report->updated} diperbarui, {$report->summary()['error']} baris dilewati.",
            ]);
        });

        return to_route('admin.employees.import', ['token' => $token]);
    }
}
