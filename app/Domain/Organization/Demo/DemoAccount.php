<?php

namespace App\Domain\Organization\Demo;

use App\Domain\Organization\Enums\Role;

final readonly class DemoAccount
{
    public function __construct(
        public string $email,
        public string $name,
        public Role $role,
        /** Persona in the account switcher of the shell; null = login page only. */
        public ?string $persona = null,
    ) {}

    /**
     * Shape shared with the login page (`demoAccounts` prop).
     *
     * @return array{email: string, name: string, role_label: string, persona: string|null}
     */
    public function toProps(): array
    {
        return [
            'email' => $this->email,
            'name' => $this->name,
            'role_label' => $this->role->label(),
            'persona' => $this->persona,
        ];
    }
}
