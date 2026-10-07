<?php

use App\Domain\Auth\Notifications\PasswordSetByHrNotification;
use App\Domain\Auth\Rules\NotDefaultPassword;
use App\Domain\Auth\Rules\NotSameAsEmail;
use App\Domain\Auth\Services\DefaultPassword;
use App\Domain\Auth\Services\PasswordPolicy;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Division;
use App\Models\Position;
use App\Models\Team;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * Company default password for employee accounts + "aturan bebas" password
 * rules (owner decision 7 Oct 2026). The value below is a test placeholder.
 */
const SANDI_BAWAAN_UJI = 'ContohSandi123';

beforeEach(function () {
    $this->seed(RoleSeeder::class);

    $this->company = Company::factory()->create(['google_domain' => 'kantor.test']);
    $this->ops = Division::factory()->forCompany($this->company)->create(['name' => 'Operasional', 'code' => 'OPS']);
    $this->gudang = Team::factory()->create(['division_id' => $this->ops->id, 'name' => 'Tim Gudang', 'code' => 'GDG']);
    $this->staff = Position::factory()->create(['company_id' => $this->company->id, 'name' => 'Staf Operasional', 'level' => 5]);

    $this->hr = User::factory()->forCompany($this->company)->withRole(Role::Hr)->create(['email' => 'hr@kantor.test', 'name' => 'Hana Personalia']);
    $this->admin = User::factory()->forCompany($this->company)->withRole(Role::SuperAdmin)->create(['email' => 'admin@kantor.test']);
    $this->employee = User::factory()->forCompany($this->company)->withRole(Role::Anggota)->create([
        'name' => 'Rizky Aditya',
        'email' => 'rizky@kantor.test',
    ]);
});

function useDefaultPassword(): void
{
    config(['auth.employee_default_password' => SANDI_BAWAAN_UJI]);
}

/**
 * @return array<string, mixed>
 */
function defaultPwEmployeePayload(array $overrides = []): array
{
    return [
        'name' => 'Bayu Saputra',
        'email' => 'bayu@kantor.test',
        'division_id' => test()->ops->id,
        'team_id' => test()->gudang->id,
        'position_id' => test()->staff->id,
        'manager_id' => null,
        'work_mode' => WorkMode::Hybrid->value,
        'joined_at' => '2023-02-14',
        'roles' => [Role::Anggota->value],
        ...$overrides,
    ];
}

function defaultPwSetPassword(User $actor, User $employee, array $data): TestResponse
{
    return test()->actingAs($actor)
        ->from(route('admin.employees.show', $employee))
        ->post(route('admin.employees.password', $employee), $data);
}

function defaultPwImport(): void
{
    $csv = implode("\n", [
        'nama,email,nomor_karyawan,divisi,tim,jabatan,atasan_email,mode_kerja,peran,tanggal_bergabung,telepon,nik',
        'Bayu Saputra,bayu@kantor.test,RK-1,OPS,GDG,Staf Operasional,,Hybrid,anggota,14/02/2023,,',
        'Rizky Aditya,rizky@kantor.test,RK-2,OPS,GDG,Staf Operasional,,Hybrid,anggota,14/02/2023,,',
    ])."\n";

    $response = test()->actingAs(test()->hr)
        ->post(route('admin.employees.import.preview'), ['file' => UploadedFile::fake()->createWithContent('karyawan.csv', $csv)])
        ->assertSessionHasNoErrors();
    parse_str((string) parse_url((string) $response->headers->get('Location'), PHP_URL_QUERY), $query);

    test()->actingAs(test()->hr)->post(route('admin.employees.import.commit', (string) $query['token']))->assertRedirect();
}

function defaultPwPasses(?User $user, string $password): bool
{
    return Validator::make(
        ['password' => $password, 'password_confirmation' => $password],
        ['password' => app(PasswordPolicy::class)->rules($user)],
    )->passes();
}

