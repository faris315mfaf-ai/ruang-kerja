<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\WorkMode;
use App\Domain\Organization\Services\EmployeeImportStore;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Division;
use App\Models\EmployeeProfile;
use App\Models\Position;
use App\Models\Team;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Console\Scheduling\Event;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Excel as ExcelType;
use Maatwebsite\Excel\Facades\Excel;

beforeEach(function () {
    Storage::fake('local');
    $this->seed(RoleSeeder::class);

    $this->company = Company::factory()->create(['google_domain' => 'kantor.test']);
    $this->ops = Division::factory()->forCompany($this->company)->create(['name' => 'Operasional', 'code' => 'OPS']);
    Team::factory()->create(['division_id' => $this->ops->id, 'name' => 'Tim Gudang', 'code' => 'GDG']);
    Position::factory()->create(['company_id' => $this->company->id, 'name' => 'Staf Operasional']);

    $this->hr = User::factory()->forCompany($this->company)->withRole(Role::Hr)->create(['email' => 'hr@kantor.test']);
});

const IMPORT_HEADER = 'nama,email,nomor_karyawan,divisi,tim,jabatan,atasan_email,mode_kerja,peran,tanggal_bergabung,telepon,nik';

function csvUpload(string ...$lines): UploadedFile
{
    return UploadedFile::fake()->createWithContent('karyawan.csv', implode("\n", [IMPORT_HEADER, ...$lines])."\n");
}

/**
 * Upload + dry run; returns the import token.
 */
function previewImport(UploadedFile $file, ?User $actor = null): string
{
    $response = test()->actingAs($actor ?? test()->hr)
        ->post(route('admin.employees.import.preview'), ['file' => $file])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    parse_str((string) parse_url((string) $response->headers->get('Location'), PHP_URL_QUERY), $query);

    return (string) $query['token'];
}

