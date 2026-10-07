<?php

use App\Domain\Meetings\Enums\MinutesStatus;
use App\Domain\Meetings\Queries\AgendaQuery;
use App\Domain\Meetings\Queries\ManagementSchedule;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\MeetingDemoSeeder;

it('seeds demo meetings once, with draft and final minutes and a follow-up turned into a task', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-07 09:00', 'Asia/Jakarta'));
    $this->seed(DatabaseSeeder::class);
    $this->seed(MeetingDemoSeeder::class);

    $kadiv = User::query()->where('email', 'kadiv@demo.test')->firstOrFail();
    $direksi = User::query()->where('email', 'direksi@demo.test')->firstOrFail();

    expect(Meeting::query()->count())->toBe(6)
        ->and(MeetingMinutes::query()->where('status', MinutesStatus::Final->value)->count())->toBe(2)
        ->and(MeetingMinutes::query()->where('status', MinutesStatus::Draft->value)->count())->toBe(1)
        ->and(MeetingActionItem::query()->whereNotNull('task_id')->count())->toBe(1)
        ->and(count(app(AgendaQuery::class)->forUser($kadiv)['meetings']))->toBeGreaterThanOrEqual(6)
        ->and(count(app(ManagementSchedule::class)->forUser($direksi)['minutes']))->toBe(1);
});
