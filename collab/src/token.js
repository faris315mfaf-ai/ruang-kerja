import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies the connection token issued by Laravel
 * (App\Domain\Notes\Services\CollabToken): base64url(JSON) "." base64url(HMAC-SHA256).
 * Returns { note, user, name, edit, exp } or throws.
 */
export function verifyToken(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
    if (!secret) {
        throw new Error('collab secret not configured');
    }

    if (typeof token !== 'string' || token.length > 4096) {
        throw new Error('invalid token');
    }

    const parts = token.split('.');

    if (parts.length !== 2) {
        throw new Error('invalid token');
    }

    const [body, signature] = parts;
    const expected = createHmac('sha256', secret).update(body).digest('base64url');
    const given = Buffer.from(signature);
    const wanted = Buffer.from(expected);

    if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
        throw new Error('invalid signature');
    }

    let payload;

    try {
        payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
        throw new Error('invalid payload');
    }

    if (
        !payload ||
        typeof payload.note !== 'string' ||
        typeof payload.user !== 'string' ||
        typeof payload.name !== 'string' ||
        typeof payload.edit !== 'boolean' ||
        typeof payload.exp !== 'number'
    ) {
        throw new Error('invalid payload');
    }

    if (payload.exp < nowSeconds) {
        throw new Error('token expired');
    }

    return payload;
}
