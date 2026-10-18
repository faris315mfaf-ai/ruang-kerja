<?php

use Illuminate\Support\Facades\DB;

/*
 * config/tenancy.php classifies every table by how its rows belong to one
 * company (Fase 1 multi-perusahaan). A migration that adds a table — or
 * renames a column referenced here — must update the registry.
 */

/**
 * @return array<string, list<string>> table => columns of the test database
 */
function tenancySchema(): array
{
    $rows = DB::select(<<<'SQL'
        select c.table_name, c.column_name
        from information_schema.columns c
        join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
        where c.table_schema = current_schema() and t.table_type = 'BASE TABLE'
        SQL);

    $schema = [];

    foreach ($rows as $row) {
        $schema[$row->table_name][] = $row->column_name;
    }

    ksort($schema);

    return $schema;
}

/**
 * @return array<string, string|array<string, string>>
 */
function tenancyRegistry(): array
{
    /** @var array<string, string|array<string, string>> $tables */
    $tables = config('tenancy.tables');

    return $tables;
}

test('every table in the database is classified, and every classified table exists', function () {
    $schema = array_keys(tenancySchema());
    $registered = array_keys(tenancyRegistry());

    expect(array_values(array_diff($schema, $registered)))->toBe([], 'Tabel belum terdaftar di config/tenancy.php')
        ->and(array_values(array_diff($registered, $schema)))->toBe([], 'Tabel terdaftar di config/tenancy.php tetapi tidak ada');
});

test('each classification is valid for the table it describes', function () {
    $schema = tenancySchema();
    $registry = tenancyRegistry();
    $problems = [];

    foreach ($registry as $table => $kind) {
        $columns = $schema[$table] ?? [];
        $has = fn (string $column): bool => in_array($column, $columns, true);

        if ($kind === 'global') {
            continue;
        }

        if ($kind === 'company') {
            if (! $has('company_id')) {
                $problems[] = "{$table}: 'company' tanpa kolom company_id";
            }

            continue;
        }

        $kind = $kind === 'user' ? ['user' => 'user_id'] : $kind;
        $type = is_array($kind) && count($kind) === 1 ? array_key_first($kind) : null;
        $value = $type === null ? '' : $kind[$type];

        if ($type === 'user') {
            if (! $has($value)) {
                $problems[] = "{$table}: kolom pengguna {$value} tidak ada";
            }
        } elseif ($type === 'morph') {
            if (! $has("{$value}_type") || ! $has("{$value}_id")) {
                $problems[] = "{$table}: kolom morph {$value}_type/{$value}_id tidak ada";
            }
        } elseif ($type === 'via') {
            [$parent, $column] = array_pad(explode('.', $value, 2), 2, '');

            if (! $has($column)) {
                $problems[] = "{$table}: kolom FK {$column} tidak ada";
            }

            if ($parent === $table || ! array_key_exists($parent, $registry)) {
                $problems[] = "{$table}: induk {$parent} tidak terdaftar";
            }
        } else {
            $problems[] = "{$table}: jenis tidak dikenal";
        }
    }

    expect($problems)->toBe([]);
});

test('a table with a company_id column is classified as company', function () {
    $misclassified = collect(tenancySchema())
        ->filter(fn (array $columns): bool => in_array('company_id', $columns, true))
        ->keys()
        ->reject(fn (string $table): bool => tenancyRegistry()[$table] === 'company')
        ->values()
        ->all();

    expect($misclassified)->toBe([]);
});

test('"via" chains end at a company or user-owned table', function () {
    $registry = tenancyRegistry();
    $broken = [];

    foreach ($registry as $table => $kind) {
        $seen = [$table];

        while (is_array($kind) && isset($kind['via'])) {
            $parent = explode('.', $kind['via'], 2)[0];

            if (in_array($parent, $seen, true) || ! isset($registry[$parent])) {
                $broken[] = $table;

                break;
            }

            $seen[] = $parent;
            $kind = $registry[$parent];
        }

        if (is_array($kind) && isset($kind['via'])) {
            continue;
        }

        if (count($seen) > 1 && $kind === 'global') {
            $broken[] = $table;
        }
    }

    expect($broken)->toBe([]);
});
