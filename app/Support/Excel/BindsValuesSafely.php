<?php

namespace App\Support\Excel;

use PhpOffice\PhpSpreadsheet\Cell\Cell;

/**
 * For exports implementing WithCustomValueBinder: binds every cell through
 * SafeValueBinder (no formula injection), independent of config/excel.php.
 */
trait BindsValuesSafely
{
    public function bindValue(Cell $cell, mixed $value): bool
    {
        return (new SafeValueBinder)->bindValue($cell, $value);
    }
}
