<?php

use App\Models\KeyResult;
use App\Models\Objective;
use Illuminate\Support\Facades\Gate;

require_once __DIR__.'/../../Support/okr-helpers.php';

/*
 * ObjectivePolicy / KeyResultPolicy matrices. 'allow' · 'deny' (403) · 'hidden' (404).
 * Reading: division, its Kepala Divisi, owners, Direksi/HR/Super Admin.
 * Objective: Kepala Divisi + Direksi. Key results: KR owner, objective owner, Kepala Divisi.
 */
beforeEach(function () {
    $this->w = okrWorld();
});

it('applies the objective and key result matrix', function (string $actor, array $objective, array $keyResult) {
    $user = $this->w->{$actor};

    expect([
        okrVerdict($user, 'view', $this->w->objective),
        okrVerdict($user, 'update', $this->w->objective),
        okrVerdict($user, 'close', $this->w->objective),
        okrVerdict($user, 'createKeyResult', $this->w->objective),
    ])->toBe($objective, "objective · {$actor}");

    expect([
        okrVerdict($user, 'update', $this->w->keyResult),
        okrVerdict($user, 'checkin', $this->w->keyResult),
        okrVerdict($user, 'linkTask', $this->w->keyResult),
        okrVerdict($user, 'delete', $this->w->keyResult),
    ])->toBe($keyResult, "key result · {$actor}");
})->with([
    //                                   view     update   close    add KR            KR: update checkin  link     delete
    'kepala divisi (objective owner)' => ['kadiv', ['allow', 'allow', 'allow', 'allow'], ['allow', 'allow', 'allow', 'allow']],
    'anggota, KR owner' => ['member', ['allow', 'deny', 'deny', 'deny'], ['allow', 'allow', 'allow', 'deny']],
    'anggota of the division' => ['colleague', ['allow', 'deny', 'deny', 'deny'], ['deny', 'deny', 'deny', 'deny']],
    'kepala divisi of another division' => ['prgKadiv', ['hidden', 'hidden', 'hidden', 'hidden'], ['hidden', 'hidden', 'hidden', 'hidden']],
    'anggota of another division' => ['prgMember', ['hidden', 'hidden', 'hidden', 'hidden'], ['hidden', 'hidden', 'hidden', 'hidden']],
    'direksi' => ['direksi', ['allow', 'allow', 'allow', 'deny'], ['deny', 'deny', 'deny', 'deny']],
    'hr' => ['hr', ['allow', 'deny', 'deny', 'deny'], ['deny', 'deny', 'deny', 'deny']],
    'super admin' => ['superAdmin', ['allow', 'deny', 'deny', 'deny'], ['deny', 'deny', 'deny', 'deny']],
    'other company' => ['foreign', ['hidden', 'hidden', 'hidden', 'hidden'], ['hidden', 'hidden', 'hidden', 'hidden']],
    'inactive employee' => ['inactive', ['hidden', 'hidden', 'hidden', 'hidden'], ['hidden', 'hidden', 'hidden', 'hidden']],
]);

it('lets the objective owner manage key results without the Kepala Divisi role', function () {
    $objective = Objective::factory()->forDivision($this->w->ops)->ownedBy($this->w->colleague)->create();
    $keyResult = KeyResult::factory()->for($objective)->ownedBy($this->w->member)->create();

    expect(okrVerdict($this->w->colleague, 'createKeyResult', $objective))->toBe('allow')
        ->and(okrVerdict($this->w->colleague, 'update', $keyResult))->toBe('allow')
        ->and(okrVerdict($this->w->colleague, 'delete', $keyResult))->toBe('allow')
        ->and(okrVerdict($this->w->colleague, 'update', $objective))->toBe('deny');
});

it('makes a closed objective read-only but lets it be reopened', function () {
    $this->w->objective->forceFill(['status' => 'closed', 'closed_at' => now()])->save();
    $keyResult = $this->w->keyResult->fresh();

    expect(okrVerdict($this->w->kadiv, 'view', $this->w->objective))->toBe('allow')
        ->and(okrVerdict($this->w->kadiv, 'update', $this->w->objective))->toBe('allow')
        ->and(okrVerdict($this->w->kadiv, 'close', $this->w->objective))->toBe('deny')
        ->and(okrVerdict($this->w->kadiv, 'createKeyResult', $this->w->objective))->toBe('deny')
        ->and(okrVerdict($this->w->member, 'checkin', $keyResult))->toBe('deny')
        ->and(okrVerdict($this->w->member, 'update', $keyResult))->toBe('deny');
});

it('decides who may create objectives per division', function () {
    expect(okrVerdict($this->w->kadiv, 'create', [Objective::class, $this->w->ops]))->toBe('allow')
        ->and(okrVerdict($this->w->kadiv, 'create', [Objective::class, $this->w->prg]))->toBe('deny')
        ->and(okrVerdict($this->w->direksi, 'create', [Objective::class, $this->w->prg]))->toBe('allow')
        ->and(okrVerdict($this->w->member, 'create', [Objective::class, $this->w->ops]))->toBe('deny')
        ->and(okrVerdict($this->w->hr, 'create', [Objective::class, $this->w->ops]))->toBe('deny')
        ->and(okrVerdict($this->w->foreign, 'create', [Objective::class, $this->w->ops]))->toBe('deny')
        ->and(Gate::forUser($this->w->kadiv)->allows('createAny', Objective::class))->toBeTrue()
        ->and(Gate::forUser($this->w->direksi)->allows('createAny', Objective::class))->toBeTrue()
        ->and(Gate::forUser($this->w->member)->allows('createAny', Objective::class))->toBeFalse()
        ->and(Gate::forUser($this->w->hr)->allows('createAny', Objective::class))->toBeFalse();
});

it('lets the owner of a key result outside the division read the objective', function () {
    KeyResult::factory()->for($this->w->objective)->ownedBy($this->w->prgMember)->create();

    expect(okrVerdict($this->w->prgMember, 'view', $this->w->objective->fresh()))->toBe('allow')
        ->and(okrVerdict($this->w->prgKadiv, 'view', $this->w->objective->fresh()))->toBe('hidden');
});

it('lists exactly the objectives the policy lets a user see', function () {
    Objective::factory()->forDivision($this->w->prg)->ownedBy($this->w->prgKadiv)->create();
    Objective::factory()->forDivision($this->w->ops)->ownedBy($this->w->kadiv)->draft()->create();
    KeyResult::factory()->for(Objective::factory()->forDivision($this->w->prg)->ownedBy($this->w->prgKadiv)->create())->ownedBy($this->w->member)->create();
    Objective::factory()->forDivision($this->w->ops)->ownedBy($this->w->kadiv)->create()->delete();

    foreach (['kadiv', 'member', 'colleague', 'prgKadiv', 'prgMember', 'direksi', 'hr', 'superAdmin', 'foreign', 'inactive'] as $actor) {
        $user = $this->w->{$actor};
        $expected = Objective::query()->get()
            ->filter(fn (Objective $objective) => Gate::forUser($user)->allows('view', $objective))
            ->pluck('id')->sort()->values()->all();

        expect(Objective::query()->visibleTo($user)->pluck('id')->sort()->values()->all())->toBe($expected, $actor);
    }
});
