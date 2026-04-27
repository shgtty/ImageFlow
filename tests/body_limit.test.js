const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const EventEmitter = require('node:events');

// Mocking collectRequestBody logic for testing
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB

function collectRequestBody(req, res, callback) {
    let body = '';
    let size = 0;
    let limitExceeded = false;

    req.on('data', chunk => {
        if (limitExceeded) return;
        size += chunk.length;
        if (size > MAX_BODY_SIZE) {
            limitExceeded = true;
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Payload Too Large' }));
            req.destroy();
            return;
        }
        body += chunk.toString();
    });

    req.on('end', () => {
        if (!limitExceeded) {
            callback(body);
        }
    });
}

test('collectRequestBody limits body size', async (t) => {
    await t.test('accepts body under the limit', (t, done) => {
        const req = new EventEmitter();
        const res = {
            writeHead: () => {},
            end: () => {}
        };
        const testData = 'hello world';

        collectRequestBody(req, res, (body) => {
            assert.strictEqual(body, testData);
            done();
        });

        req.emit('data', Buffer.from(testData));
        req.emit('end');
    });

    await t.test('rejects body over the limit', (t, done) => {
        const req = new EventEmitter();
        req.destroy = () => { req.destroyed = true; };

        let statusCode = 0;
        let responseBody = '';

        const res = {
            writeHead: (status) => { statusCode = status; },
            end: (body) => { responseBody = body; }
        };

        collectRequestBody(req, res, (body) => {
            assert.fail('Callback should not be called for large body');
        });

        const largeChunk = Buffer.alloc(MAX_BODY_SIZE + 1);
        req.emit('data', largeChunk);

        assert.strictEqual(statusCode, 413);
        assert.strictEqual(JSON.parse(responseBody).error, 'Payload Too Large');
        assert.strictEqual(req.destroyed, true);
        done();
    });
});
