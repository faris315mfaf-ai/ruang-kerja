import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { appsScript } from './apps-script';

type Fetched = { url: string; options: { payload: string; headers: Record<string, string> } };

/**
 * Runs the Apps Script with fake Google services and returns what it sent.
 */
function run(secret: string): Fetched {
    const sent: Fetched[] = [];
    const item = (title: string, type: string) => ({
        getTitle: () => title,
        getType: () => type,
    });
    const response = {
        getId: () => 'resp-42',
        getTimestamp: () => new Date('2026-10-05T02:30:00Z'),
        getRespondentEmail: () => 'nadia@contoh.id',
        getItemResponses: () => [
            { getItem: () => item('Nama lengkap', 'TEXT'), getResponse: () => 'Nádia Putri' },
            { getItem: () => item('Keahlian', 'CHECKBOX'), getResponse: () => ['PHP', 'Go'] },
            { getItem: () => item('CV', 'FILE_UPLOAD'), getResponse: () => ['file-1'] },
        ],
    };
    const globals = {
        FormApp: {
            ItemType: { FILE_UPLOAD: 'FILE_UPLOAD' },
            getActiveForm: () => ({ getResponses: () => [response] }),
        },
        ScriptApp: {},
        Utilities: {
            Charset: { UTF_8: 'UTF-8' },
            computeHmacSha256Signature: (value: string, key: string) =>
                Array.from(createHmac('sha256', key).update(value, 'utf8').digest()).map(
                    (byte) => (byte > 127 ? byte - 256 : byte),
                ),
        },
        UrlFetchApp: {
            fetch: (url: string, options: Fetched['options']) => {
                sent.push({ url, options });

                return { getResponseCode: () => 201, getContentText: () => '{}' };
            },
        },
    };

    const script = appsScript('https://rk.test/api/hiring/form/abc', secret);
    const factory = new Function(
        ...Object.keys(globals),
        `${script}\nreturn kirimKeRuangKerja;`,
    ) as (...args: unknown[]) => (event: unknown) => void;

    factory(...Object.values(globals))({ response });

    return sent[0];
}

describe('Apps Script for the Google Form webhook', () => {
    it('signs the exact body with HMAC-SHA256 (hex) and sends ASCII-only JSON', () => {
        const secret = 'rahasia-uji';
        const sent = run(secret);
        const body = sent.options.payload;

        expect(sent.url).toBe('https://rk.test/api/hiring/form/abc');
        expect(sent.options.headers['X-RuangKerja-Signature']).toBe(
            createHmac('sha256', secret).update(body).digest('hex'),
        );
        expect(/^[\x00-\x7e]*$/.test(body)).toBe(true);

        expect(JSON.parse(body)).toEqual({
            response_id: 'resp-42',
            submitted_at: '2026-10-05T02:30:00.000Z',
            answers: [
                { question: 'Email', answer: 'nadia@contoh.id' },
                { question: 'Nama lengkap', answer: 'Nádia Putri' },
                { question: 'Keahlian', answer: 'PHP, Go' },
            ],
            files: [{ label: 'CV', url: 'https://drive.google.com/open?id=file-1' }],
        });
    });

    it('leaves a placeholder when the secret is not revealed', () => {
        expect(appsScript('https://rk.test/x', null)).toContain(
            "const RK_SECRET = 'TEMPEL_SECRET_DI_SINI';",
        );
    });
});
