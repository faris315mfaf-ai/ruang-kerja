<?php

namespace App\Domain\Hiring\Actions;

use App\Domain\Hiring\Enums\PositionStatus;
use App\Domain\Hiring\Services\HiringAccess;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Division;
use App\Models\HiringPosition;
use App\Models\HiringSetting;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * HR opens a new position (as a draft). Final approvers start from the
 * company default (Pengaturan hiring); the webhook token & secret are created
 * here and the secret is revealed later through "Buat ulang secret".
 */
final class CreateHiringPosition
{
    public function __construct(
        private readonly HiringAccess $access,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array{title: string, division_id?: string|null, description?: string|null}  $data
     */
    public function handle(User $actor, array $data): HiringPosition
    {
        $divisionId = $data['division_id'] ?? null;

        if ($divisionId !== null && ! Division::query()->whereKey($divisionId)->where('company_id', $actor->company_id)->exists()) {
            $divisionId = null;
        }

        $defaults = HiringSetting::forCompany($actor->company_id)->default_final_approver_ids;

        $position = HiringPosition::query()->create([
            'company_id' => $actor->company_id,
            'title' => trim($data['title']),
            'division_id' => $divisionId,
            'description' => self::text($data['description'] ?? null),
            'status' => PositionStatus::Draft,
            'webhook_token' => self::token(),
            'webhook_secret' => Str::random(48),
            'interviewer_ids' => [],
            'final_approver_ids' => $this->access->activeEmployeeIds($actor->company_id, $defaults),
            'field_map' => [],
            'created_by' => $actor->id,
        ]);

        $this->audit->log('hiring.position_created', $position, null, [
            'status' => $position->status->value,
            'final_approver_ids' => $position->final_approver_ids,
        ], $actor);

        return $position;
    }

    /** 40 URL-safe characters, unique (webhook URL). */
    public static function token(): string
    {
        do {
            $token = Str::lower(Str::random(40));
        } while (HiringPosition::withTrashed()->where('webhook_token', $token)->exists());

        return $token;
    }

    public static function text(?string $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }
}
