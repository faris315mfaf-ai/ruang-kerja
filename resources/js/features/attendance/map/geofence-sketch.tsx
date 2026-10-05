import { useEffect, useId, useRef, useState } from 'react';
import { formatDistance, nearestLocation, sketchLayout } from '@/lib/geo';
import type { LatLng } from '@/lib/geo';
import { cn } from '@/lib/utils';
import type { OfficeLocationPoint } from '@/types/attendance';

type Props = {
    locations: OfficeLocationPoint[];
    position: (LatLng & { accuracy?: number | null }) | null;
    /** Frame height in px (the card's mini map). */
    height?: number;
    className?: string;
};

/**
 * Schematic mini map of the Absensi card (mockup Absensi): grid, the nearest
 * office geofence and "you are here" — plain SVG, no Leaflet and no map tiles,
 * so the check-in screen stays light on mobile data (Sprint 10, Lighthouse).
 * The full OpenStreetMap view stays on the failure screen (CheckinGagal).
 */
export function GeofenceSketch({
    locations,
    position,
    height = 120,
    className,
}: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(360);
    const patternId = useId();

    useEffect(() => {
        const element = ref.current;

        if (!element) {
            return;
        }

        const observer = new ResizeObserver(([entry]) => {
            setWidth(Math.max(120, Math.round(entry.contentRect.width)));
        });
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    const match = position ? nearestLocation(locations, position) : null;
    const target = match?.location ?? locations[0] ?? null;
    const layout = target
        ? sketchLayout(target, position, width, height)
        : null;
    const cx = width / 2;
    const cy = height / 2;
    const label = target
        ? match
            ? `Sketsa lokasi: Anda ${formatDistance(match.distanceM)} dari ${target.name}, radius ${target.radiusM} m.`
            : `Sketsa lokasi: ${target.name}, radius ${target.radiusM} m.`
        : 'Sketsa lokasi: posisi Anda.';

    return (
        <div
            ref={ref}
            className={cn('overflow-hidden bg-grad-soft', className)}
            style={{ height }}
        >
            <svg
                role="img"
                aria-label={label}
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                className="block"
            >
                <defs>
                    <pattern
                        id={patternId}
                        width="44"
                        height="44"
                        patternUnits="userSpaceOnUse"
                    >
                        <path
                            d="M 44 0 L 0 0 0 44"
                            fill="none"
                            className="stroke-border"
                            strokeWidth="1"
                        />
                    </pattern>
                </defs>
                <rect
                    width={width}
                    height={height}
                    fill={`url(#${patternId})`}
                />
                {layout && (
                    <>
                        <circle
                            cx={cx}
                            cy={cy}
                            r={layout.radius}
                            className="fill-fill-teal/20 stroke-primary/60"
                            strokeWidth="2"
                            strokeDasharray="6 5"
                        />
                        <rect
                            x={cx - 6}
                            y={cy - 6}
                            width="12"
                            height="12"
                            rx="3"
                            className="fill-primary"
                        />
                    </>
                )}
                {position && (
                    <g
                        transform={`translate(${layout?.marker?.x ?? cx} ${layout?.marker?.y ?? cy})`}
                    >
                        <circle r="25" className="fill-accent-blue/18" />
                        <circle r="17" className="fill-surface" />
                        <circle r="11" className="fill-accent-blue-strong" />
                    </g>
                )}
            </svg>
        </div>
    );
}
