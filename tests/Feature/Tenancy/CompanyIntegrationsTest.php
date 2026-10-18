<?php

use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Domain\Google\GoogleFeatures;
use App\Domain\Google\Jobs\CreateDriveFolder;
use App\Domain\Google\Services\DriveFolderService;
use App\Domain\Google\Services\GoogleClientFactory;
use App\Domain\Google\Testing\FakeDriveClient;
use App\Domain\Notifications\Digest\DailyDigestMail;
use App\Domain\Notifications\Digest\Data\DailyDigest;
use App\Domain\Notifications\Notifications\TestNotification;
use App\Domain\Notifications\Services\EvolutionWhatsApp;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Mail\DesktopLinkMail;
use App\Domain\Tenancy\Actions\ConfigureCompany;
use App\Domain\Tenancy\CompanyContext;
use App\Domain\Tenancy\Settings\CompanySettings;
use App\Domain\Tenancy\Support\CompanyBranding;
use App\Domain\Workspaces\Queries\WorkspaceDriveListing;
use App\Events\Workspaces\WorkspaceCreated;
use App\Listeners\Workspaces\CreateWorkspaceDriveFolder;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Factories\CompanyFactory;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;

/*
 * Fase 1 multi-perusahaan, langkah 2c: integrations that used to be global
 * (one WhatsApp group, one Shared Drive, one company name on emails) now
 * belong to a company (`companies.settings`, CompanySettings), configured
 * with `php artisan company:configure`. The global config only stands in
 * while a company is the only one.
 */

defined('CI_HOME_GROUP') || define('CI_HOME_GROUP', '120363111111111111@g.us');
defined('CI_ENV_GROUP') || define('CI_ENV_GROUP', '120363000000000000@g.us');

beforeEach(function () {
    $this->seed(RoleSeeder::class);

    $this->home = Company::factory()->create(['name' => 'PT Rumah Satu', 'google_domain' => 'rumah.test']);
    $this->foreign = Company::factory()->foreign()->create(['name' => 'PT Asing Dua', 'google_domain' => 'asing.test']);

    config([
        'notifications.channels.whatsapp.enabled' => true,
        'notifications.channels.whatsapp.group_jid' => CI_ENV_GROUP,
        'services.evolution.url' => 'http://evolution.test',
        'services.evolution.api_key' => 'test-key',
        'branding.company_name' => 'PT Nama Dari Env',
    ]);
});

function configureTestCompany(Company $company, array $settings = [], ?string $timezone = null): array
{
    return app(ConfigureCompany::class)->handle($company, $settings, $timezone);
}

// ---------------------------------------------------------------------------
// Settings & fallback
// ---------------------------------------------------------------------------

test('the global config only stands in while a company is the only one', function () {
    $settings = CompanySettings::resolve();

    // Two companies: neither inherits the old global group or Drive.
    expect($settings->whatsappGroupJid($this->home->id))->toBeNull()
        ->and($settings->whatsappGroupJid($this->foreign->id))->toBeNull()
        ->and($settings->usesGlobalFallback($this->home->id))->toBeFalse();

    // Back to a single company (the other one deleted): the env values apply again.
    $this->foreign->delete();

    expect($settings->usesGlobalFallback($this->home->id))->toBeTrue()
        ->and($settings->whatsappGroupJid($this->home->id))->toBe(CI_ENV_GROUP);

    // An own value always wins over the fallback.
    configureTestCompany($this->home, [CompanySettings::WHATSAPP_GROUP_JID => CI_HOME_GROUP]);

    expect($settings->whatsappGroupJid($this->home->id))->toBe(CI_HOME_GROUP);
});

test('a company can switch its attendance copies off', function () {
    configureTestCompany($this->home, [CompanySettings::WHATSAPP_GROUP_JID => CI_HOME_GROUP, CompanySettings::WHATSAPP_ENABLED => false]);

    expect(CompanySettings::resolve()->whatsappGroupJid($this->home->id))->toBeNull();

    configureTestCompany($this->home, [CompanySettings::WHATSAPP_ENABLED => null]);

    expect(CompanySettings::resolve()->whatsappGroupJid($this->home->id))->toBe(CI_HOME_GROUP);
});

