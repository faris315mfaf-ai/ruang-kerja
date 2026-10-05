<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Organization\Imports\EmployeeImportReport;
use App\Domain\Organization\Imports\EmployeeImportRow;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * Writes the valid rows of an employee import. The file is re-validated first
 * (data may have changed since the preview); rows with errors are never written.
 *
 * Idempotent by email: an existing employee is updated, a new one created.
 * Managers are written before their reports, in batches of BATCH_SIZE rows,
 * one transaction per batch. A batch that fails is rolled back and its rows are
 * reported as errors; later batches continue.
 */
final readonly class CommitEmployeeImport
{
    public const int BATCH_SIZE = 100;

    public function __construct(
        private PreviewEmployeeImport $preview,
        private CreateEmployee $createEmployee,
        private UpdateEmployee $updateEmployee,
        private AuditLogger $audit,
    ) {}

    public function handle(User $actor, string $disk, string $path, ?string $fileName = null): EmployeeImportReport
    {
        $report = $this->preview->handle($actor, $disk, $path);

        if ($report->fileErrors !== [] && $report->rows === []) {
            return $report;
        }

        foreach (array_chunk($this->managersFirst($report->validRows()), self::BATCH_SIZE) as $batch) {
            $this->writeBatch($actor, $report, $batch);
        }

        $this->audit->log('employee.imported', null, null, [
            'file' => $fileName === null ? null : Str::limit($fileName, 120),
            'created' => $report->created,
            'updated' => $report->updated,
            'skipped' => $report->summary()['error'],
        ], $actor);

        return $report;
    }

    /**
     * @param  list<EmployeeImportRow>  $batch
     */
    private function writeBatch(User $actor, EmployeeImportReport $report, array $batch): void
    {
        $created = 0;
        $updated = 0;

        try {
            DB::transaction(function () use ($actor, $batch, &$created, &$updated): void {
                foreach ($batch as $row) {
                    if ($row->data === null || $row->email === null) {
                        continue;
                    }

                    $managerId = $row->managerEmail === null ? null : $this->idOf($actor, $row->managerEmail);
                    $data = $row->data->withManager($managerId);
                    $existing = User::query()->where('email', $row->email)->first();

                    if ($existing === null) {
                        $this->createEmployee->handle($actor, $data);
                        $created++;
                    } else {
                        $this->updateEmployee->handle($actor, $existing, $data);
                        $updated++;
                    }
                }
            });
        } catch (Throwable $exception) {
            report($exception);

            foreach ($batch as $row) {
                $row->fail('Gagal disimpan karena galat sistem; baris ini tidak diimpor. Coba lagi.');
            }

            return;
        }

        $report->created += $created;
        $report->updated += $updated;
    }

    private function idOf(User $actor, string $email): string
    {
        $id = User::query()->where('company_id', $actor->company_id)->where('email', $email)->value('id');

        if (! is_string($id)) {
            throw new \RuntimeException('Manager of an import row was not written.');
        }

        return $id;
    }

    /**
     * Topological order: a manager that is in the file comes before their reports.
     * Validation guarantees there is no cycle.
     *
     * @param  list<EmployeeImportRow>  $rows
     * @return list<EmployeeImportRow>
     */
    private function managersFirst(array $rows): array
    {
        $byEmail = [];

        foreach ($rows as $row) {
            if ($row->email !== null) {
                $byEmail[$row->email] = $row;
            }
        }

        $ordered = [];
        $placed = [];

        $place = function (EmployeeImportRow $row, int $depth = 0) use (&$place, &$ordered, &$placed, $byEmail): void {
            if ($row->email === null || isset($placed[$row->email]) || $depth > count($byEmail)) {
                return;
            }

            $manager = $row->managerEmail === null ? null : ($byEmail[$row->managerEmail] ?? null);

            if ($manager !== null) {
                $place($manager, $depth + 1);
            }

            $placed[$row->email] = true;
            $ordered[] = $row;
        };

        foreach ($rows as $row) {
            $place($row);
        }

        return $ordered;
    }
}
