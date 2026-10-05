<?php

use App\Casts\PostgresTextArray;
use App\Domain\Google\Data\DriveMember;
use App\Domain\Google\Data\DrivePermission;
use App\Domain\Google\Enums\AttachmentSource;
use App\Domain\Google\Enums\DriveFileKind;
use App\Domain\Google\Enums\DriveRole;
use App\Domain\Google\Enums\GoogleDocType;
use App\Models\Attachment;
use App\Models\DriveFile;
use App\Models\GoogleAccount;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;

it('stores Google tokens encrypted and never serializes them', function () {
    $account = GoogleAccount::factory()->create([
        'access_token' => 'ya29.plain-access',
        'refresh_token' => '1//plain-refresh',
    ]);

    $raw = DB::table('google_accounts')->where('id', $account->id)->first();

    expect($raw->access_token)->not->toContain('plain-access')
        ->and($raw->refresh_token)->not->toContain('plain-refresh')
        ->and($account->refresh()->access_token)->toBe('ya29.plain-access')
        ->and($account->toArray())->not->toHaveKeys(['access_token', 'refresh_token']);
});

it('round-trips scopes through the Postgres text[] column', function () {
    $scopes = ['openid', 'https://www.googleapis.com/auth/drive.file', 'with "quote", comma\\slash'];

    $account = GoogleAccount::factory()->create(['scopes' => $scopes]);

    expect($account->refresh()->scopes)->toBe($scopes)
        ->and(DB::scalar('select array_length(scopes, 1) from google_accounts where id = ?', [$account->id]))->toBe(3);
});

it('parses Postgres array literals', function (string $literal, array $expected) {
    expect(PostgresTextArray::parse($literal))->toBe($expected);
})->with([
    ['{}', []],
    ['{a,b}', ['a', 'b']],
    ['{"a b","c,d"}', ['a b', 'c,d']],
    ['{"say \"hi\"",x}', ['say "hi"', 'x']],
    ['{""}', ['']],
]);

it('knows when a Google token is expired or needs a reconnect', function () {
    $this->travelTo(now());

    $fresh = GoogleAccount::factory()->make(['expires_at' => now()->addMinutes(10)]);
    $soon = GoogleAccount::factory()->make(['expires_at' => now()->addSeconds(30)]);
    $revoked = GoogleAccount::factory()->revoked()->make();

    expect($fresh->tokenExpired())->toBeFalse()
        ->and($soon->tokenExpired())->toBeTrue()
        ->and($soon->needsReconnect())->toBeFalse()
        ->and($revoked->needsReconnect())->toBeTrue()
        ->and(GoogleAccount::factory()->withoutDriveScope()->make()->hasDriveAccess())->toBeFalse()
        ->and($fresh->hasDriveAccess())->toBeTrue();
});

it('maps mime types to file kinds with Indonesian labels', function (string $mime, DriveFileKind $kind, string $label) {
    expect(DriveFileKind::fromMimeType($mime))->toBe($kind)
        ->and($kind->label())->toBe($label);
})->with([
    ['application/vnd.google-apps.document', DriveFileKind::Doc, 'Google Docs'],
    ['application/vnd.google-apps.spreadsheet', DriveFileKind::Sheet, 'Google Sheets'],
    ['application/vnd.google-apps.presentation', DriveFileKind::Slide, 'Google Slides'],
    ['application/pdf', DriveFileKind::Pdf, 'PDF'],
    ['image/png', DriveFileKind::Image, 'Gambar'],
    ['application/vnd.google-apps.folder', DriveFileKind::Folder, 'Folder'],
    ['application/zip', DriveFileKind::Other, 'File'],
]);

it('describes the document types of "Dokumen baru"', function () {
    expect(GoogleDocType::Document->mimeType())->toBe('application/vnd.google-apps.document')
        ->and(GoogleDocType::Spreadsheet->kind())->toBe(DriveFileKind::Sheet)
        ->and(GoogleDocType::Presentation->label())->toBe('Google Slides')
        ->and(GoogleDocType::Document->defaultName())->toBe('Dokumen tanpa judul')
        ->and(AttachmentSource::Drive->label())->toBe('Google Drive')
        ->and(AttachmentSource::Storage->label())->toBe('Penyimpanan aplikasi');
});

