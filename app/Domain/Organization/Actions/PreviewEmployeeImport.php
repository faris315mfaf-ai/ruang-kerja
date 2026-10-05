<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Organization\Imports\EmployeeImportReport;
use App\Domain\Organization\Imports\EmployeeImportValidator;
use App\Domain\Organization\Imports\EmployeeSheetReader;
use App\Models\User;
use Maatwebsite\Excel\Excel as ExcelType;
use Maatwebsite\Excel\Facades\Excel;
use Throwable;

/**
 * Dry run of an employee import: reads the stored CSV/XLSX and validates every
 * row without writing anything.
 */
final readonly class PreviewEmployeeImport
{
    public function __construct(private EmployeeImportValidator $validator) {}

    public function handle(User $actor, string $disk, string $path): EmployeeImportReport
    {
        $reader = new EmployeeSheetReader;

        try {
            Excel::import($reader, $path, $disk, self::readerType($path));
        } catch (Throwable $exception) {
            report($exception);

            return new EmployeeImportReport(fileErrors: ['Berkas tidak bisa dibaca. Pastikan formatnya CSV atau XLSX yang valid.']);
        }

        return $this->validator->validate($actor, $reader->rows(), $reader->truncated());
    }

    private static function readerType(string $path): string
    {
        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'xlsx' => ExcelType::XLSX,
            default => ExcelType::CSV,
        };
    }
}