test('the attendance copy goes to the employee\'s own company group, a company without one is skipped with a log line', function () {
    configureTestCompany($this->home, [CompanySettings::WHATSAPP_GROUP_JID => CI_HOME_GROUP]);
    Log::spy();

    $gateway = app(EvolutionWhatsApp::class);

    expect($gateway->attendanceGroupFor($this->home->id))->toBe(CI_HOME_GROUP)
        ->and($gateway->attendanceGroupFor($this->foreign->id))->toBeNull();

    Log::shouldHaveReceived('info')->with('whatsapp.attendance skipped: company has no group', ['company' => $this->foreign->id])->once();

    // Gateway off: nothing for anyone, whatever the company settings.
    config(['notifications.channels.whatsapp.enabled' => false]);

    expect($gateway->attendanceGroupFor($this->home->id))->toBeNull();
});

// ---------------------------------------------------------------------------
// company:configure & company:list
// ---------------------------------------------------------------------------

test('company:configure writes the settings and the timezone with an audit row', function () {
    $this->artisan('company:configure', [
        'company' => 'asing.test',
        '--whatsapp-group' => '120363222222222222@g.us',
        '--shared-drive' => '0AZZB0C0RDRIVE1234',
        '--shared-drive-name' => 'Drive Asing',
        '--timezone' => 'Asia/Makassar',
    ])->assertSuccessful();

    $company = $this->foreign->fresh();

    expect(data_get($company->settings, 'whatsapp.group_jid'))->toBe('120363222222222222@g.us')
        ->and(data_get($company->settings, 'google.shared_drive_id'))->toBe('0AZZB0C0RDRIVE1234')
        ->and(data_get($company->settings, 'google.shared_drive_name'))->toBe('Drive Asing')
        ->and($company->timezone)->toBe('Asia/Makassar')
        // The test-world flag of the factory is kept: only the given keys change.
        ->and(data_get($company->settings, CompanyFactory::FOREIGN_FLAG))->toBe('foreign');

    $audit = AuditLog::query()->where('action', 'company.configured')->sole();

    expect($audit->auditable_id)->toBe($this->foreign->id)
        ->and($audit->getAttribute('company_id'))->toBe($this->foreign->id)
        ->and($audit->new_values)->toMatchArray(['whatsapp.group_jid' => '120363222222222222@g.us', 'timezone' => 'Asia/Makassar'])
        ->and($audit->old_values)->toMatchArray(['whatsapp.group_jid' => null, 'timezone' => 'Asia/Jakarta']);

    // Empty value removes the key; --whatsapp=off stores the switch.
    $this->artisan('company:configure', ['company' => $this->foreign->id, '--whatsapp-group' => '', '--whatsapp' => 'off'])->assertSuccessful();

    $settings = $this->foreign->fresh()->settings;

    expect(data_get($settings, 'whatsapp.group_jid'))->toBeNull()
        ->and(data_get($settings, 'whatsapp.enabled'))->toBeFalse()
        ->and(data_get($settings, 'google.shared_drive_id'))->toBe('0AZZB0C0RDRIVE1234');
});

test('company:configure rejects invalid input and unknown companies without changing anything', function (array $options) {
    $before = $this->foreign->fresh()->only(['settings', 'timezone']);

    $this->artisan('company:configure', ['company' => 'asing.test', ...$options])->assertFailed();

    expect($this->foreign->fresh()->only(['settings', 'timezone']))->toBe($before)
        ->and(AuditLog::query()->where('action', 'company.configured')->exists())->toBeFalse();
})->with([
    'not a group jid' => [['--whatsapp-group' => '6281234567890']],
    'bad drive id' => [['--shared-drive' => 'drive id with spaces']],
    'unknown timezone' => [['--timezone' => 'Asia/Atlantis']],
    'bad switch' => [['--whatsapp' => 'maybe']],
    'nothing to do' => [[]],
]);

test('company:configure refuses an unknown company', function () {
    $this->artisan('company:configure', ['company' => 'tidak-ada.test', '--timezone' => 'Asia/Jakarta'])->assertFailed();
});

