<?php

use App\Domain\Analytics\Exports\DashboardExport;
use App\Domain\Analytics\Exports\DashboardSheet;
use App\Domain\Attendance\Data\EmployeeRecap;
use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Data\RecapReport;
use App\Domain\Attendance\Exports\PayrollRecapExport;
use App\Models\User;
use App\Support\Excel\SafeValueBinder;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Excel as ExcelType;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/*
 * User-controlled text (task titles, names, divisions) must never become a
 * formula in exported spreadsheets (CSV/Excel injection).
 */

function firstSheetOf(string $binary): Worksheet
{
    $path = tempnam(sys_get_temp_dir(), 'xlsx');
    file_put_contents($path, $binary);

    try {
        return IOFactory::load($path)->getSheet(0);
    } finally {
        @unlink($path);
    }
}

it('flags only non-numeric strings with a dangerous first character', function (string $value, bool $dangerous) {
    expect(SafeValueBinder::isDangerous($value))->toBe($dangerous);
})->with([
    ['=HYPERLINK("http://evil.test","Klik")', true],
    ['+cmd|\' /C calc\'!A0', true],
    ['-2+3+cmd|\' /C calc\'!A0', true],
    ['@SUM(1+1)', true],
    ["\t=1+1", true],
    ["\r=1+1", true],
    ['-5', false],
    ['+62', false],
    ['Rekap stok', false],
    ['', false],
]);

it('writes dashboard cells starting with = + - @ as text, not formulas', function () {
    $export = new DashboardExport([new DashboardSheet('Tugas terlambat', ['Kode', 'Judul', 'Hari'], [
        ['OPS-1', '=HYPERLINK("http://evil.test","Klik")', 3],
        ['OPS-2', '@SUM(1+1)', -2],
        ['OPS-3', '-5', '+cmd'],
    ])]);

    $sheet = firstSheetOf(Excel::raw($export, ExcelType::XLSX));

    expect($sheet->getCell('B2')->getDataType())->toBe(DataType::TYPE_STRING)
        ->and($sheet->getCell('B2')->getValue())->toBe('=HYPERLINK("http://evil.test","Klik")')
        ->and($sheet->getCell('B3')->getDataType())->toBe(DataType::TYPE_STRING)
        ->and($sheet->getCell('C3')->getValue())->toBe(-2)
        ->and($sheet->getCell('B4')->getDataType())->toBe(DataType::TYPE_NUMERIC)
        ->and($sheet->getCell('C4')->getDataType())->toBe(DataType::TYPE_STRING);
});

it('writes a payroll recap name that looks like a formula as text', function () {
    $user = User::factory()->create(['name' => '=cmd|\' /C calc\'!A0']);
    $report = new RecapReport(RecapPeriod::forMonth('2026-09', now()), [new EmployeeRecap($user)], 22, 8, 0);
    config(['payroll_export.columns' => ['name' => 'Nama']]);

    $sheet = firstSheetOf(Excel::raw(new PayrollRecapExport($report), ExcelType::XLSX));

    expect($sheet->getCell('A2')->getDataType())->toBe(DataType::TYPE_STRING)
        ->and($sheet->getCell('A2')->getValue())->toBe('=cmd|\' /C calc\'!A0');
});

it('is the default binder for every export', function () {
    $plain = new class implements FromArray
    {
        /** @return array<int, array<int, string>> */
        public function array(): array
        {
            return [['=1+1']];
        }
    };

    expect(config('excel.value_binder.default'))->toBe(SafeValueBinder::class)
        ->and(firstSheetOf(Excel::raw($plain, ExcelType::XLSX))->getCell('A1')->getDataType())->toBe(DataType::TYPE_STRING);
});
