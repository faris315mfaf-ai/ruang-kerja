<?php

use App\Domain\Notifications\Digest\Sections\InboxActionSection;
use App\Domain\Requests\Actions\RejectStep;
use App\Domain\Requests\Actions\RequestRevision;
use App\Domain\Requests\Digest\PendingApprovalsSection;
use App\Domain\Requests\Notifications\RequestApproved;
use App\Domain\Requests\Notifications\RequestAwaitingApproval;
use App\Domain\Requests\Notifications\RequestNotification;
use App\Domain\Requests\Notifications\RequestRejected;
use App\Domain\Requests\Notifications\RequestRevisionRequested;
use App\Domain\Requests\Notifications\RequestStepApproved;
use App\Models\AuditLog;
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

/**
 * Subject + rendered HTML and text bodies of a notification email, and the WhatsApp text.
 *
 * @return array{subject: string, html: string, text: string, whatsapp: string}
 */
function renderedMail(RequestNotification $notification, User $to): array
{
    $mail = $notification->toMail($to);
    $views = $mail->view;
    $html = view(is_array($views) ? $views['html'] : $views, $mail->viewData)->render();
    $text = is_array($views) ? view($views['text'], $mail->viewData)->render() : '';

    return [
        'subject' => (string) $mail->subject,
        'html' => html_entity_decode($html),
        'text' => $text,
        'whatsapp' => $notification->toWhatsApp($to)->text,
    ];
}

it('keeps rejection and revision notes out of email and WhatsApp, but in the app', function () {
    $s = $this->s;
    $a = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);
    $b = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-13', 'end_date' => '2026-10-13']);

    app(RejectStep::class)->handle($s->manager, $a, 'Kinerja bulan lalu kurang, stok opname.');
    app(RequestRevision::class)->handle($s->manager, $b, 'Ganti tanggal karena rapat direksi.');

    Notification::assertSentTo($s->employee, RequestRejected::class, function (RequestRejected $n) use ($s) {
        $mail = renderedMail($n, $s->employee);

        expect($n->toArray($s->employee)['body'])->toBe('Kinerja bulan lalu kurang, stok opname.')
            ->and($mail['subject'])->toBe('Cuti tahunan CUT-2026-10-0001 ditolak oleh Dimas Pratama');

        foreach (['html', 'text', 'whatsapp'] as $channel) {
            expect($mail[$channel])->not->toContain('Kinerja bulan lalu')
                ->and($mail[$channel])->toContain(RequestNotification::NOTE_IN_APP);
        }

        return true;
    });

    Notification::assertSentTo($s->employee, RequestRevisionRequested::class, function (RequestRevisionRequested $n) use ($s) {
        $mail = renderedMail($n, $s->employee);

        expect($n->toArray($s->employee)['body'])->toBe('Ganti tanggal karena rapat direksi.')
            ->and($n->externalPayload($s->employee)->meta)->not->toHaveKey('quote')
            ->and($mail['html'])->not->toContain('rapat direksi')
            ->and($mail['text'])->not->toContain('rapat direksi')
            ->and($mail['whatsapp'])->not->toContain('rapat direksi')
            ->and($mail['html'])->toContain('Revisi pengajuan');

        return true;
    });
});

it('uses a neutral subject for sick requests in every email', function () {
    $s = $this->s;
    $sick = $s->submit($s->employee, $s->sick, ['start_date' => '2026-10-05', 'end_date' => '2026-10-05', 'reason' => 'Demam berdarah, rawat jalan.']);

    $leaks = ['Sakit', 'SKT-', 'Demam'];
    $assertNeutral = function (array $mail) use ($leaks): void {
        foreach (['subject', 'html', 'text', 'whatsapp'] as $channel) {
            foreach ($leaks as $leak) {
                expect($mail[$channel])->not->toContain($leak);
            }
        }
    };

    Notification::assertSentTo($s->manager, RequestAwaitingApproval::class, function (RequestAwaitingApproval $n) use ($s, $assertNeutral) {
        $mail = renderedMail($n, $s->manager);
        $assertNeutral($mail);

        // In the app the full title stays.
        expect($mail['subject'])->toBe('Pengajuan Rizky Aditya menunggu persetujuan Anda')
            ->and($n->toArray($s->manager)['title'])->toBe('Rizky Aditya mengajukan Sakit · menunggu persetujuan Anda')
            ->and($n->toArray($s->manager)['subject']['code'])->toBe('SKT-2026-10-0001')
            ->and($n->toArray($s->manager)['meta']['external_title'])->toBe('Pengajuan Rizky Aditya menunggu persetujuan Anda');

        return true;
    });

    $sick = $s->approve($s->manager, $sick);
    Notification::assertSentTo($s->employee, RequestStepApproved::class, function (RequestStepApproved $n) use ($s, $assertNeutral) {
        $mail = renderedMail($n, $s->employee);
        $assertNeutral($mail);

        return $mail['subject'] === 'Pengajuan Anda disetujui Dimas Pratama, diteruskan ke HR';
    });

    $s->approve($s->hr, $sick);
    Notification::assertSentTo($s->employee, RequestApproved::class, function (RequestApproved $n) use ($s, $assertNeutral) {
        $mail = renderedMail($n, $s->employee);
        $assertNeutral($mail);

        return $mail['subject'] === 'Pengajuan Anda disetujui';
    });

    $other = $s->submit($s->employee, $s->sick, ['start_date' => '2026-10-06', 'end_date' => '2026-10-06', 'reason' => 'Demam lagi.']);
    app(RejectStep::class)->handle($s->manager, $other, 'Surat dokter tidak terbaca.');
    Notification::assertSentTo($s->employee, RequestRejected::class, function (RequestRejected $n) use ($s, $assertNeutral) {
        $mail = renderedMail($n, $s->employee);
        $assertNeutral($mail);

        return $mail['subject'] === 'Pengajuan Anda ditolak oleh Dimas Pratama'
            && ! str_contains($mail['html'], 'Surat dokter tidak terbaca');
    });
});

