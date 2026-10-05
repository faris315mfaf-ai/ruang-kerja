<?php

namespace Tests\Fixtures\Google;

use App\Domain\Google\Contracts\HasDriveFolder;
use App\Domain\Google\Data\DriveMember;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stand-in for Workspace (not built yet in this branch) and the reference
 * implementation of HasDriveFolder for the Workspaces module.
 *
 * @property string $id
 * @property string $name
 * @property string|null $drive_folder_id
 * @property string|null $parent_folder_id
 * @property string $workspace_id real workspaces row (drive_files.workspace_id is a foreign key)
 * @property list<array{email: string, role: string}> $members
 */
class FolderOwner extends Model implements HasDriveFolder
{
    use HasUlids;

    public const string TABLE = 'test_drive_folder_owners';

    protected $table = self::TABLE;

    protected $guarded = [];

    public $timestamps = false;

    protected function casts(): array
    {
        return ['members' => 'array'];
    }

    public static function createTable(): void
    {
        if (Schema::hasTable(self::TABLE)) {
            return;
        }

        Schema::create(self::TABLE, function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->string('drive_folder_id')->nullable();
            $table->string('parent_folder_id')->nullable();
            $table->ulid('workspace_id');
            $table->json('members')->default('[]');
        });
    }

    /**
     * @param  array<string, string>  $members  email => workspace role (owner/admin/member/viewer)
     */
    public static function createWith(string $name = 'Proyek Peluncuran Q4 [PLQ]', array $members = []): self
    {
        self::createTable();

        return self::query()->create([
            'name' => $name,
            'workspace_id' => Workspace::factory()->create()->id,
            'members' => array_map(
                fn (string $email, string $role): array => ['email' => $email, 'role' => $role],
                array_keys($members),
                $members,
            ),
        ]);
    }

    /**
     * @param  array<string, string>  $members
     */
    public function setMembers(array $members): self
    {
        $this->forceFill(['members' => array_map(
            fn (string $email, string $role): array => ['email' => $email, 'role' => $role],
            array_keys($members),
            $members,
        )])->save();

        return $this;
    }

    public function driveFolderKey(): string
    {
        return $this->getTable().':'.$this->id;
    }

    public function driveFolderName(): string
    {
        return $this->name;
    }

    public function driveParentFolderId(): ?string
    {
        return $this->parent_folder_id;
    }

    public function driveFolderId(): ?string
    {
        return $this->drive_folder_id;
    }

    public function storeDriveFolderId(?string $folderId): void
    {
        $this->forceFill(['drive_folder_id' => $folderId])->saveQuietly();
    }

    public function driveMembers(): array
    {
        return array_map(
            fn (array $member): DriveMember => DriveMember::forWorkspaceRole($member['email'], $member['role']),
            $this->members,
        );
    }

    public function driveWorkspaceId(): string
    {
        return $this->workspace_id;
    }

    /**
     * Role of a user in this owner (null = not a member).
     */
    public function roleOf(string $email): ?string
    {
        foreach ($this->members as $member) {
            if (strtolower($member['email']) === strtolower($email)) {
                return $member['role'];
            }
        }

        return null;
    }
}
