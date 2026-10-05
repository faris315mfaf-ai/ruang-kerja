<?php

namespace App\Support\Excel;

use Maatwebsite\Excel\DefaultValueBinder;
use Override;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;

/**
 * Value binder against spreadsheet formula injection (CSV/Excel injection):
 * user-controlled text such as a task title `=HYPERLINK("http://evil","Klik")`
 * would otherwise be written as a formula. Strings starting with = + - @ tab or
 * carriage return are stored as explicit text, so Excel shows them literally.
 * Real numbers and numeric strings ("-5", "+62") keep their normal binding.
 *
 * Registered as the default binder in config/excel.php; exports may also use
 * it explicitly through the BindsValuesSafely trait (WithCustomValueBinder).
 */
class SafeValueBinder extends DefaultValueBinder
{
    private const string DANGEROUS_PREFIXES = "=+-@\t\r";

    #[Override]
    public function bindValue(Cell $cell, mixed $value): bool
    {
        if (is_string($value) && self::isDangerous($value)) {
            $cell->setValueExplicit($value, DataType::TYPE_STRING);

            return true;
        }

        return parent::bindValue($cell, $value);
    }

    public static function isDangerous(string $value): bool
    {
        return $value !== ''
            && str_contains(self::DANGEROUS_PREFIXES, $value[0])
            && ! is_numeric($value);
    }
}