it('previews a file, reporting bad rows with their row numbers, without writing', function () {
    $token = previewImport(csvUpload(
        'Bayu Saputra,bayu@kantor.test,RK-1,OPS,Tim Gudang,Staf Operasional,,Hybrid,anggota,2023-02-14,+62 812 1111 2222,3201010101010001',
        'Salah Domain,salah@gmail.com,,,,,,,,,,',
        ',tanpa.nama@kantor.test,,XYZ,,Jabatan Fiktif,,Terbang,raja,31-31-2023,abc,123',
    ));

    $this->actingAs($this->hr)
        ->get(route('admin.employees.import', ['token' => $token]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/employees/import')
            ->where('preview.summary', ['total' => 3, 'create' => 1, 'update' => 0, 'error' => 2])
            ->where('preview.rows.0.row', 2)
            ->where('preview.rows.0.action', 'create')
            ->where('preview.rows.1.row', 3)
            ->where('preview.rows.1.errors', ['Email harus memakai domain kantor @kantor.test.'])
            ->where('preview.rows.2.row', 4)
            ->where('preview.rows.2.errors', [
                'Nama wajib diisi.',
                'Divisi "XYZ" tidak ditemukan.',
                'Jabatan "Jabatan Fiktif" tidak ditemukan.',
                'Mode kerja "Terbang" tidak dikenal. Pakai: Kantor, Hybrid, WFH, atau Lapangan.',
                'Peran "raja" tidak dikenal.',
                'Pilih minimal satu peran.',
                'Tanggal bergabung "31-31-2023" tidak valid. Pakai format YYYY-MM-DD.',
                'Nomor telepon tidak valid.',
                'NIK harus 16 digit angka.',
            ])
            ->where('result', null)
        );

    // Dry run: nothing written, NIK not exposed.
    expect(User::query()->where('email', 'bayu@kantor.test')->exists())->toBeFalse();
    expect($this->actingAs($this->hr)->get(route('admin.employees.import', ['token' => $token]))->getContent())
        ->not->toContain('3201010101010001');
});

it('commits only the valid rows and reports the skipped ones', function () {
    $token = previewImport(csvUpload(
        'Bayu Saputra,bayu@kantor.test,RK-1,OPS,GDG,Staf Operasional,,Hybrid,anggota,14/02/2023,+62 812 1111 2222,3201010101010001',
        'Salah Domain,salah@gmail.com,,,,,,,,,,',
    ));

    $this->actingAs($this->hr)
        ->post(route('admin.employees.import.commit', $token))
        ->assertRedirect(route('admin.employees.import', ['token' => $token]));

    $bayu = User::query()->where('email', 'bayu@kantor.test')->firstOrFail();

    expect($bayu->company_id)->toBe($this->company->id)
        ->and($bayu->division_id)->toBe($this->ops->id)
        ->and($bayu->team?->name)->toBe('Tim Gudang')
        ->and($bayu->work_mode)->toBe(WorkMode::Hybrid)
        ->and($bayu->joined_at?->toDateString())->toBe('2023-02-14')
        ->and($bayu->getRoleNames()->all())->toBe(['anggota'])
        ->and($bayu->profile?->nik)->toBe('3201010101010001')
        ->and(User::query()->where('email', 'salah@gmail.com')->exists())->toBeFalse();

    $this->actingAs($this->hr)
        ->get(route('admin.employees.import', ['token' => $token]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('result.created', 1)
            ->where('result.updated', 0)
            ->where('result.summary.error', 1)
            ->where('result.rows.1.row', 3)
        );

    $summary = AuditLog::query()->where('action', 'employee.imported')->sole();
    expect($summary->new_values)->toMatchArray(['created' => 1, 'updated' => 0, 'skipped' => 1])
        ->and($summary->user_id)->toBe($this->hr->id);

    // A second commit of the same upload does nothing.
    $this->actingAs($this->hr)->post(route('admin.employees.import.commit', $token));
    expect(AuditLog::query()->where('action', 'employee.imported')->count())->toBe(1);
});

it('updates existing employees by email and keeps values of empty cells', function () {
    $bayu = User::factory()->forCompany($this->company)->withRole(Role::Anggota)->create([
        'email' => 'bayu@kantor.test', 'name' => 'Bayu Lama', 'work_mode' => WorkMode::Wfh,
    ]);
    EmployeeProfile::factory()->create(['user_id' => $bayu->id, 'nik' => '3201010101010001', 'phone' => '+62 811 000 000']);

    $token = previewImport(csvUpload('Bayu Saputra,BAYU@kantor.test,,OPS,,,,,,,,'));

    $this->actingAs($this->hr)
        ->get(route('admin.employees.import', ['token' => $token]))
        ->assertInertia(fn (Assert $page) => $page->where('preview.summary.update', 1));

    $this->actingAs($this->hr)->post(route('admin.employees.import.commit', $token));

    $bayu->refresh();
    expect(User::query()->where('email', 'bayu@kantor.test')->count())->toBe(1)
        ->and($bayu->name)->toBe('Bayu Saputra')
        ->and($bayu->division_id)->toBe($this->ops->id)
        ->and($bayu->work_mode)->toBe(WorkMode::Wfh)
        ->and($bayu->getRoleNames()->all())->toBe(['anggota'])
        ->and($bayu->profile?->nik)->toBe('3201010101010001')
        ->and($bayu->profile?->phone)->toBe('+62 811 000 000');

    // Importing the same file again is idempotent.
    $again = previewImport(csvUpload('Bayu Saputra,bayu@kantor.test,,OPS,,,,,,,,'));
    $this->actingAs($this->hr)->post(route('admin.employees.import.commit', $again));

    expect(User::query()->where('email', 'bayu@kantor.test')->count())->toBe(1);
});

it('resolves managers within the file and rejects cycles and duplicates', function () {
    $token = previewImport(csvUpload(
        'Staf Satu,staf1@kantor.test,,OPS,,,kepala@kantor.test,,,,,',
        'Kepala Baru,kepala@kantor.test,,OPS,,,,,kepala_divisi,,,',
        'Siklus A,a@kantor.test,,,,,b@kantor.test,,,,,',
        'Siklus B,b@kantor.test,,,,,a@kantor.test,,,,,',
        'Ganda,staf1@kantor.test,,,,,,,,,,',
        'Tanpa Atasan,lepas@kantor.test,,,,,hantu@kantor.test,,,,,',
    ));

    $this->actingAs($this->hr)
        ->get(route('admin.employees.import', ['token' => $token]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('preview.summary', ['total' => 6, 'create' => 2, 'update' => 0, 'error' => 4])
            ->where('preview.rows.2.errors', ['Atasan ini membentuk siklus atasan (bawahan tidak boleh menjadi atasan).'])
            ->where('preview.rows.4.errors', ['Email sama dengan baris 2.'])
            ->where('preview.rows.5.errors', ['Atasan hantu@kantor.test tidak ditemukan.'])
        );

    $this->actingAs($this->hr)->post(route('admin.employees.import.commit', $token));

    $staf = User::query()->where('email', 'staf1@kantor.test')->firstOrFail();
    $kepala = User::query()->where('email', 'kepala@kantor.test')->firstOrFail();

    expect($staf->manager_id)->toBe($kepala->id)
        ->and($kepala->hasRole(Role::KepalaDivisi))->toBeTrue()
        ->and(User::query()->whereIn('email', ['a@kantor.test', 'b@kantor.test', 'lepas@kantor.test'])->exists())->toBeFalse();
});

it('rejects a cycle with existing employees', function () {
    $boss = User::factory()->forCompany($this->company)->create(['email' => 'boss@kantor.test']);
    User::factory()->forCompany($this->company)->managedBy($boss)->create(['email' => 'anak@kantor.test']);

    $token = previewImport(csvUpload('Boss,boss@kantor.test,,,,,anak@kantor.test,,,,,'));

    $this->actingAs($this->hr)
        ->get(route('admin.employees.import', ['token' => $token]))
        ->assertInertia(fn (Assert $page) => $page->where('preview.summary.error', 1));
});

it('does not let HR import the super_admin role or change a super admin', function () {
    User::factory()->forCompany($this->company)->withRole(Role::SuperAdmin)->create(['email' => 'admin@kantor.test']);

    $token = previewImport(csvUpload(
        'Calon Admin,calon@kantor.test,,,,,,,super_admin,,,',
        'Admin,admin@kantor.test,,,,,,,anggota,,,',
    ));

    $this->actingAs($this->hr)
        ->get(route('admin.employees.import', ['token' => $token]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('preview.rows.0.errors', ['Hanya Super Admin yang dapat memberikan atau mencabut peran Super Admin, Direksi, atau HR.'])
            ->where('preview.rows.1.errors.0', 'Hanya Super Admin yang dapat mengubah data Super Admin.')
        );
});

it('does not let HR import direksi/hr roles or change their own roles', function () {
    $token = previewImport(csvUpload(
        'Calon Direksi,direksi.baru@kantor.test,,,,,,,direksi,,,',
        'Calon HR,hr.baru@kantor.test,,,,,,,hr,,,',
        'HR,hr@kantor.test,,,,,,,hr;kepala_divisi,,,',
        'Calon Kadiv,kadiv.baru@kantor.test,,,,,,,kepala_divisi,,,',
    ));

    $this->actingAs($this->hr)
        ->get(route('admin.employees.import', ['token' => $token]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('preview.rows.0.errors', ['Hanya Super Admin yang dapat memberikan atau mencabut peran Super Admin, Direksi, atau HR.'])
            ->where('preview.rows.1.errors', ['Hanya Super Admin yang dapat memberikan atau mencabut peran Super Admin, Direksi, atau HR.'])
            ->where('preview.rows.2.errors', ['Anda tidak dapat mengubah peran Anda sendiri.'])
            ->where('preview.rows.3.errors', [])
        );
});

it('reports missing required columns for the whole file', function () {
    $file = UploadedFile::fake()->createWithContent('karyawan.csv', "nama;divisi\nBayu;OPS\n");
    $token = previewImport($file);

    $this->actingAs($this->hr)
        ->get(route('admin.employees.import', ['token' => $token]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('preview.fileErrors.0', 'Kolom wajib tidak ditemukan: email. Gunakan templat impor.')
        );
});

it('reads XLSX files with Excel dates and numeric NIK', function () {
    $sheet = new class implements FromArray
    {
        public function array(): array
        {
            return [
                explode(',', IMPORT_HEADER),
                ['Bayu', 'bayu@kantor.test', 'RK-9', 'Operasional', '', 'staf operasional', '', 'lapangan', 'Anggota', 44971, '', 3201010101010001],
            ];
        }
    };
    $file = UploadedFile::fake()->createWithContent('karyawan.xlsx', Excel::raw($sheet, ExcelType::XLSX));

    $token = previewImport($file);
    $this->actingAs($this->hr)->post(route('admin.employees.import.commit', $token));

    $bayu = User::query()->where('email', 'bayu@kantor.test')->firstOrFail();
    expect($bayu->joined_at?->toDateString())->toBe('2023-02-14')
        ->and($bayu->work_mode)->toBe(WorkMode::Field)
        ->and($bayu->profile?->nik)->toBe('3201010101010001');
});

it('rejects other file types', function () {
    $this->actingAs($this->hr)
        ->post(route('admin.employees.import.preview'), ['file' => UploadedFile::fake()->create('foto.png', 10, 'image/png')])
        ->assertSessionHasErrors('file');
});

it('serves the template in CSV and XLSX', function (string $format) {
    $response = $this->actingAs($this->hr)->get(route('admin.employees.import.template', $format));

    $response->assertOk()->assertDownload("templat-impor-karyawan.{$format}");
})->with(['csv', 'xlsx']);

it('keeps an import private to the uploader and forbids anggota', function () {
    $token = previewImport(csvUpload('Bayu,bayu@kantor.test,,,,,,,,,,'));
    $otherHr = User::factory()->forCompany($this->company)->withRole(Role::Hr)->create();
    $anggota = User::factory()->forCompany($this->company)->withRole(Role::Anggota)->create();

    $this->actingAs($otherHr)
        ->get(route('admin.employees.import', ['token' => $token]))
        ->assertInertia(fn (Assert $page) => $page->where('preview', null)->where('expired', true));

    $this->actingAs($otherHr)->post(route('admin.employees.import.commit', $token));
    expect(User::query()->where('email', 'bayu@kantor.test')->exists())->toBeFalse();

    $this->actingAs($anggota)
        ->post(route('admin.employees.import.preview'), ['file' => csvUpload('X,x@kantor.test,,,,,,,,,,')])
        ->assertForbidden();
    $this->actingAs($anggota)->post(route('admin.employees.import.commit', $token))->assertForbidden();
    $this->actingAs($anggota)->get(route('admin.employees.import.template', 'csv'))->assertForbidden();
});

describe('uploaded file retention (contains NIK)', function () {
    it('deletes the previous uncommitted upload when the same user uploads again', function () {
        $first = previewImport(csvUpload('Bayu,bayu@kantor.test,,,,,,,,,,3201010101010001'));
        $firstFiles = Storage::disk('local')->allFiles(EmployeeImportStore::DIRECTORY);

        $second = previewImport(csvUpload('Citra,citra@kantor.test,,,,,,,,,,3201010101010002'));

        expect($firstFiles)->toHaveCount(1)
            ->and(Storage::disk('local')->allFiles(EmployeeImportStore::DIRECTORY))->toHaveCount(1)
            ->and(Storage::disk('local')->exists($firstFiles[0]))->toBeFalse()
            ->and(app(EmployeeImportStore::class)->get($first, $this->hr))->toBeNull()
            ->and(app(EmployeeImportStore::class)->get($second, $this->hr))->not->toBeNull();
    });

    it('does not extend the import session on update, so it never outlives its file', function () {
        $token = previewImport(csvUpload('Bayu,bayu@kantor.test,,,,,,,,,,'));

        $this->travel(50)->minutes();
        app(EmployeeImportStore::class)->update($token, ['preview' => []]);
        $this->travel(11)->minutes();

        expect(app(EmployeeImportStore::class)->get($token, $this->hr))->toBeNull();
    });

    it('prunes upload files older than the TTL every hour', function () {
        $disk = Storage::disk('local');
        $disk->put(EmployeeImportStore::DIRECTORY.'/old.csv', 'nik');
        $disk->put(EmployeeImportStore::DIRECTORY.'/fresh.csv', 'nik');
        touch($disk->path(EmployeeImportStore::DIRECTORY.'/old.csv'), now()->subMinutes(EmployeeImportStore::TTL_MINUTES + 1)->getTimestamp());

        $this->artisan('employee-imports:prune')->expectsOutput('1 berkas impor kedaluwarsa dihapus.')->assertSuccessful();

        expect($disk->exists(EmployeeImportStore::DIRECTORY.'/old.csv'))->toBeFalse()
            ->and($disk->exists(EmployeeImportStore::DIRECTORY.'/fresh.csv'))->toBeTrue();

        $events = collect(app(Schedule::class)->events())
            ->filter(fn (Event $event) => str_contains((string) $event->command, 'employee-imports:prune'));

        expect($events)->toHaveCount(1)
            ->and($events->first()->expression)->toBe('0 * * * *');
    });
});
