<?php

namespace App\Domain\RoleDashboards\Enums;

/**
 * SPKD job dashboards (positions.dashboard_role, /peran/{role}). They add a
 * job-specific home on top of — never instead of — Dashboard Saya / Divisi /
 * HR, the portfolio and Dashboard Manajemen.
 *
 * Three jobs have a real task flow built on existing actions (project
 * decisions, approvals, leave review); the other five show real division
 * data and an honest "Ditahan · butuh modul baru" card for the module their
 * design flow needs (letters, client tickets, UAT, material review, bugs).
 */
enum DashboardRole: string
{
    case Dirut = 'dirut';
    case Direktur = 'direktur';
    case Hr = 'hr';
    case Corsec = 'corsec';
    case Marketing = 'marketing';
    case Programming = 'programming';
    case Implementer = 'implementer';
    case Analis = 'analis';

    public function label(): string
    {
        return match ($this) {
            self::Dirut => 'Direktur Utama',
            self::Direktur => 'Direktur',
            self::Hr => 'HR',
            self::Corsec => 'Sekretaris Perusahaan',
            self::Marketing => 'Branding & Marketing',
            self::Programming => 'Programming',
            self::Implementer => 'Implementer',
            self::Analis => 'Analis',
        };
    }

    /** Phone chip label. */
    public function shortLabel(): string
    {
        return match ($this) {
            self::Dirut => 'Dirut',
            self::Corsec => 'Corsec',
            self::Marketing => 'Marketing',
            default => $this->label(),
        };
    }

    /**
     * Task flow opened by the primary action, or null when the flow is held
     * (needs a module that does not exist yet).
     */
    public function flow(): ?string
    {
        return match ($this) {
            self::Dirut => 'decision',
            self::Direktur => 'approvals',
            self::Hr => 'leave-review',
            default => null,
        };
    }

    /** Division-based dashboards: tasks, workload and attendance of one division. */
    public function isUnit(): bool
    {
        return $this->flow() === null;
    }

    /** Whether the approval endpoints of the dashboard are open for this job. */
    public function decidesRequests(): bool
    {
        return in_array($this, [self::Direktur, self::Hr], true);
    }

    /**
     * The design flow that waits for a new module (shown as "Ditahan").
     *
     * @return array{title: string, description: string}|null
     */
    public function heldModule(): ?array
    {
        return match ($this) {
            self::Corsec => ['title' => 'Surat masuk & disposisi', 'description' => 'Disposisi surat butuh modul surat masuk yang belum ada. Sementara itu, dashboard ini menampilkan tugas, tenggat, dan kehadiran unit Anda.'],
            self::Marketing => ['title' => 'Review materi & pipeline konten', 'description' => 'Review brosur dengan pin komentar dan pipeline konten butuh modul baru. Tugas, tenggat, dan beban kerja divisi di bawah ini data nyata.'],
            self::Programming => ['title' => 'Bug sprint & integrasi Git', 'description' => 'Progres bug kritis, sprint, dan pull request butuh modul bug dan integrasi Git yang belum ada. Tugas divisi di bawah ini data nyata.'],
            self::Implementer => ['title' => 'Tiket klien & check-in di klien', 'description' => 'Pembaruan tiket P1 dan linimasa klien butuh modul tiket klien yang belum ada. Tugas, tenggat, dan kehadiran tim di bawah ini data nyata.'],
            self::Analis => ['title' => 'Skenario & eksekusi UAT', 'description' => 'Eksekusi skenario UAT butuh modul UAT yang belum ada. Tugas, tenggat, dan beban kerja divisi di bawah ini data nyata.'],
            default => null,
        };
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(fn (self $case): string => $case->value, self::cases());
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $case): array => ['value' => $case->value, 'label' => $case->label()], self::cases());
    }
}
