<?php

use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\ApprovalQueue;
use App\Models\ApprovalFlow;
use App\Models\EmployeeRequest;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\RequestSeeder;

it('seeds flows, leave types, balances and demo requests idempotently', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));

    $this->seed(DatabaseSeeder::class);
    $this->seed(RequestSeeder::class);

    expect(LeaveType::query()->orderBy('sort_order')->pluck('code')->all())->toBe(['CUT', 'CBR', 'SKT', 'IZN', 'LBR', 'KOR', 'DNS', 'CML', 'CAP', 'CLT', 'BRG'])
        ->and(LeaveType::query()->where('code', 'CUT')->value('annual_quota_days'))->toEqual(12)
        ->and(ApprovalFlow::query()->where('name', ApprovalFlow::DEFAULT_NAME)->sole()->steps)->toHaveCount(2)
        ->and(ApprovalFlow::query()->where('name', 'Pengajuan barang')->sole()->steps->pluck('approver_role')->all())->toBe([null, 'direksi'])
        ->and(LeaveType::query()->where('code', 'BRG')->sole()->isLocked())->toBeFalse()
        ->and(EmployeeRequest::query()->count())->toBe(11);

    $rizky = User::query()->where('email', 'anggota@demo.test')->sole();
    $balance = LeaveBalance::query()->where('user_id', $rizky->id)->whereHas('leaveType', fn ($q) => $q->where('code', 'CUT'))->where('year', 2026)->sole();

    expect($balance->remaining())->toBe(12.0)
        ->and($balance->pending_days)->toBe(3.0)
        ->and(EmployeeRequest::query()->where('user_id', $rizky->id)->pluck('status')->map->value->sort()->values()->all())
        ->toBe(['approved', 'approved', 'approved', 'pending', 'pending', 'rejected']);

    $queue = app(ApprovalQueue::class);
    expect($queue->count(User::query()->where('email', 'kadiv@demo.test')->sole()))->toBe(4)
        ->and($queue->count(User::query()->where('email', 'hr@demo.test')->sole()))->toBe(1)
        ->and($queue->count(User::query()->where('email', 'direksi@demo.test')->sole()))->toBe(1)
        ->and(EmployeeRequest::query()->where('status', RequestStatus::Pending)->count())->toBe(6);
});
