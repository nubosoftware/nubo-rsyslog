// Runs the real server (src/index.js) on a free UDP port with a temporary log directory.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const dgram = require('dgram');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');

function freeUdpPort() {
    return new Promise((resolve) => {
        const s = dgram.createSocket('udp4');
        s.bind(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
    });
}

async function startServer(extraArgs = []) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nubo-rsyslog-'));
    const port = await freeUdpPort();
    const args = ['src/index.js', '--log', path.join(dir, 'nubo.log'), '--err', path.join(dir, 'error.log'),
        '--settings', path.join(dir, 'missing.json'), '-p', String(port), '-h', '127.0.0.1', ...extraArgs];
    const child = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (out += c));
    const exited = new Promise((r) => child.on('exit', (code) => r(code)));
    return { dir, port, child, exited, output: () => out, log: () => { try { return fs.readFileSync(path.join(dir, 'nubo.log'), 'utf8'); } catch { return ''; } } };
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitFor(fn, ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (fn()) return true; await wait(50); }
    return fn();
}

test('a syslog message is written to the log file', async () => {
    const s = await startServer(['--selfcheck-interval', '0']);
    try {
        // UDP sent before the server is bound is lost: resend until the line shows up
        const c = dgram.createSocket('udp4');
        const resend = setInterval(() => c.send('<14>1 2026-10-29T10:00:00.000Z testhost testapp 42 - - TEST-LINE-OK', s.port, '127.0.0.1'), 200);
        const ok = await waitFor(() => s.log().includes('TEST-LINE-OK'), 5000);
        clearInterval(resend);
        c.close();
        assert.ok(ok, s.output());
    } finally { s.child.kill(); }
});

test('the self-check probe is written to the log file and the server keeps running', async () => {
    const s = await startServer(['--selfcheck-interval', '1', '--selfcheck-timeout', '2']);
    try {
        assert.ok(await waitFor(() => s.log().includes('nubo-rsyslog-selfcheck'), 4000), s.output());
        await wait(1500);
        assert.equal(s.child.exitCode, null, 'server exited: ' + s.output());
    } finally { s.child.kill(); }
});

test('the server is killed when log writing is stuck (log file is a FIFO nobody reads)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nubo-rsyslog-'));
    require('child_process').execFileSync('mkfifo', [path.join(dir, 'nubo.log')]);
    const port = await freeUdpPort();
    const reports = path.join(dir, 'reports');
    fs.mkdirSync(reports);
    const child = spawn(process.execPath, [`--report-directory=${reports}`, 'src/index.js', '--log', path.join(dir, 'nubo.log'), '--err', path.join(dir, 'error.log'),
        '--settings', path.join(dir, 'missing.json'), '-p', String(port), '-h', '127.0.0.1',
        '--selfcheck-interval', '1', '--selfcheck-timeout', '2'], { cwd: root });
    let err = '';
    child.stderr.on('data', (c) => (err += c));
    const result = await Promise.race([new Promise((r) => child.on('exit', (code, signal) => r({ code, signal }))), wait(10000).then(() => 'still running')]);
    if (result === 'still running') child.kill('SIGKILL');
    assert.notEqual(result, 'still running', 'stuck server was not stopped');
    assert.equal(result.signal, 'SIGKILL');
    assert.match(err, /not found in the log file/);
    // a diagnostic report is written before the kill, when a report directory is configured
    const files = fs.readdirSync(reports).filter((f) => f.endsWith('.json'));
    assert.equal(files.length, 1, err);
    assert.match(err, /diagnostic report written to /);
});

test('the server stops when its UDP port is already taken', async () => {
    const blocker = dgram.createSocket('udp4');
    await new Promise((r) => blocker.bind(0, '127.0.0.1', r));
    const port = blocker.address().port;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nubo-rsyslog-'));
    const child = spawn(process.execPath, ['src/index.js', '--log', path.join(dir, 'nubo.log'), '--err', path.join(dir, 'error.log'),
        '--settings', path.join(dir, 'missing.json'), '-p', String(port), '-h', '127.0.0.1', '--selfcheck-interval', '0'], { cwd: root });
    let err = '';
    child.stderr.on('data', (c) => (err += c));
    const result = await Promise.race([new Promise((r) => child.on('exit', (code, signal) => r({ code, signal }))), wait(8000).then(() => 'still running')]);
    if (result === 'still running') child.kill();
    blocker.close();
    assert.notEqual(result, 'still running', 'server kept running without its UDP socket');
    assert.equal(result.signal, 'SIGKILL');
    assert.match(err, /EADDRINUSE/);
});
