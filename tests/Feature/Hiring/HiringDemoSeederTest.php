<?php

use App\Domain\Hiring\Enums\CandidateStage;
use App\Models\Candidate;
use App\Models\CandidateDecision;
use App\Models\HiringPosition;
use App\Models\HiringSetting;
use App\Models\InboxNotification;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\HiringDemoSeeder;

it('seeds the hiring demo idempotently without notifications', function () {
    $this->seed(DatabaseSeeder::class);
    $this->seed(HiringDemoSeeder::class);

    $faris = User::query()->where('email', 'faris@demo.test')->sole();
    $dio = User::query()->where('email', 'dio@demo.test')->sole();
    $position = HiringPosition::query()->where('title', HiringDemoSeeder::POSITION_TITLE)->sole();

    expect($faris->hasRole('direksi'))->toBeTrue()
        ->and(HiringSetting::query()->sole()->default_final_approver_ids)->toBe([$faris->id, $dio->id])
        ->and($position->final_approver_ids)->toBe([$faris->id, $dio->id])
        ->and($position->interviewer_ids)->toHaveCount(2)
        ->and($position->questions()->count())->toBe(5)
        ->and(Candidate::query()->count())->toBe(6)
        ->and(Candidate::query()->pluck('stage')->map(fn (CandidateStage $stage) => $stage->value)->sort()->values()->all())
        ->toBe(['applied', 'assessment', 'final_review', 'hired', 'interview', 'screening'])
        ->and(CandidateDecision::query()->count())->toBe(3)
        ->and(InboxNotification::query()->where('type', 'like', 'hiring.%')->count())->toBe(0);
});

it('lets the demo personas see what they should', function (string $email, int $status) {
    $this->seed(DatabaseSeeder::class);

    $this->actingAs(User::query()->where('email', $email)->sole())->get('/hiring')->assertStatus($status);
})->with([
    'hr' => ['hr@demo.test', 200],
    'admin' => ['admin@demo.test', 200],
    'faris' => ['faris@demo.test', 200],
    'dio' => ['dio@demo.test', 200],
    'kadiv (interviewer)' => ['kadiv@demo.test', 200],
    'programmer (interviewer)' => ['programmer@demo.test', 200],
    'direksi' => ['direksi@demo.test', 404],
    'anggota' => ['anggota@demo.test', 404],
    'maya' => ['maya.lestari@demo.test', 404],
]);