it('keeps non-sick email subjects unchanged', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);

    $mail = renderedMail(new RequestAwaitingApproval($request), $s->manager);

    expect($mail['subject'])->toBe('Rizky Aditya mengajukan Cuti tahunan · menunggu persetujuan Anda')
        ->and($mail['html'])->toContain('CUT-2026-10-0001')
        ->and($mail['html'])->toContain('12 Okt 2026');
});

it('stores only ids and a has_note flag in decision audit rows', function () {
    $s = $this->s;
    $a = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);
    $b = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-13', 'end_date' => '2026-10-13']);
    $c = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14']);

    app(RejectStep::class)->handle($s->manager, $a, 'Alasan pribadi yang sensitif.');
    app(RequestRevision::class)->handle($s->manager, $b, 'Catatan revisi yang sensitif.');
    $s->approve($s->manager, $c, 'Catatan setuju yang sensitif.');

    $rows = AuditLog::query()->whereIn('action', ['request.rejected', 'request.revision_requested', 'request.step_approved'])->get()->keyBy('action');

    expect($rows)->toHaveCount(3);

    foreach ($rows as $row) {
        expect(json_encode([$row->old_values, $row->new_values]))->not->toContain('sensitif')
            ->and($row->new_values)->not->toHaveKey('note')
            ->and($row->new_values['has_note'])->toBeTrue()
            ->and($row->new_values['step_id'])->toBeString();
    }

    expect($rows['request.rejected']->new_values)->toMatchArray(['status' => 'rejected', 'step' => 1])
        ->and($rows['request.rejected']->new_values['step_id'])->toBe($a->fresh(['approvals'])?->approvals->firstWhere('step_order', 1)?->id);

    $d = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-15', 'end_date' => '2026-10-15']);
    $s->approve($s->manager, $d);
    expect(AuditLog::query()->where('action', 'request.step_approved')->latest('id')->firstOrFail()->new_values['has_note'])->toBeFalse();
});

it('lists sick requests neutrally in the daily digest email', function () {
    Notification::swap(new ChannelManager(app()));
    $s = $this->s;
    $s->submit($s->employee, $s->sick, ['start_date' => '2026-10-05', 'end_date' => '2026-10-05', 'reason' => 'Demam.']);
    $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);

    $section = app(PendingApprovalsSection::class)->build($s->manager, CarbonImmutable::now());
    $items = collect($section?->items ?? [])->keyBy('badge');

    expect($items->keys()->sort()->values()->all())->toBe(['Cuti tahunan', 'Pengajuan'])
        ->and($items['Pengajuan']->code)->toBeNull()
        ->and($items['Cuti tahunan']->code)->toBe('CUT-2026-10-0001');

    // Inbox "Perlu tindakan" section (types without a richer section) uses meta.external_title.
    config(['notifications.digest.inbox_section_excludes' => []]);
    $inbox = app(InboxActionSection::class)->build($s->manager, CarbonImmutable::now());
    $titles = collect($inbox?->items ?? [])->pluck('title')->all();
    $codes = collect($inbox?->items ?? [])->pluck('code')->all();

    expect($titles)->toContain('Pengajuan Rizky Aditya menunggu persetujuan Anda')
        ->and(implode(' ', $titles))->not->toContain('Sakit')
        ->and($codes)->not->toContain('SKT-2026-10-0001')
        ->and($codes)->toContain('CUT-2026-10-0001');
});