test('company:list shows every company with the settings that apply', function () {
    configureTestCompany($this->home, [CompanySettings::WHATSAPP_GROUP_JID => CI_HOME_GROUP]);

    $this->artisan('company:list')
        // One expectation per table row (each row is a single write).
        ->expectsOutputToContain(CI_HOME_GROUP)
        ->expectsOutputToContain('PT Asing Dua')
        ->assertSuccessful();
});

// ---------------------------------------------------------------------------
// Data migration: env values → first company
// ---------------------------------------------------------------------------

test('the data migration copies the env group and Shared Drive to the first company only', function () {
    config(['google.shared_drive_id' => '0ASPKDDRIVE123456', 'google.shared_drive_name' => 'RuangKerja SPKD']);
    $migration = require database_path('migrations/2026_10_23_235100_copy_integration_settings_to_first_company.php');

    $migration->up();

    $home = $this->home->fresh();

    expect(data_get($home->settings, 'whatsapp.group_jid'))->toBe(CI_ENV_GROUP)
        ->and(data_get($home->settings, 'google.shared_drive_id'))->toBe('0ASPKDDRIVE123456')
        ->and(data_get($home->settings, 'google.shared_drive_name'))->toBe('RuangKerja SPKD')
        ->and(data_get($this->foreign->fresh()->settings, 'whatsapp'))->toBeNull()
        ->and(data_get($this->foreign->fresh()->settings, 'google'))->toBeNull();

    // Idempotent, and a value set later is kept by down().
    $migration->up();
    configureTestCompany($this->home->fresh(), [CompanySettings::WHATSAPP_GROUP_JID => CI_HOME_GROUP]);
    $migration->down();

    $home = $this->home->fresh();

    expect(data_get($home->settings, 'whatsapp.group_jid'))->toBe(CI_HOME_GROUP)
        ->and(data_get($home->settings, 'google'))->toBeNull();
});

test('the data migration never overwrites a company\'s own value', function () {
    configureTestCompany($this->home, [CompanySettings::WHATSAPP_GROUP_JID => CI_HOME_GROUP]);
    $migration = require database_path('migrations/2026_10_23_235100_copy_integration_settings_to_first_company.php');

    $migration->up();

    expect(data_get($this->home->fresh()->settings, 'whatsapp.group_jid'))->toBe(CI_HOME_GROUP);
});

// ---------------------------------------------------------------------------
// Google Shared Drive per company
// ---------------------------------------------------------------------------

test('a company without its own Shared Drive has Drive off, never the first company\'s Drive', function () {
    $drive = FakeDriveClient::fake();
    $foreignWorkspace = CompanyFactory::within($this->foreign, fn (): Workspace => Workspace::factory()->team()->create(['name' => 'Tim Asing', 'key' => 'ZZT']));
    $admin = CompanyFactory::within($this->foreign, fn (): User => User::factory()->withRole(Role::SuperAdmin)->create());

    expect(GoogleFeatures::enabled($this->foreign->id))->toBeFalse()
        ->and(GoogleFeatures::missingDriveSettings($this->foreign->id))->toContain(GoogleFeatures::COMPANY_SHARED_DRIVE_SETTING)
        // Without a company (console) the global configuration still applies.
        ->and(GoogleFeatures::enabled())->toBeTrue();

    expect(fn () => app(GoogleClientFactory::class)->sharedDriveId($this->foreign->id))->toThrow(GoogleNotConfigured::class)
        ->and(fn () => app(DriveFolderService::class)->ensure($foreignWorkspace))->toThrow(GoogleNotConfigured::class);

    // The workspace listener does not even queue the folder job.
    Queue::fake();
    (new CreateWorkspaceDriveFolder)->handle(new WorkspaceCreated($foreignWorkspace));
    Queue::assertNotPushed(CreateDriveFolder::class);

    // The File tab says Drive is off (with the setting to fill for the Super Admin).
    $props = app(WorkspaceDriveListing::class)->drive($foreignWorkspace, $admin);

    expect($props['enabled'])->toBeFalse()
        ->and($props['missing_settings'])->toContain(GoogleFeatures::COMPANY_SHARED_DRIVE_SETTING)
        ->and($props['access']['state'])->toBe('disabled');

    $drive->assertNoWrites();
});