describe('Tambah karyawan', function () {
    it('gives a new employee the default password with a required change', function () {
        useDefaultPassword();

        $this->actingAs($this->hr)
            ->post(route('admin.employees.store'), defaultPwEmployeePayload())
            ->assertSessionHasNoErrors();

        $bayu = User::query()->where('email', 'bayu@kantor.test')->sole();
        expect(Hash::check(SANDI_BAWAAN_UJI, (string) $bayu->password))->toBeTrue()
            ->and($bayu->password_change_required)->toBeTrue()
            ->and(AuditLog::query()->get()->toJson())->not->toContain(SANDI_BAWAAN_UJI);
    });

    it('never gives a new Super Admin the default password', function () {
        useDefaultPassword();

        $this->actingAs($this->admin)
            ->post(route('admin.employees.store'), defaultPwEmployeePayload(['roles' => [Role::SuperAdmin->value]]))
            ->assertSessionHasNoErrors();

        $bayu = User::query()->where('email', 'bayu@kantor.test')->sole();
        expect($bayu->isSuperAdmin())->toBeTrue()
            ->and($bayu->password)->toBeNull()
            ->and($bayu->password_change_required)->toBeFalse();
    });

    it('sets no password while the feature is off (previous behaviour)', function () {
        $this->actingAs($this->hr)
            ->post(route('admin.employees.store'), defaultPwEmployeePayload())
            ->assertSessionHasNoErrors();

        $bayu = User::query()->where('email', 'bayu@kantor.test')->sole();
        expect($bayu->password)->toBeNull()
            ->and($bayu->password_change_required)->toBeFalse();
    });

    it('tells the form whether new accounts get the default password', function (bool $enabled) {
        if ($enabled) {
            useDefaultPassword();
        }

        $this->actingAs($this->hr)
            ->get(route('admin.employees.index'))
            ->assertInertia(fn (Assert $page) => $page->where('formOptions.defaultPassword', $enabled));
    })->with([true, false]);
});

describe('Impor karyawan', function () {
    beforeEach(function () {
        Storage::fake('local');
    });

    it('gives imported new employees the default password and leaves existing ones alone', function () {
        useDefaultPassword();

        defaultPwImport();

        $bayu = User::query()->where('email', 'bayu@kantor.test')->sole();
        expect(Hash::check(SANDI_BAWAAN_UJI, (string) $bayu->password))->toBeTrue()
            ->and($bayu->password_change_required)->toBeTrue()
            // Updated (already existed): password untouched.
            ->and(Hash::check('password', (string) $this->employee->refresh()->password))->toBeTrue()
            ->and($this->employee->password_change_required)->toBeFalse();
    });

    it('imports without a password while the feature is off', function () {
        defaultPwImport();

        expect(User::query()->where('email', 'bayu@kantor.test')->sole()->password)->toBeNull();
    });
});

