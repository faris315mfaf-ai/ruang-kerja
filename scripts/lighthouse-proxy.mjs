// Local stand-in for production (FrankenPHP `encode zstd br gzip`) in front of
// `php artisan serve`, for scripts/lighthouse-absensi.sh: gzip for text
// responses and the immutable cache header docker/app/Caddyfile sets on /build/assets/*.
// Usage: node scripts/lighthouse-proxy.mjs 8797 8795
import http from 'node:http';
import zlib from 'node:zlib';

const [listen = '8796', upstream = '8795'] = process.argv.slice(2);
const compressible = /text\/|javascript|json|css|svg|xml/;

http.createServer((req, res) => {
    const headers = { ...req.headers };
    delete headers['accept-encoding'];
    const up = http.request(
        {
            host: '127.0.0.1',
            port: upstream,
            path: req.url,
            method: req.method,
            headers,
        },
        (upRes) => {
            const out = { ...upRes.headers };
            if (req.url.startsWith('/build/'))
                out['cache-control'] = 'public, max-age=31536000, immutable';
            const type = String(out['content-type'] ?? '');
            const gzip =
                /gzip/.test(req.headers['accept-encoding'] ?? '') &&
                compressible.test(type);
            if (gzip) {
                delete out['content-length'];
                out['content-encoding'] = 'gzip';
                out['vary'] = 'Accept-Encoding';
                res.writeHead(upRes.statusCode, out);
                upRes.pipe(zlib.createGzip({ level: 6 })).pipe(res);
            } else {
                res.writeHead(upRes.statusCode, out);
                upRes.pipe(res);
            }
        },
    );
    up.on('error', (e) => {
        res.writeHead(502);
        res.end(String(e));
    });
    req.pipe(up);
}).listen(Number(listen), '127.0.0.1', () =>
    console.log(`proxy :${listen} -> :${upstream}`),
);
