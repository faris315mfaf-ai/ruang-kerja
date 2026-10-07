import { ChipScroller } from '@/components/mobile/chip-scroller';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { SegmentedTabs } from '@/components/ui/tabs';
import type { DivisionOption, RoleKey, RoleOption } from './types';

/**
 * Switches between the job dashboards the viewer may open: Direksi and Super
 * Admin see all eight, everyone else only their own (picker hidden).
 * Desktop/tablet: segmented control scrolling sideways; phone: chip scroller.
 */
export function RolePicker({
    roles,
    value,
    onChange,
    mobile,
}: {
    roles: RoleOption[];
    value: RoleKey;
    onChange: (role: RoleKey) => void;
    mobile: boolean;
}) {
    if (roles.length < 2) {
        return null;
    }

    if (mobile) {
        return (
            <ChipScroller
                label="Pilih jabatan"
                value={value}
                onChange={onChange}
                chips={roles.map((role) => ({
                    value: role.value,
                    label: role.short,
                }))}
            />
        );
    }

    return (
        <div className="-mx-1 [scrollbar-width:none] overflow-x-auto px-1 py-1 [&::-webkit-scrollbar]:hidden">
            <SegmentedTabs
                label="Pilih jabatan"
                variant="glass"
                value={value}
                onValueChange={onChange}
                options={roles.map((role) => ({
                    value: role.value,
                    label: role.label,
                }))}
            />
        </div>
    );
}

/** Division on screen for the division jobs (Direksi / multi-division heads). */
export function DivisionPicker({
    divisions,
    value,
    onChange,
}: {
    divisions: DivisionOption[];
    value: string | null;
    onChange: (division: string) => void;
}) {
    if (divisions.length < 2) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="role-division" className="shrink-0">
                Divisi
            </Label>
            <Select value={value ?? undefined} onValueChange={onChange}>
                <SelectTrigger
                    id="role-division"
                    className="w-full max-w-[280px] text-[17px] md:text-[16px]"
                >
                    <SelectValue placeholder="Pilih divisi" />
                </SelectTrigger>
                <SelectContent>
                    {divisions.map((division) => (
                        <SelectItem key={division.value} value={division.value}>
                            {division.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
