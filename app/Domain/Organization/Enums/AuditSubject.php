<?php

namespace App\Domain\Organization\Enums;

use App\Models\Company;
use App\Models\Division;
use App\Models\Position;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Subject kinds shown on the Audit Log page. Values are URL-friendly filter keys;
 * audit_logs.auditable_type stores the model class (no morph map, see CORE.md).
 */
enum AuditSubject: string
{
    case Employee = 'karyawan';
    case Division = 'divisi';
    case Team = 'tim';
    case Position = 'jabatan';
    case Company = 'perusahaan';

    public function label(): string
    {
        return match ($this) {
            self::Employee => 'Karyawan',
            self::Division => 'Divisi',
            self::Team => 'Tim',
            self::Position => 'Jabatan',
            self::Company => 'Perusahaan',
        };
    }

    /**
     * @return class-string<Model>
     */
    public function modelClass(): string
    {
        return match ($this) {
            self::Employee => User::class,
            self::Division => Division::class,
            self::Team => Team::class,
            self::Position => Position::class,
            self::Company => Company::class,
        };
    }

    public static function fromModelClass(?string $class): ?self
    {
        foreach (self::cases() as $case) {
            if ($case->modelClass() === $class) {
                return $case;
            }
        }

        return null;
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $case): array => ['value' => $case->value, 'label' => $case->label()], self::cases());
    }
}
