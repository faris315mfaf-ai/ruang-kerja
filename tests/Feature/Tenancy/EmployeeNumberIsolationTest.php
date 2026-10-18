<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\Company;
use App\Models\Division;
use App\Models\EmployeeProfile;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Plan item #3 (Fase 1): employee numbers are unique per company.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->company = Company::factory()->create(['google_domain' => 'kantor.test']);
    $this->ops = Division::factory()->forCompany($this->company)->create(['name' => 'Operasional', 'code' => 'OPS']);
    $this->hr = User::factory()->forCompany($this->company)->withRole(Role::Hr)->create(['email' => 'hr@kantor.test']);

    $this->foreign = Company::factory()->foreign()->create();
    $this->foreigner = User::factory()->forCompany($this->foreign)->create();
    EmployeeProfile::factory()->create(['user_id' => $this->foreigner->id, 'employee_number' => 'RK-0100']);
});

it('copies the user company and keeps numbers unique within a company', function () {
    $colleague = User::factory()->forCompany($this->foreign)->create();
    $mine = EmployeeProfile::factory()->create(['user_id' => User::factory()->forCompany($this->company)->create()->id, 'employee_number' => 'RK-0100']);

    expect($mine->company_id)->toBe($this->company->id)
        ->and(EmployeeProfile::query()->findOrFail($this->foreigner->id)->company_id)->toBe($this->foreign->id)
        ->and(fn () => EmployeeProfile::factory()->create(['user_id' => $colleague->id, 'employee_number' => 'RK-0100']))
        ->toThrow(UniqueConstraintViolationException::class);
});

it('accepts an employee number another company already uses', function () {
    $this->actingAs($this->hr)
        ->post(route('admin.employees.store'), [
            'name' => 'Bayu Saputra',
            'email' => 'bayu@kantor.test',
            'division_id' => $this->ops->id,
            'work_mode' => WorkMode::Office->value,
            'roles' => [Role::Anggota->value],
            'employee_number' => 'RK-0100',
        ])
        ->assertSessionHasNoErrors();

    $bayu = User::query()->where('email', 'bayu@kantor.test')->firstOrFail();

    expect($bayu->profile?->employee_number)->toBe('RK-0100')
        ->and($bayu->profile?->company_id)->toBe($this->company->id);

    // Still unique inside the company.
    $this->actingAs($this->hr)
        ->post(route('admin.employees.store'), [
            'name' => 'Citra',
            'email' => 'citra@kantor.test',
            'work_mode' => WorkMode::Office->value,
            'roles' => [Role::Anggota->value],
            'employee_number' => 'RK-0100',
        ])
        ->assertSessionHasErrors('employee_number');
});

it('imports an employee number another company already uses', function () {
    Storage::fake('local');
    $file = UploadedFile::fake()->createWithContent('karyawan.csv', implode("\n", [
        'nama,email,nomor_karyawan,divisi,tim,jabatan,atasan_email,mode_kerja,peran,tanggal_bergabung,telepon,nik',
        'Bayu Saputra,bayu@kantor.test,RK-0100,OPS,,,,Kantor,anggota,,,',
    ])."\n");

    $response = $this->actingAs($this->hr)
        ->post(route('admin.employees.import.preview'), ['file' => $file])
        ->assertSessionHasNoErrors();
    parse_str((string) parse_url((string) $response->headers->get('Location'), PHP_URL_QUERY), $query);

    $this->actingAs($this->hr)
        ->get(route('admin.employees.import', ['token' => $query['token']]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('preview.summary.error', 0)
            ->where('preview.rows.0.action', 'create'));
});
