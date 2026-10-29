# nubo-rsyslog
## Central Logger

It is part of the [Linux Remote Desktop](https://github.com/nubosoftware/linux-remote-desktop) system.

A simple Syslog-based server.

Designed to gather logs from all other services, so the admin has one single point from where to read all logs.

Important log events are added to the database, so they will be available on the Admin Control Panel.

### Build Instructions
```
git clone git@github.com:nubosoftware/nubo-rsyslog.git
cd nubo-rsyslog
docker build . -t nubo-rsyslog
```

### Tests
```
npm install
npm test
```

### Self-check
Every `--selfcheck-interval` seconds (default 300, `0` disables) the server sends a syslog probe
(`nubo-rsyslog-selfcheck <uuid>`) to its own UDP port and checks that it appears in the log file
within `--selfcheck-timeout` seconds (default 30). If it does not (the socket stopped receiving, log
writing is stuck, or the log file system hangs), it prints the reason to stderr, writes a Node
diagnostic report (when `--report-directory` is set, as in the image) and kills itself with SIGKILL,
so Docker's `restart: always` policy starts it again. Probes are written to the log file but never
to the database. A socket error or an uncaught exception also ends the process.

### If logging stops
Capture this before restarting the container (`docker restart` keeps the reports; recreating the
container removes them):
```
docker inspect nubo-rsyslog --format '{{.State.Status}} started={{.State.StartedAt}} restarts={{.RestartCount}}'
docker logs --tail 50 nubo-rsyslog                    # last output; "self-check probe ... killing the process"?
docker exec nubo-rsyslog cat /proc/net/udp            # port 5514 = 158A: still bound? rx_queue column growing?
docker exec nubo-rsyslog sh -c 'cat /proc/1/status | grep -E "State|VmRSS"; for t in /proc/1/task/*; do cat $t/comm $t/wchan; echo; done'
docker kill -s SIGUSR2 nubo-rsyslog                   # Node diagnostic report of the hung process
docker exec nubo-rsyslog ls -l /opt/nubo-rsyslog/reports
docker cp nubo-rsyslog:/opt/nubo-rsyslog/reports ./nubo-rsyslog-reports
ls -l --time-style=+%FT%T <log volume>/nubo*.log      # when did nubo.log stop growing?
```