it('maps workspace roles to Drive roles (viewer reads, everyone else writes)', function (string $workspaceRole, DriveRole $expected) {
    expect(DriveRole::forWorkspaceRole($workspaceRole))->toBe($expected)
        ->and(DriveMember::forWorkspaceRole(' Rizky@Demo.test ', $workspaceRole)->email)->toBe('rizky@demo.test');
})->with([
    ['owner', DriveRole::Writer],
    ['admin', DriveRole::Writer],
    ['member', DriveRole::Writer],
    ['viewer', DriveRole::Reader],
]);

it('orders Drive roles and labels them in Indonesian', function () {
    expect(DriveRole::Writer->covers(DriveRole::Reader))->toBeTrue()
        ->and(DriveRole::Reader->covers(DriveRole::Commenter))->toBeFalse()
        ->and(DriveRole::fromDrive('fileOrganizer'))->toBe(DriveRole::Writer)
        ->and(DriveRole::fromDrive('unknown'))->toBeNull()
        ->and(array_map(fn (DriveRole $role) => $role->label(), DriveRole::cases()))
        ->toBe(['Dapat mengedit', 'Dapat berkomentar', 'Hanya melihat']);
});

it('reads inherited and direct access from Drive permission details', function () {
    $inherited = DrivePermission::fromApi(['id' => '1', 'type' => 'user', 'role' => 'organizer', 'emailAddress' => 'A@x.test', 'permissionDetails' => [['inherited' => true]]]);
    $both = DrivePermission::fromApi(['id' => '2', 'type' => 'user', 'role' => 'writer', 'emailAddress' => 'b@x.test', 'permissionDetails' => [['inherited' => true], ['inherited' => false]]]);
    $direct = DrivePermission::fromApi(['id' => '3', 'type' => 'user', 'role' => 'reader', 'emailAddress' => 'c@x.test']);

    expect($inherited->inherited)->toBeTrue()->and($inherited->direct)->toBeFalse()->and($inherited->email())->toBe('a@x.test')
        ->and($both->inherited)->toBeTrue()->and($both->direct)->toBeTrue()->and($both->isManagedUser())->toBeFalse()
        ->and($direct->isManagedUser())->toBeTrue();
});

it('builds iframe preview urls per kind', function () {
    $doc = DriveFile::factory()->make(['google_file_id' => 'abc', 'kind' => DriveFileKind::Doc]);
    $sheet = DriveFile::factory()->make(['google_file_id' => 'abc', 'kind' => DriveFileKind::Sheet]);
    $slide = DriveFile::factory()->make(['google_file_id' => 'abc', 'kind' => DriveFileKind::Slide]);
    $pdf = DriveFile::factory()->make(['google_file_id' => 'abc', 'kind' => DriveFileKind::Pdf]);
    $folder = DriveFile::factory()->make(['google_file_id' => 'abc', 'kind' => DriveFileKind::Folder]);

    expect($doc->previewUrl())->toBe('https://docs.google.com/document/d/abc/preview')
        ->and($sheet->previewUrl())->toBe('https://docs.google.com/spreadsheets/d/abc/preview')
        ->and($slide->previewUrl())->toBe('https://docs.google.com/presentation/d/abc/preview')
        ->and($pdf->previewUrl())->toBe('https://drive.google.com/file/d/abc/preview')
        ->and($folder->previewUrl())->toBeNull();
});

it('filters cached files by folder and document kinds', function () {
    $workspace = Workspace::factory()->create()->id;
    DriveFile::factory()->create(['workspace_id' => $workspace, 'parent_google_id' => 'folder-a']);
    DriveFile::factory()->pdf()->create(['workspace_id' => $workspace, 'parent_google_id' => 'folder-a']);
    DriveFile::factory()->create(['workspace_id' => $workspace, 'parent_google_id' => 'folder-b']);

    expect(DriveFile::query()->inFolder('folder-a')->count())->toBe(2)
        ->and(DriveFile::query()->documents()->count())->toBe(2);
});

it('keeps showing an attachment whose Drive file was removed from the cache', function () {
    $attachment = Attachment::factory()->create();
    $attachment->driveFile?->delete();

    expect($attachment->fresh()?->driveFile?->trashed())->toBeTrue();
});
