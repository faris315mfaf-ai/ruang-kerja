<?php

use App\Domain\Requests\Services\RequestNumberGenerator;
use App\Models\Company;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;

/*
 * Plan item #2 (Fase 1): request numbers count per company, so two companies
 * with the same type code both start at 0001.
 */

beforeEach(function () {
    $this->home = Company::query()->findOrFail(User::factory()->create()->company_id);
    $this->foreign = Company::factory()->foreign()->create();
    $this->homeType = LeaveType::factory()->create(['company_id' => $this->home->id, 'code' => 'CUT']);
    $this->foreignType = LeaveType::factory()->create(['company_id' => $this->foreign->id, 'code' => 'CUT']);
});

it('numbers the requests of every company from 0001', function () {
    $numbers = app(RequestNumberGenerator::class);
    $at = CarbonImmutable::parse('2026-10-20 03:00:00');

    expect($numbers->next($this->homeType, $at))->toBe('CUT-2026-10-0001')
        ->and($numbers->next($this->foreignType, $at))->toBe('CUT-2026-10-0001')
        ->and($numbers->next($this->foreignType, $at))->toBe('CUT-2026-10-0002')
        ->and($numbers->next($this->homeType, $at))->toBe('CUT-2026-10-0002');
});

it('copies the requester company and keeps numbers unique per company only', function () {
    $homeUser = User::factory()->forCompany($this->home)->create();
    $foreignUser = User::factory()->forCompany($this->foreign)->create();

    $home = EmployeeRequest::factory()->create(['user_id' => $homeUser->id, 'leave_type_id' => $this->homeType->id, 'number' => 'CUT-2026-10-0001']);
    $foreign = EmployeeRequest::factory()->create(['user_id' => $foreignUser->id, 'leave_type_id' => $this->foreignType->id, 'number' => 'CUT-2026-10-0001']);

    expect($home->company_id)->toBe($this->home->id)
        ->and($foreign->company_id)->toBe($this->foreign->id)
        ->and(fn () => EmployeeRequest::factory()->create(['user_id' => $homeUser->id, 'leave_type_id' => $this->homeType->id, 'number' => 'CUT-2026-10-0001']))
        ->toThrow(UniqueConstraintViolationException::class);
});