describe('Atur kata sandi', function () {
    it('gives the default password ("Sandi bawaan"), audits the mode only and tells the employee', function () {
        useDefaultPassword();
        Notification::fake();

        defaultPwSetPassword($this->hr, $this->employee, ['mode' => 'default', 'must_change' => true])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('admin.employees.show', $this->employee));

        $employee = $this->employee->refresh();
        expect(Hash::check(SANDI_BAWAAN_UJI, (string) $employee->password))->toBeTrue()
            ->and($employee->password_change_required)->toBeTrue();

        $audit = AuditLog::query()->where('action', 'user.password_set_by_hr')->sole();
        expect($audit->new_values)->toBe(['mode' => 'default', 'must_change' => true])
            ->and(AuditLog::query()->get()->toJson())->not->toContain(SANDI_BAWAAN_UJI);

        Notification::assertSentTo($employee, PasswordSetByHrNotification::class, function (PasswordSetByHrNotification $notification) use ($employee) {
            $payload = json_encode($notification->payload($employee)->toArray($notification->type()));

            return $notification->toDefault
                && str_contains((string) $payload, 'kata sandi bawaan perusahaan')
                && ! str_contains((string) $payload, SANDI_BAWAAN_UJI);
        });
    });

    it('lets HR type a short password for an employee but never the default one', function () {
        useDefaultPassword();

        defaultPwSetPassword($this->hr, $this->employee, [
            'mode' => 'manual', 'password' => SANDI_BAWAAN_UJI, 'password_confirmation' => SANDI_BAWAAN_UJI, 'must_change' => true,
        ])->assertSessionHasErrors(['password' => NotDefaultPassword::MESSAGE]);

        defaultPwSetPassword($this->hr, $this->employee, [
            'mode' => 'manual', 'password' => 'kopi', 'password_confirmation' => 'kopi', 'must_change' => false,
        ])->assertSessionHasNoErrors();

        expect(Hash::check('kopi', (string) $this->employee->refresh()->password))->toBeTrue()
            ->and(AuditLog::query()->where('action', 'user.password_set_by_hr')->sole()->new_values)
            ->toBe(['mode' => 'manual', 'must_change' => false]);
    });

    it('never gives a Super Admin the default password and keeps the strict rules for one', function () {
        useDefaultPassword();
        $otherAdmin = User::factory()->forCompany($this->company)->withRole(Role::SuperAdmin)->create();

        defaultPwSetPassword($this->admin, $otherAdmin, ['mode' => 'default', 'must_change' => true])
            ->assertSessionHasErrors('mode');
        defaultPwSetPassword($this->admin, $otherAdmin, [
            'mode' => 'manual', 'password' => 'kopi', 'password_confirmation' => 'kopi', 'must_change' => true,
        ])->assertSessionHasErrors('password');

        expect(Hash::check('password', (string) $otherAdmin->refresh()->password))->toBeTrue();
    });

    it('offers "Sandi bawaan" on the profile only when configured and not for a Super Admin', function () {
        $page = fn (User $actor, User $target, bool $expected) => $this->actingAs($actor)
            ->get(route('admin.employees.show', $target))
            ->assertInertia(fn (Assert $page) => $page->where('can.setDefaultPassword', $expected));

        $page($this->hr, $this->employee, false);

        useDefaultPassword();
        $page($this->hr, $this->employee, true);
        $otherAdmin = User::factory()->forCompany($this->company)->withRole(Role::SuperAdmin)->create();
        $page($this->admin, $otherAdmin, false);
    });

    it('reveals the default password to HR on demand, never cached', function () {
        useDefaultPassword();

        $this->actingAs($this->hr)
            ->getJson(route('admin.employees.password.default', $this->employee))
            ->assertOk()
            ->assertExactJson(['password' => SANDI_BAWAAN_UJI])
            ->assertHeader('Cache-Control', 'no-store, private');
    });

    it('does not reveal the default password when off, for a Super Admin or to others', function () {
        $url = fn (User $target) => route('admin.employees.password.default', $target);

        $this->actingAs($this->hr)->getJson($url($this->employee))->assertNotFound();

        useDefaultPassword();
        $otherAdmin = User::factory()->forCompany($this->company)->withRole(Role::SuperAdmin)->create();
        $this->actingAs($this->admin)->getJson($url($otherAdmin))->assertNotFound();
        $this->actingAs($this->hr)->getJson($url($this->admin))->assertForbidden();

        foreach ([Role::Anggota, Role::KepalaDivisi, Role::Direksi] as $role) {
            $actor = User::factory()->forCompany($this->company)->withRole($role)->create();
            $this->actingAs($actor)->getJson($url($this->employee))->assertForbidden();
        }

        $foreign = User::factory()->forCompany(Company::factory()->create())->withRole(Role::Anggota)->create();
        $this->actingAs($this->hr)->getJson($url($foreign))->assertForbidden();
    });
});

