// Local stand-in for production in front of `php artisan serve`, used by
// scripts/lighthouse-absensi.sh: HTTPS + HTTP/2 (production runs Caddy with
// HTTP/2/3), gzip for text responses (FrankenPHP `encode zstd br gzip`) and
// the immutable cache header docker/app/Caddyfile sets on /build/assets/*.
// Usage: node scripts/lighthouse-proxy.mjs <listen-port> <artisan-serve-port> <cert.pem> <key.pem>
import fs from 'node:fs';
import http from 'node:http';
import http2 from 'node:http2';
import zlib from 'node:zlib';

const [listen = '8797', upstream = '8795', cert, key] = process.argv.slice(2);
const compressible = /text\/|javascript|json|css|svg|xml/;
// Connection-level headers are not allowed in HTTP/2 responses.
const hopByHop = new Set([
    'connection',
    'keep-alive',
    'transfer-encoding',
    'upgrade',
    'proxy-connection',
]);

function handle(req, res) {
    const headers = {};

    for (const [name, value] of Object.entries(req.headers)) {
        if (!name.startsWith(':') && name !== 'accept-encoding') {
            headers[name] = value;
        }
    }

    headers.host = req.headers[':authority'] ?? req.headers.host;
    headers['x-forwarded-proto'] = 'https';

    const up = http.request(
        {
            host: '127.0.0.1',
            port: upstream,
            path: req.url,
            method: req.method,
            headers,
        },
        (upRes) => {
            const out = {};

            for (const [name, value] of Object.entries(upRes.headers)) {
                if (!hopByHop.has(name)) {
                    out[name] = value;
                }
            }

            if (req.url.startsWith('/build/assets/')) {
                out['cache-control'] = 'public, max-age=31536000, immutable';
            }

            const gzip =
                /gzip/.test(req.headers['accept-encoding'] ?? '') &&
                compressible.test(String(out['content-type'] ?? ''));

            if (gzip) {
                delete out['content-length'];
                out['content-encoding'] = 'gzip';
                out.vary = 'Accept-Encoding';
                res.writeHead(upRes.statusCode, out);
                upRes.pipe(zlib.createGzip({ level: 6 })).pipe(res);
            } else {
                res.writeHead(upRes.statusCode, out);
                upRes.pipe(res);
            }
        },
    );

    up.on('error', (error) => {
        res.writeHead(502);
        res.end(String(error));
    });
    req.pipe(up);
}

const server =
    cert && key
        ? http2.createSecureServer(
              {
                  cert: fs.readFileSync(cert),
                  key: fs.readFileSync(key),
                  allowHTTP1: true,
              },
              handle,
          )
        : http.createServer(handle);

server.listen(Number(listen), '127.0.0.1', () =>
    console.log(
        `proxy ${cert ? 'https/h2' : 'http'} :${listen} -> :${upstream}`,
    ),
);