test('the current company context decides when no company is passed', function () {
    FakeDriveClient::fake();

    expect(app(CompanyContext::class)->run($this->foreign, fn (): bool => GoogleFeatures::enabled()))->toBeFalse();

    configureTestCompany($this->foreign, [CompanySettings::SHARED_DRIVE_ID => '0AZZB0C0RDRIVE1234']);

    expect(app(CompanyContext::class)->run($this->foreign, fn (): bool => GoogleFeatures::enabled()))->toBeTrue()
        ->and(app(CompanyContext::class)->run($this->foreign, fn (): string => app(GoogleClientFactory::class)->sharedDriveId()))->toBe('0AZZB0C0RDRIVE1234');
});

test('each company\'s workspace folders are created in its own Shared Drive', function () {
    $drive = FakeDriveClient::fake();
    $drive->addSharedDrive('0AZZB0C0RDRIVE1234', 'Drive Asing');
    configureTestCompany($this->home, [CompanySettings::SHARED_DRIVE_ID => FakeDriveClient::SHARED_DRIVE_ID]);
    configureTestCompany($this->foreign, [CompanySettings::SHARED_DRIVE_ID => '0AZZB0C0RDRIVE1234', CompanySettings::SHARED_DRIVE_NAME => 'Drive Asing']);

    $homeWorkspace = Workspace::factory()->team()->create(['name' => 'Tim Rumah', 'key' => 'RMH']);
    $foreignWorkspace = CompanyFactory::within($this->foreign, fn (): Workspace => Workspace::factory()->team()->create(['name' => 'Tim Asing', 'key' => 'ZZT']));
    $admin = CompanyFactory::within($this->foreign, fn (): User => User::factory()->withRole(Role::SuperAdmin)->create());

    app(DriveFolderService::class)->ensure($homeWorkspace);
    app(DriveFolderService::class)->ensure($foreignWorkspace);

    $drive->assertFolderCreated('Tim Rumah [RMH]', FakeDriveClient::SHARED_DRIVE_ID);
    $drive->assertFolderCreated('Tim Asing [ZZT]', '0AZZB0C0RDRIVE1234');

    $props = app(WorkspaceDriveListing::class)->drive($foreignWorkspace->fresh(), $admin);

    expect($props['enabled'])->toBeTrue()
        ->and($props['shared_drive_name'])->toBe('Drive Asing')
        ->and($props['missing_settings'])->not->toContain(GoogleFeatures::COMPANY_SHARED_DRIVE_SETTING);
});

// ---------------------------------------------------------------------------
// Company name on emails
// ---------------------------------------------------------------------------

test('emails carry the recipient\'s company name, not a fixed one', function () {
    $foreignUser = CompanyFactory::within($this->foreign, fn (): User => User::factory()->create(['name' => 'Bima Asing']));
    $homeUser = User::factory()->create(['name' => 'Rani Rumah']);

    $notificationToForeign = (string) (new TestNotification)->toMail($foreignUser)->render();
    $notificationToHome = (string) (new TestNotification)->toMail($homeUser)->render();
    $digest = (new DailyDigestMail(new DailyDigest($foreignUser, CarbonImmutable::parse('2026-10-23'), []), '07:30'))->render();
    $link = (new DesktopLinkMail('Bima Asing', 'https://app.test/admin', CompanyBranding::name(recipient: $foreignUser)))->render();

    foreach ([$notificationToForeign, $digest, $link] as $html) {
        expect($html)->toContain('PT Asing Dua')
            ->not->toContain('PT Rumah Satu')
            ->not->toContain('PT Nama Dari Env');
    }

    expect($notificationToHome)->toContain('PT Rumah Satu')->not->toContain('PT Asing Dua');
});

test('the company name falls back to the context, then to BRANDING_COMPANY_NAME', function () {
    expect(CompanyBranding::name())->toBe('PT Nama Dari Env')
        ->and(app(CompanyContext::class)->run($this->foreign, fn (): ?string => CompanyBranding::name()))->toBe('PT Asing Dua')
        ->and(CompanyBranding::name('PT Eksplisit'))->toBe('PT Eksplisit');
});
