<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignUlid('company_id')->nullable()->after('id')->constrained()->restrictOnDelete();
            $table->string('google_id')->nullable()->unique()->after('two_factor_confirmed_at');
            $table->string('avatar_url', 2048)->nullable()->after('google_id');
            $table->foreignUlid('division_id')->nullable()->index()->after('avatar_url')->constrained()->nullOnDelete();
            $table->foreignUlid('team_id')->nullable()->index()->after('division_id')->constrained()->nullOnDelete();
            $table->foreignUlid('position_id')->nullable()->index()->after('team_id')->constrained()->nullOnDelete();
            $table->foreignUlid('manager_id')->nullable()->index()->after('position_id')->constrained('users')->nullOnDelete();
            $table->string('work_mode', 10)->default('office')->after('manager_id');
            $table->string('status', 10)->default('active')->after('work_mode');
            $table->date('joined_at')->nullable()->after('status');
            $table->timestampTz('last_login_at')->nullable()->after('theme');

            // Password is only used by the emergency Super Admin login; Google users have none.
            $table->string('password')->nullable()->change();
        });

        $this->backfillCompany();

        Schema::table('users', function (Blueprint $table) {
            $table->ulid('company_id')->nullable(false)->change();
            $table->index(['company_id', 'status']);
        });
    }

    public function down(): void
    {
        DB::table('users')->whereNull('password')->update(['password' => '']);

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'status']);
            $table->dropConstrainedForeignId('company_id');
            $table->dropConstrainedForeignId('division_id');
            $table->dropConstrainedForeignId('team_id');
            $table->dropConstrainedForeignId('position_id');
            $table->dropConstrainedForeignId('manager_id');
            $table->dropUnique(['google_id']);
            $table->dropColumn(['google_id', 'avatar_url', 'work_mode', 'status', 'joined_at', 'last_login_at']);
            $table->string('password')->nullable(false)->change();
        });
    }

    /**
     * Existing rows (Sprint 0 demo users) need a company before company_id becomes NOT NULL.
     */
    private function backfillCompany(): void
    {
        $email = DB::table('users')->orderBy('id')->value('email');

        if (! is_string($email)) {
            return;
        }

        $companyId = DB::table('companies')->orderBy('id')->value('id');

        if ($companyId === null) {
            $companyId = (string) Str::ulid();
            $name = config('branding.company_name');

            DB::table('companies')->insert([
                'id' => $companyId,
                'name' => is_string($name) && $name !== '' ? $name : 'Perusahaan',
                'google_domain' => Str::lower(Str::after($email, '@')),
                'timezone' => config('app.office_timezone', 'Asia/Jakarta'),
                'settings' => '{}',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('users')->whereNull('company_id')->update(['company_id' => $companyId]);
    }
};
