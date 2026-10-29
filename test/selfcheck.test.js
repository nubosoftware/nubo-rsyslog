const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startSelfCheck, isProbe } = require('../src/selfcheck');

// A fake UDP socket that records what was sent.
function fakeSocket() {
    const sent = [];
    return {
        sent,
        send(msg, port, host, cb) { sent.push({ msg: String(msg), port, host }); cb && cb(null); },
        close() {},
    };
}

const idOf = (msg) => msg.split(' ').pop();

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

test('a probe found in the log file passes; nothing fails', async () => {
    const socket = fakeSocket();
    const written = new Set();
    // the probe shows up in the "file" a little after it is sent
    const verify = async (id) => written.has(id);
    const origSend = socket.send;
    socket.send = (msg, port, host, cb) => { origSend(msg, port, host, cb); setTimeout(() => written.add(idOf(String(msg))), 10); };
    const failures = [];
    const sc = startSelfCheck({ port: 5514, intervalMs: 30, timeoutMs: 100, pollMs: 5, verify, socket, onFail: (r) => failures.push(r) });
    await wait(200);
    sc.stop();
    assert.ok(socket.sent.length >= 3, `expected several probes, got ${socket.sent.length}`);
    assert.deepEqual(failures, []);
    assert.equal(socket.sent[0].host, '127.0.0.1');
    assert.equal(socket.sent[0].port, 5514);
    assert.match(socket.sent[0].msg, /^<14>1 \S+ \S+ nubo-rsyslog - - - nubo-rsyslog-selfcheck [0-9a-f-]{36}$/);
});

test('a probe that never reaches the log file calls onFail once', async () => {
    const failures = [];
    const sc = startSelfCheck({ port: 5514, intervalMs: 20, timeoutMs: 40, pollMs: 5, verify: async () => false, socket: fakeSocket(), onFail: (r) => failures.push(r) });
    await wait(200);
    sc.stop();
    assert.equal(failures.length, 1);
    assert.match(failures[0], /not found in the log file within 40 ms/);
});

test('a log-file check that hangs (stuck filesystem) still fails at the deadline', async () => {
    const failures = [];
    const sc = startSelfCheck({ port: 5514, intervalMs: 1000, timeoutMs: 40, pollMs: 5, verify: () => new Promise(() => {}), socket: fakeSocket(), onFail: (r) => failures.push(r) });
    sc.probe();
    await wait(120);
    sc.stop();
    assert.equal(failures.length, 1);
});

test('a log-file check that throws counts as not found', async () => {
    const failures = [];
    const sc = startSelfCheck({ port: 5514, intervalMs: 1000, timeoutMs: 40, pollMs: 5, verify: async () => { throw new Error('EIO'); }, socket: fakeSocket(), onFail: (r) => failures.push(r) });
    sc.probe();
    await wait(120);
    sc.stop();
    assert.equal(failures.length, 1);
});

test('a send error calls onFail', async () => {
    const failures = [];
    const socket = { send(m, p, h, cb) { cb(new Error('EHOSTUNREACH')); }, close() {} };
    const sc = startSelfCheck({ port: 5514, intervalMs: 1000, timeoutMs: 40, pollMs: 5, verify: async () => true, socket, onFail: (r) => failures.push(r) });
    sc.probe();
    await wait(60);
    sc.stop();
    assert.equal(failures.length, 1);
    assert.match(failures[0], /EHOSTUNREACH/);
});

test('isProbe recognises probe messages only', () => {
    assert.equal(isProbe('nubo-rsyslog-selfcheck 1b4e28ba-2fa1-11d2-883f-0016d3cca427'), true);
    assert.equal(isProbe('user login nubo-rsyslog-selfcheck'), false);
    assert.equal(isProbe(undefined), false);
});
