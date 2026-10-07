import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ChartExportSheet } from './chart-export-sheet';
import type { CssSheetLike, ExportSize } from './export-utils';
import {
    capExportScale,
    exportFileName,
    printableChart,
    rootCustomProperties,
} from './export-utils';
import type { OrgChart } from './types';

export type ExportChartOptions = {
    chart: OrgChart;
    query: string;
    /** Canvas area budget (MAX_CANVAS_AREA.mobile / .desktop). */
    maxArea: number;
    now?: Date;
};

export type ExportChartResult = { fileName: string; size: ExportSize };

function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    // Safari reads the blob after click() returns.
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Renders the whole (filtered) chart off-screen in the light theme, turns it
 * into a 2x PNG in the browser (modern-screenshot: DOM → SVG foreignObject →
 * canvas, fonts embedded) and downloads it. No server round trip: the export
 * shows exactly the data the viewer already has.
 */
export async function exportChartPng({
    chart,
    query,
    maxArea,
    now = new Date(),
}: ExportChartOptions): Promise<ExportChartResult> {
    const host = document.createElement('div');

    host.setAttribute('aria-hidden', 'true');
    host.inert = true;
    host.style.position = 'fixed';
    host.style.top = '0';
    host.style.left = '-100000px';
    host.style.pointerEvents = 'none';

    // Light theme for this subtree even when the page is in Malam.
    // CSSRule subclasses carry the fields CssRuleLike reads (duck-typed).
    const light = rootCustomProperties(
        Array.from(document.styleSheets) as unknown as CssSheetLike[],
    );

    for (const [name, value] of Object.entries(light)) {
        host.style.setProperty(name, value);
    }

    host.style.colorScheme = 'light';
    document.body.append(host);

    const root = createRoot(host);

    try {
        flushSync(() =>
            root.render(
                <ChartExportSheet
                    chart={printableChart(chart)}
                    query={query}
                    now={now}
                />,
            ),
        );

        const sheet = host.firstElementChild;

        if (!(sheet instanceof HTMLElement)) {
            throw new Error('Bagan ekspor tidak terbentuk.');
        }

        await document.fonts?.ready;

        const box = sheet.getBoundingClientRect();
        const size = capExportScale(box.width, box.height, maxArea);
        const { domToBlob } = await import('modern-screenshot');
        const blob = await domToBlob(sheet, {
            scale: size.scale,
            type: 'image/png',
            backgroundColor: getComputedStyle(sheet).backgroundColor,
            timeout: 20_000,
        });

        if (blob.size === 0) {
            throw new Error('Gambar kosong.');
        }

        const fileName = exportFileName(now);

        downloadBlob(blob, fileName);

        return { fileName, size };
    } finally {
        root.unmount();
        host.remove();
    }
}
