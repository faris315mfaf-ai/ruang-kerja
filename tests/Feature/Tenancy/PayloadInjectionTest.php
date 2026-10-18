<?php

use App\Domain\Briefings\Enums\BriefingPeriod;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\User;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;

require_once __DIR__.'/../../Support/tenancy-helpers.php';

/*
 * Plan item #8 (Fase 1): ids of company B sent in a request body of company
 * A are rejected by validation (`exists` rules scoped to the actor's
 * company), on the web and in api/v1, and B's data stays untouched.
 */

beforeEach(function () {
    $this->home = homeWorld();
    $this->foreign = foreignWorld();
});

/**
 * @return array{0: string, 1: string, 2: Closure(object, object): array{0: User, 1: string, 2: array<string, mixed>}}
 */
dataset('foreign ids in payloads', [
    'koreksi absensi (web)' => ['web', 'user_id', fn (object $a, object $b): array => [
        $a->hr, route('attendance.corrections.store'),
        ['user_id' => $b->anggota->id, 'work_date' => now()->subDay()->toDateString(), 'check_in' => '08:00', 'reason' => 'Lupa check-in pagi'],
    ]],
    'koreksi absensi (api)' => ['api', 'user_id', fn (object $a, object $b): array => [
        $a->hr, route('api.v1.hr.attendance.correct'),
        ['user_id' => $b->anggota->id, 'work_date' => now()->subDay()->toDateString(), 'check_in' => '08:00', 'reason' => 'Lupa check-in pagi'],
    ]],
    'undang anggota workspace (web)' => ['web', 'user_id', fn (object $a, object $b): array => [
        $a->kadiv, route('workspaces.members.store', $a->workspace), ['user_id' => $b->anggota->id, 'role' => 'member'],
    ]],
    'undang anggota workspace (api)' => ['api', 'user_id', fn (object $a, object $b): array => [
        $a->kadiv, route('api.v1.workspaces.members.store', $a->workspace), ['user_id' => $b->anggota->id, 'role' => 'member'],
    ]],
    'delegasi briefing (web)' => ['web', 'user_id', fn (object $a, object $b): array => [
        $a->hr, route('briefings.delegate'), ['user_id' => $b->anggota->id, 'period' => BriefingPeriod::cases()[0]->value],
    ]],
    'delegasi briefing (api)' => ['api', 'user_id', fn (object $a, object $b): array => [
        $a->hr, route('api.v1.briefing.delegate'), ['user_id' => $b->anggota->id, 'period' => BriefingPeriod::cases()[0]->value],
    ]],
    'workspace tim baru (web)' => ['web', 'team_id', fn (object $a, object $b): array => [
        $a->kadiv, route('workspaces.store'), ['type' => WorkspaceType::Team->value, 'name' => 'Tim titipan', 'team_id' => $b->team->id],
    ]],
    'workspace tim baru (api)' => ['api', 'team_id', fn (object $a, object $b): array => [
        $a->kadiv, route('api.v1.workspaces.store'), ['type' => WorkspaceType::Team->value, 'name' => 'Tim titipan', 'team_id' => $b->team->id],
    ]],
]);

it('rejects an id of company B in the request body', function (string $channel, string $field, Closure $case) {
    [$actor, $url, $payload] = $case($this->home, $this->foreign);
    $before = tenancyFingerprint($this->foreign->company->id);

    if ($channel === 'api') {
        Sanctum::actingAs($actor);
        $response = $this->postJson($url, $payload);
        $response->assertUnprocessable()->assertJsonValidationErrors($field);
    } else {
        /** @var TestResponse $response */
        $response = $this->actingAs($actor)->post($url, $payload);
        $response->assertSessionHasErrors($field);
    }

    expect(tenancyFingerprint($this->foreign->company->id))->toBe($before);
})->with('foreign ids in payloads');
