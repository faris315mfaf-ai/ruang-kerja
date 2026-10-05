<?php

use App\Domain\Google\Actions\AttachDriveFile;
use App\Domain\Google\Actions\RemoveAttachment;
use App\Domain\Google\Exceptions\GoogleNotConnected;
use App\Domain\Google\Testing\FakeDriveClient;
use App\Models\Attachment;
use App\Models\DriveFile;
use App\Models\GoogleAccount;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Tests\Fixtures\Google\FolderOwner;
use Tests\Fixtures\Google\GoogleTesting;

beforeEach(function () {
    $this->drive = FakeDriveClient::fake();
    $this->user = User::factory()->create();
    $this->task = FolderOwner::createWith('Tugas PLQ-21', [$this->user->email => 'member']);
    $this->workspaceId = (string) str()->ulid();
});

it('imports a picked file with the user own credentials and attaches it once', function () {
    $myDrive = $this->drive->seedFolder('My Drive');
    $picked = $this->drive->seedFile('Daftar fitur & harga', 'application/vnd.google-apps.spreadsheet', $myDrive->id, ownerEmail: 'sari@demo.test');
    $this->drive->resetCalls();

    $first = app(AttachDriveFile::class)->handle($this->user, $this->task, $this->workspaceId, $picked->id);
    $second = app(AttachDriveFile::class)->handle($this->user, $this->task, $this->workspaceId, $picked->id);

    $file = DriveFile::query()->sole();

    expect($second->id)->toBe($first->id)
        ->and(Attachment::query()->count())->toBe(1)
        ->and($file->name)->toBe('Daftar fitur & harga')
        ->and($file->workspace_id)->toBe($this->workspaceId)
        ->and($file->owner_email)->toBe('sari@demo.test')
        ->and($file->parent_google_id)->toBe($myDrive->id)
        ->and($first->filename)->toBe('Daftar fitur & harga')
        ->and(array_unique(array_column($this->drive->calls('files.get'), 'actor')))->toBe([$this->user->email]);
});

it('rejects malformed file ids', function () {
    app(AttachDriveFile::class)->handle($this->user, $this->task, $this->workspaceId, '../../etc');
})->throws(ValidationException::class);

it('needs a connected Google account in real mode', function () {
    GoogleTesting::disable();
    GoogleTesting::configureOAuth();

    app(AttachDriveFile::class)->handle($this->user, $this->task, $this->workspaceId, 'abcdefghijklmnop');
})->throws(GoogleNotConnected::class);

it('fetches metadata with the user token and the 10 second timeout', function () {
    GoogleTesting::disable();
    GoogleTesting::configureOAuth();
    Http::preventStrayRequests();
    GoogleAccount::factory()->for($this->user)->create(['access_token' => 'ya29.user-token']);

    $timeout = null;
    Http::fake(['www.googleapis.com/drive/v3/files/abcdefghijklmnop*' => function (Request $request, array $options) use (&$timeout) {
        $timeout = $options['timeout'];

        return Http::response(['id' => 'abcdefghijklmnop', 'name' => 'Siaran pers', 'mimeType' => 'application/vnd.google-apps.document', 'webViewLink' => 'https://docs.google.com/document/d/abcdefghijklmnop/edit']);
    }]);

    app(AttachDriveFile::class)->handle($this->user, $this->task, $this->workspaceId, 'abcdefghijklmnop');

    expect($timeout)->toBe(10);
    Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer ya29.user-token'));
});

it('detaches without touching the Drive file', function () {
    $attachment = Attachment::factory()->create();

    app(RemoveAttachment::class)->handle($attachment);

    expect($attachment->fresh()?->trashed())->toBeTrue()
        ->and(DriveFile::query()->count())->toBe(1);
    $this->drive->assertNothingCalled();
});
