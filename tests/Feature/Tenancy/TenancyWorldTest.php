<?php

use App\Models\Company;
use App\Models\User;
use App\Models\Workspace;
use Database\Factories\CompanyFactory;
use Illuminate\Support\Facades\DB;

require_once __DIR__.'/../../Support/tenancy-helpers.php';

/*
 * The two-company world itself (tests/Support/tenancy-helpers.php): B is
 * complete, consistent and never becomes the default company.
 */

test('the foreign company never becomes the default company of factories', function () {
    $foreign = foreignWorld();

    // Built before any other company: factories still get their own default.
    $user = User::factory()->create();

    expect($user->company_id)->not->toBe($foreign->company->id)
        ->and(CompanyFactory::defaultId())->toBe($user->company_id)
        ->and(Company::query()->count())->toBe(2);
});

test('company B fills every module and all of it belongs to B', function () {
    $home = homeWorld();
    $foreign = foreignWorld();

    expect($home->company->id)->toBe(CompanyFactory::defaultId())
        ->and($foreign->company->id)->not->toBe($home->company->id);

    // Every marked person, workspace and meeting is B's.
    $marker = '%'.tenancyMarker().'%';
    expect(User::query()->where('name', 'ilike', $marker)->distinct()->pluck('company_id')->all())->toBe([$foreign->company->id])
        ->and(Workspace::query()->where('name', 'ilike', $marker)->distinct()->pluck('company_id')->all())->toBe([$foreign->company->id])
        ->and(DB::table('meetings')->where('title', 'ilike', $marker)->distinct()->pluck('company_id')->all())->toBe([$foreign->company->id]);

    // A's rows never carry the marker.
    expect(User::query()->where('company_id', $home->company->id)->where('name', 'ilike', $marker)->exists())->toBeFalse();

    // B has rows in (nearly) every company-scoped table.
    $fingerprint = tenancyFingerprint($foreign->company->id, tenancyRowIds($foreign->company->id));
    $filled = array_keys(array_filter($fingerprint, fn (string $row): bool => ! str_starts_with($row, '0|')));
    $empty = array_values(array_diff(array_keys($fingerprint), $filled));

    expect(count($filled))->toBeGreaterThanOrEqual(80, 'Tabel B kosong: '.implode(', ', $empty));

    foreach ($foreign->models as $class => $model) {
        expect($model)->toBeInstanceOf($class);
    }
});

test('the fingerprint changes when B data changes, and only then', function () {
    homeWorld();
    $foreign = foreignWorld();
    $ids = tenancyRowIds($foreign->company->id);
    $before = tenancyFingerprint($foreign->company->id, $ids);

    User::factory()->create(['name' => 'Orang rumah lain']);
    expect(tenancyFingerprint($foreign->company->id, $ids))->toBe($before);

    $this->travel(5)->seconds();
    $foreign->task->forceFill(['title' => 'Diubah'])->save();
    expect(tenancyFingerprint($foreign->company->id, $ids))->not->toBe($before);
});