describe('aturan sandi', function () {
    it('lets employees choose freely, except the default password (case-sensitive)', function (string $password, bool $passes) {
        useDefaultPassword();

        expect(defaultPwPasses($this->employee, $password))->toBe($passes);
    })->with([
        'short' => ['abc', true],
        'the email' => ['rizky@kantor.test', true],
        'only digits' => ['1234', true],
        'the default' => [SANDI_BAWAAN_UJI, false],
        'the default, other case' => [strtolower(SANDI_BAWAAN_UJI), true],
        'too long' => [str_repeat('x', 256), false],
    ]);

    it('keeps the strict rules for Super Admins', function (string $password, bool $passes) {
        useDefaultPassword();

        expect(defaultPwPasses($this->admin, $password))->toBe($passes);
    })->with([
        'short' => ['abc', false],
        'the email' => ['admin@kantor.test', false],
        'the default' => [SANDI_BAWAAN_UJI, false],
        'long enough' => ['sandi-admin-panjang', true],
    ]);

    it('uses the strict-rule messages for Super Admins only', function () {
        $validator = Validator::make(
            ['password' => 'admin@kantor.test', 'password_confirmation' => 'admin@kantor.test'],
            ['password' => app(PasswordPolicy::class)->rules($this->admin)],
        );

        expect($validator->errors()->get('password'))->toContain(NotSameAsEmail::MESSAGE);
    });

    it('ignores the default-password rule while the feature is off', function () {
        expect(defaultPwPasses($this->employee, SANDI_BAWAAN_UJI))->toBeTrue()
            ->and(app(DefaultPassword::class)->enabled())->toBeFalse();
    });

    it('treats a blank value as off', function () {
        config(['auth.employee_default_password' => '   ']);

        expect(app(DefaultPassword::class)->enabled())->toBeFalse()
            ->and(app(DefaultPassword::class)->matches('   '))->toBeFalse();
    });

    it('sends no strength rules to the browser for employees', function () {
        useDefaultPassword();

        $this->actingAs($this->employee)->get(route('security.edit'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('passwordRules', null)
                ->where('passwordHint', 'Bebas, asal bukan kata sandi bawaan perusahaan.'));

        $this->actingAs($this->admin)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->get(route('security.edit'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('passwordRules', fn (?string $rules) => is_string($rules) && str_contains($rules, 'minlength'))
                ->where('passwordHint', 'Minimal 8 karakter dan tidak sama dengan alamat email.'));
    });

    it('lets an employee change their own password to a short one but not to the default', function () {
        useDefaultPassword();

        $this->actingAs($this->employee)->from(route('security.edit'))
            ->put(route('user-password.update'), [
                'current_password' => 'password', 'password' => SANDI_BAWAAN_UJI, 'password_confirmation' => SANDI_BAWAAN_UJI,
            ])
            ->assertSessionHasErrors(['password' => NotDefaultPassword::MESSAGE]);

        $this->actingAs($this->employee)->from(route('security.edit'))
            ->put(route('user-password.update'), [
                'current_password' => 'password', 'password' => 'kopi', 'password_confirmation' => 'kopi',
            ])
            ->assertSessionHasNoErrors();

        expect(Hash::check('kopi', (string) $this->employee->refresh()->password))->toBeTrue();
    });
});

describe('wajib ganti setelah login pertama', function () {
    it('signs in with the default password, forces a change and rejects the default there', function () {
        useDefaultPassword();
        $this->actingAs($this->hr)->post(route('admin.employees.store'), defaultPwEmployeePayload())->assertSessionHasNoErrors();
        auth()->logout();

        $this->post(route('login.store'), ['email' => 'bayu@kantor.test', 'password' => SANDI_BAWAAN_UJI])
            ->assertRedirect('/dashboard');
        $this->get('/dashboard')->assertRedirect(route('security.edit'));

        $this->from(route('security.edit'))->put(route('user-password.update'), [
            'current_password' => SANDI_BAWAAN_UJI,
            'password' => SANDI_BAWAAN_UJI,
            'password_confirmation' => SANDI_BAWAAN_UJI,
        ])->assertSessionHasErrors(['password' => NotDefaultPassword::MESSAGE]);
        $this->get('/dashboard')->assertRedirect(route('security.edit'));

        $this->from(route('security.edit'))->put(route('user-password.update'), [
            'current_password' => SANDI_BAWAAN_UJI,
            'password' => 'teh-manis',
            'password_confirmation' => 'teh-manis',
        ])->assertSessionHasNoErrors()->assertRedirect(route('dashboard'));

        $bayu = User::query()->where('email', 'bayu@kantor.test')->sole();
        expect($bayu->password_change_required)->toBeFalse()
            ->and(Hash::check('teh-manis', (string) $bayu->password))->toBeTrue();
        $this->get('/dashboard')->assertOk();
    });
});
