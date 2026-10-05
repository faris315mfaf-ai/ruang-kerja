import type { SelectOption } from './fields';

/**
 * The head/lead picker lists active employees only. A current head/lead who was
 * deactivated before the clean-up existed stays selectable (the server accepts
 * an unchanged person), so editing other fields never silently clears it.
 */
export function withCurrentPerson(
    options: SelectOption[],
    current: { id: string; name: string } | null | undefined,
): SelectOption[] {
    if (!current || options.some((option) => option.value === current.id)) {
        return options;
    }

    return [
        { value: current.id, label: current.name, description: 'Nonaktif' },
        ...options,
    ];
}
