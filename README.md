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
