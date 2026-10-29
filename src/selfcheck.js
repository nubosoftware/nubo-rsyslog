/**
 * Self-check: periodically send a syslog probe to our own UDP port and poll the log file until the
 * probe shows up in it. If it does not within the timeout - the socket stopped receiving, log
 * writing stalled, or the filesystem hangs - call onFail, so the process can be stopped and
 * Docker's restart policy brings it back.
 *
 * The file itself is checked on purpose: winston's 'logged' event fires when a line enters the
 * transport's in-memory stream, not when it reaches the file, so it keeps firing for a while after
 * the file write is stuck.
 */
const dgram = require('dgram');
const os = require('os');
const crypto = require('crypto');

const PROBE_PREFIX = 'nubo-rsyslog-selfcheck';

function isProbe(msg) {
    return typeof msg === 'string' && msg.startsWith(PROBE_PREFIX + ' ');
}

// verify(id) -> Promise<boolean>: is the probe with this id in the log file? It may throw or never
// settle (stuck filesystem); both count as "not found".
function startSelfCheck({ port, host = '127.0.0.1', intervalMs, timeoutMs, pollMs = 1000, verify, onFail, socket = dgram.createSocket('udp4') }) {
    let failed = false;
    let stopped = false;
    const fail = (reason) => {
        if (failed || stopped) return;
        failed = true;
        onFail(reason);
    };

    function probe() {
        if (failed || stopped) return;
        const id = crypto.randomUUID();
        const deadline = Date.now() + timeoutMs;
        let found = false;
        let checking = false;
        let poller = null;

        const finish = () => { clearInterval(poller); clearTimeout(timer); };
        const timer = setTimeout(() => {
            finish();
            if (!found) fail(`self-check probe ${id} not found in the log file within ${timeoutMs} ms`);
        }, timeoutMs);

        const check = () => {
            if (checking || found || Date.now() > deadline) return;
            checking = true;
            Promise.resolve()
                .then(() => verify(id))
                .then((ok) => { if (ok) { found = true; finish(); } }, () => {})
                .finally(() => { checking = false; });
        };

        // <14> = facility user, severity info: the logger writes info and above
        const line = `<14>1 ${new Date().toISOString()} ${os.hostname()} nubo-rsyslog - - - ${PROBE_PREFIX} ${id}`;
        socket.send(line, port, host, (err) => {
            if (err) {
                finish();
                fail(`self-check probe could not be sent: ${err.message}`);
                return;
            }
            if (found || Date.now() > deadline) return;
            poller = setInterval(check, pollMs);
            check();
        });
    }

    const interval = setInterval(probe, intervalMs);
    return {
        probe,
        stop() {
            stopped = true;
            clearInterval(interval);
            try { socket.close(); } catch (e) { /* already closed */ }
        },
    };
}

module.exports = { startSelfCheck, isProbe, PROBE_PREFIX };
