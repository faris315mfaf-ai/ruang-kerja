import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { verifyToken } from '../src/token.js';

const SECRET = 'test-secret-test-secret-test-secret-123';
const NOW = 1_800_000_000;

/** Same format as App\Domain\Notes\Services\CollabToken::issue(). */
function issue(payload, secret = SECRET) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');

    return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

const valid = { note: '01JAAAAAAAAAAAAAAAAAAAAAAA', user: '01JBBBBBBBBBBBBBBBBBBBBBBB', name: 'Hana Putri', edit: true, exp: NOW + 120 };

test('accepts a token signed with the shared secret', () => {
    assert.deepEqual(verifyToken(issue(valid), SECRET, NOW), valid);
});

test('rejects a token signed with another secret', () => {
    assert.throws(() => verifyToken(issue(valid, 'another-secret-another-secret-12345'), SECRET, NOW), /signature/);
});

test('rejects a tampered payload', () => {
    const [, signature] = issue(valid).split('.');
    const forged = Buffer.from(JSON.stringify({ ...valid, edit: true, user: 'someone-else' })).toString('base64url');

    assert.throws(() => verifyToken(`${forged}.${signature}`, SECRET, NOW), /signature/);
});

test('rejects an expired token', () => {
    assert.throws(() => verifyToken(issue({ ...valid, exp: NOW - 1 }), SECRET, NOW), /expired/);
});

test('verifies a token issued by Laravel (CollabToken, same fixture in NoteHttpTest)', () => {
    const fromPhp =
        'eyJub3RlIjoiMDFqYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWEiLCJ1c2VyIjoiMDFqYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmIiLCJuYW1lIjoiSGFuYSBQcmF0aXdpIiwiZWRpdCI6ZmFsc2UsImV4cCI6MTgwMDAwMDEyMH0._O1G-7tr6uG0GcZK1K2DiyZEKpyHomM3IqsEFkc4-gg';

    assert.deepEqual(verifyToken(fromPhp, 'cross-check-secret-cross-check-secret-1', 1_800_000_000), {
        note: '01jaaaaaaaaaaaaaaaaaaaaaaa',
        user: '01jbbbbbbbbbbbbbbbbbbbbbbb',
        name: 'Hana Pratiwi',
        edit: false,
        exp: 1_800_000_120,
    });
});

test('rejects malformed tokens and a missing secret', () => {
    assert.throws(() => verifyToken('nope', SECRET, NOW), /invalid token/);
    assert.throws(() => verifyToken(issue({ note: 'x' }), SECRET, NOW), /invalid payload/);
    assert.throws(() => verifyToken(issue(valid), '', NOW), /not configured/);
});
