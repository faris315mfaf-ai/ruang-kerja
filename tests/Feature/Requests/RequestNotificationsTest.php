<?php

use App\Domain\Notifications\Channels\InAppChannel;
use App\Domain\Notifications\Contracts\UserAvailability;
use App\Domain\Requests\Actions\CancelRequest;
use App\Domain\Requests\Actions\RejectStep;
use App\Domain\Requests\Actions\RequestRevision;
use App\Domain\Requests\Notifications\RequestApproved;
use App\Domain\Requests\Notifications\RequestAwaitingApproval;
use App\Domain\Requests\Notifications\RequestCanceled;
use App\Domain\Requests\Notifications\RequestRejected;
use App\Domain\Requests\Notifications\RequestRevisionRequested;
use App\Domain\Requests\Notifications\RequestStepApproved;
use App\Models\InboxNotification;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Notifications\ChannelManager;
use Illuminate\Support\Facades\Notification;
use Tests\Support\RequestScenario;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
});

it('notifies approvers and the requester at every step (database + mail)', function () {
    $s = $this->s;
    $substitute = User::factory()->create();
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14', 'substitute_id' => $substitute->id]);

    Notification::assertSentTo($s->manager, RequestAwaitingApproval::class, function (RequestAwaitingApproval $n) use ($s) {
        return in_array(InAppChannel::class, $n->via($s->manager), true)
            && in_array('mail', $n->via($s->manager), true)
            && $n->toArray($s->manager)['url'] === '/persetujuan/'.$n->request->id
            && $n->toArray($s->manager)['subject']['code'] === 'CUT-2026-10-0001'
            && $n->title($s->manager) === 'Rizky Aditya mengajukan Cuti tahunan · menunggu persetujuan Anda'
            && $n->body($s->manager) === '12–14 Okt 2026 · 3 hari kerja';
    });
    Notification::assertNotSentTo($s->hr, RequestAwaitingApproval::class);

    $request = $s->approve($s->manager, $request);
    Notification::assertSentTo($s->employee, RequestStepApproved::class, fn ($n) => $n->title($s->employee) === 'Cuti tahunan CUT-2026-10-0001 disetujui Dimas Pratama, diteruskan ke HR');
    Notification::assertSentTo($s->hr, RequestAwaitingApproval::class);

    $s->approve($s->hr, $request);
    Notification::assertSentTo($s->employee, RequestApproved::class);
    Notification::assertSentTo($substitute, RequestApproved::class, fn ($n) => str_starts_with($n->title($substitute), 'Anda menjadi pengganti Rizky Aditya'));
});

it('notifies the requester of rejections and revision requests', function () {
    $s = $this->s;
    $a = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);
    $b = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-13', 'end_date' => '2026-10-13']);

    app(RejectStep::class)->handle($s->manager, $a, 'Stok opname.');
    app(RequestRevision::class)->handle($s->manager, $b, 'Ganti tanggal.');

    Notification::assertSentTo($s->employee, RequestRejected::class, fn ($n) => $n->body($s->employee) === 'Stok opname.');
    Notification::assertSentTo($s->employee, RequestRevisionRequested::class, fn ($n) => $n->url($s->employee) === '/pengajuan/'.$b->id.'/ubah');
});

it('tells the waiting approver when a request is canceled', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);

    app(CancelRequest::class)->handle($s->employee, $request);

    Notification::assertSentTo($s->manager, RequestCanceled::class);
});

it('renders the email in Indonesian', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);

    $mail = (new RequestAwaitingApproval($request))->toMail($s->manager);

    expect($mail->subject)->toBe('Rizky Aditya mengajukan Cuti tahunan · menunggu persetujuan Anda')
        ->and($mail->viewData['actionLabel'])->toBe('Buka persetujuan')
        ->and($mail->viewData['actionUrl'])->toEndWith('/persetujuan/'.$request->id);
});

it('keeps "Perlu tindakan" in the Inbox in sync with decisions', function () {
    Notification::swap(new ChannelManager(app()));
    $s = $this->s;

    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);
    $pending = InboxNotification::query()->where('notifiable_id', $s->manager->id)->sole();

    expect($pending->action_required)->toBeTrue()->and($pending->resolved_at)->toBeNull();

    $s->approve($s->manager, $request);

    expect($pending->refresh()->resolved_at)->not->toBeNull()
        ->and(InboxNotification::query()->where('notifiable_id', $s->hr->id)->where('action_required', true)->whereNull('resolved_at')->count())->toBe(1);
});

it('reports approved leave to the notification availability contract', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']);
    $availability = app(UserAvailability::class);

    expect($availability->isOnLeave($s->employee, CarbonImmutable::parse('2026-10-12 10:00', 'Asia/Jakarta')))->toBeFalse();

    $s->approve($s->hr, $s->approve($s->manager, $request));

    expect($availability->isOnLeave($s->employee, CarbonImmutable::parse('2026-10-12 10:00', 'Asia/Jakarta')))->toBeTrue()
        ->and($availability->isOnLeave($s->employee, CarbonImmutable::parse('2026-10-14 10:00', 'Asia/Jakarta')))->toBeFalse();
});
