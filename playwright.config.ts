import { defineConfig, devices } from '@playwright/test';

/**
 * Visual smoke tests (not part of `npm test`). Run: `npm run test:e2e`.
 * See tests/e2e/README.md. Target: E2E_BASE_URL, else APP_URL, else Herd.
 */
const baseURL =
    process.env.E2E_BASE_URL ??
    process.env.APP_URL ??
    'https://ruangkerja.test';

const viewports = [
    { name: 'mobile', width: 375, height: 812, mobile: true },
    { name: 'tablet', width: 834, height: 1112, mobile: false },
    { name: 'desktop', width: 1440, height: 900, mobile: false },
] as const;

const schemes = ['light', 'dark'] as const;

export default defineConfig({
    testDir: './tests/e2e',
    outputDir: './test-results',
    snapshotPathTemplate:
        '{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: [['list'], ['html', { open: 'never' }]],
    expect: {
        toHaveScreenshot: {
            animations: 'disabled',
            caret: 'hide',
            maxDiffPixelRatio: 0.02,
        },
    },
    use: {
        baseURL,
        // Herd's local CA is not in Playwright's bundled browser store.
        ignoreHTTPSErrors: true,
        locale: 'id-ID',
        timezoneId: 'Asia/Jakarta',
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'setup', testMatch: /auth\.setup\.ts/ },
        ...viewports.flatMap((viewport) =>
            schemes.map((colorScheme) => ({
                name: `${viewport.name}-${colorScheme}`,
                dependencies: ['setup'],
                testMatch: /.*\.spec\.ts/,
                use: {
                    ...devices['Desktop Chrome'],
                    viewport: {
                        width: viewport.width,
                        height: viewport.height,
                    },
                    isMobile: viewport.mobile,
                    hasTouch: viewport.mobile,
                    colorScheme,
                    storageState: 'test-results/.auth/user.json',
                },
            })),
        ),
    ],
});
