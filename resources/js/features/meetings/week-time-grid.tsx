import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { cn, focusRing } from '@/lib/utils';
import {
    clockMinutes,
    dayNumber,
    dayShort,
    officeDate,
    timeRange,
} from './lib';

export type TimedItem = {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string | null;
    /** Second line after the time ("Google Meet"). */
    meta: string;
    /** Background + text classes. */
    tone: string;
    /** 4px left edge fill. */
    edge: string;
    href?: string;
};

const HOUR_HEIGHT = 64;

/**
 * Week grid with hours down the side (MgJadwal): timed items are absolutely
 * positioned by start/end; a red line marks "now" on today. Optional
 * all-day row on top (calendar tasks, leave, holidays).
 */
export function WeekTimeGrid({
    days,
    items,
    allDay,
    today,
    now,
    startHour = 8,
    endHour = 17,
    className,
}: {
    days: string[];
    items: TimedItem[];
    allDay?: (date: string) => ReactNode;
    today: string;
    now: number;
    startHour?: number;
    endHour?: number;
    className?: string;
}) {
    const hours = Array.from(
        { length: endHour - startHour + 1 },
        (_, i) => startHour + i,
    );
    const height = (endHour - startHour) * HOUR_HEIGHT;
    const top = (minutes: number) =>
        ((minutes - startHour * 60) / 60) * HOUR_HEIGHT;
    const nowMinutes = clockMinutes(new Date(now).toISOString());
    const columns = {
        gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))`,
    };

    return (
        <div className={cn('flex min-w-0 flex-col', className)}>
            <div className="grid gap-2 pb-2.5" style={columns}>
                <span />
                {days.map((date) => (
                    <span
                        key={date}
                        className={cn(
                            'flex items-baseline gap-2 rounded-control px-2.5 py-2',
                            date === today
                                ? 'bg-grad-aksi text-on-brand'
                                : 'text-text',
                        )}
                    >
                        <span className="text-[15px] font-bold">
                            {dayShort(date)}
                        </span>
                        <span className="text-[22px] leading-7 font-extrabold">
                            {dayNumber(date)}
                        </span>
                    </span>
                ))}
            </div>
            {allDay && (
                <div
                    className="grid gap-2 border-y border-divider py-2"
                    style={columns}
                >
                    <span className="pt-1 text-[12px] font-bold text-text-subtle">
                        Sehari
                    </span>
                    {days.map((date) => (
                        <div key={date} className="flex min-w-0 flex-col gap-1">
                            {allDay(date)}
                        </div>
                    ))}
                </div>
            )}
            <div
                className="relative grid gap-2 pt-2"
                style={{ ...columns, height: height + 8 }}
            >
                <div className="relative">
                    {hours.map((hour) => (
                        <span
                            key={hour}
                            className="absolute left-0 -mt-2 text-[13px] font-bold text-text-subtle"
                            style={{ top: (hour - startHour) * HOUR_HEIGHT }}
                        >
                            {String(hour).padStart(2, '0')}.00
                        </span>
                    ))}
                </div>
                {days.map((date) => {
                    const dayItems = items.filter(
                        (item) => officeDate(item.starts_at) === date,
                    );
                    const showNow =
                        date === today &&
                        nowMinutes >= startHour * 60 &&
                        nowMinutes <= endHour * 60;

                    return (
                        <div
                            key={date}
                            className="relative border-l border-divider"
                            style={{
                                backgroundImage: `repeating-linear-gradient(180deg, var(--divider) 0, var(--divider) 1px, transparent 1px, transparent ${HOUR_HEIGHT}px)`,
                            }}
                        >
                            {showNow && (
                                <span
                                    aria-hidden
                                    className="absolute inset-x-0 z-[2] border-t-2 border-danger"
                                    style={{ top: top(nowMinutes) }}
                                >
                                    <span className="absolute -top-1.5 -left-[5px] size-2.5 rounded-full bg-danger" />
                                </span>
                            )}
                            {dayItems.map((item) => {
                                const start = clockMinutes(item.starts_at);
                                const end = item.ends_at
                                    ? clockMinutes(item.ends_at)
                                    : start + 30;
                                const style = {
                                    top: top(start) + 2,
                                    height: Math.max(
                                        ((end - start) / 60) * HOUR_HEIGHT - 4,
                                        30,
                                    ),
                                };
                                const body = (
                                    <>
                                        <span className="text-[14px] leading-[18px] font-extrabold text-text">
                                            {item.title}
                                        </span>
                                        <span className="text-[13px] leading-[17px] text-text-muted">
                                            {timeRange(
                                                item.starts_at,
                                                item.ends_at,
                                            )}{' '}
                                            · {item.meta}
                                        </span>
                                    </>
                                );
                                const classes = cn(
                                    'absolute inset-x-1 flex flex-col gap-px overflow-hidden rounded-[10px] border-l-4 py-1.5 pr-2 pl-2',
                                    item.tone,
                                    item.edge,
                                );

                                return item.href ? (
                                    <Link
                                        key={item.id}
                                        href={item.href}
                                        className={cn(
                                            classes,
                                            'transition-opacity duration-120 ease-brand hover:opacity-85',
                                            focusRing,
                                        )}
                                        style={style}
                                    >
                                        {body}
                                    </Link>
                                ) : (
                                    <div
                                        key={item.id}
                                        className={classes}
                                        style={style}
                                    >
                                        {body}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
