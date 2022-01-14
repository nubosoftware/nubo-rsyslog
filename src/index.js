/**
 * Nubo Syslog Server
 * A simple syslog server
 * The supported syslog transport is only UDP
 * The supported syslog message format: RSYSLOG_SyslogProtocol23Format - the format specified in IETF’s internet-draft ietf-syslog-protocol-23, which is very close to the actual syslog standard RFC5424 (we couldn’t update this template as things were in production for quite some time when RFC5424 was finally approved). This format includes several improvements. You may use this format with all relatively recent versions of rsyslog or syslogd.
        template(name="RSYSLOG_SyslogProtocol23Format" type="string"
            string="<%PRI%>1 %TIMESTAMP:::date-rfc3339% %HOSTNAME% %APP-NAME% %PROCID% %MSGID% %STRUCTURED-DATA% %msg%\n")
 */

            //action(type="omfwd" Target="labil.nubosoftware.com" Port="5514" Protocol="udp" template="RSYSLOG_SyslogProtocol23Format")

const { program } = require('commander');
const path = require('path');
program.version('0.0.1');
program
    .option('--log <log file>', 'Log file path', './log/nubo.log')
    .option('--err <error log file>', 'Errior log file path', './log/error.log')
    .option('--maxsize <bytes>', 'Maximum log file size in bytes', 100 * 1024 * 1024)
    .option('--maxFiles <number>', 'Maximum number of log file', 4)
    .option('-p, --port <port>', 'Listen UDP port',5514)
    .option('-h, --host <host>', 'Listen Address','0.0.0.0');
program.parse(process.arg);

const options = program.opts();
options.log = path.resolve(options.log);
options.err = path.resolve(options.err);
console.log(`Starting Syslog Server. options: ${JSON.stringify(options)}`);

const SyslogServer = require("syslog-server");
const priregex = /<([0-9]+)>1/;


const { createLogger, format, transports, addColors } = require('winston');
const { combine, timestamp, label, printf } = format;

const myFormat = printf(info => {
    return `${info.timestamp} ${info.hostname} ${info.app} ${info.level}: ${info.message}`;
});

/*
 0       Emergency: system is unusable
              1       Alert: action must be taken immediately
              2       Critical: critical conditions
              3       Error: error conditions
              4       Warning: warning conditions
              5       Notice: normal but significant condition
              6       Informational: informational messages
              7       Debug: debug-level messages
*/
const syslogLevels = {
    levels: {
        emergency: 0,
        alert: 1,
        critical: 2,
        error: 3,
        warning: 4,
        notice: 5,
        info: 8,
        debug: 7
    },
    colors: {
        emergency: 'red',
        alert: 'red',
        critical: 'red',
        error: 'red',
        warning: 'yellow',
        notice: 'green',
        info: 'blue',
        debug: 'gray'
    }
};
var severityToLevel = Object.keys(syslogLevels.levels).map((key) => key);
let logFileName = options.log; //'/var/log/nubo.log';
let errorLogFileName = options.err;
let logTransports = [
    new (transports.Console)({
        name: 'console',
        json: true,
        handleExceptions: true,
        timestamp: true,
        colorize: true
    }),
    new transports.File({
        name: 'file',
        filename: logFileName,
        handleExceptions: true,
        maxsize: options.maxsize,
        maxFiles: options.maxFiles,
    })
];

const logger = createLogger({
    levels: syslogLevels.levels,
    format: combine(
        timestamp(),
        myFormat
    ),
    transports: logTransports,
    exceptionHandlers: [
        new (transports.Console)({
            json: false,
            timestamp: true
        }),
        new transports.File({
            filename: errorLogFileName,
            json: false
        })
    ],
    exitOnError: false
});

addColors(syslogLevels.colors);

/*logger.log({
    level: "error",
    message: "A test message",
    label: "Test Label",
    hostname: "nubo-ps",
    app: "platform_server[1234]",
    timestamp: new Date("2020-01-01").toISOString()
});
logger.info("This is a test...");*/

const server = new SyslogServer();
server.on("message", (value) => {
    // console.log(value.date);     // the date/time the message was received
    // console.log(value.host);     // the IP address of the host that sent the message
    // console.log(value.protocol); // the version of the IP protocol ("IPv4" or "IPv6")
    // console.log(value.message);  // the syslog message
    try {
        let a = value.message.split(" ");
        let pstr = a.shift();
        const m = pstr.match(priregex);
        const pri = m[1];
        let severity = pri % 8;
        let level = severityToLevel[severity];
        let facility = (pri - severity) / 8;
        let dstr = a.shift();
        let d = new Date(dstr);
        let hostname = a.shift();
        let appid = a.shift();
        let pid = a.shift();
        let msgid = a.shift();
        let sdata = a.shift();
        let msg = a.join(" ").trim();
        let mtype = "";
        let logid = "";
        let user = "";
        let isjson = false;
        // check if msg is json
        try {
            let obj = JSON.parse(msg);
            isjson = true;
            if (obj.mtype) {
                mtype = obj.mtype;
            }
            if (obj.logid) {
                logid = obj.logid;
            }
            if (obj.user) {
                user = obj.user;
            }
            if (obj.message) {
                msg = obj.message;
            }
        } catch (e) {
            // ignore error
        }
        //console.log(`pstr : ${pstr}, d: ${d}, hostname: ${hostname}, appid: ${appid}, pid: ${pid}, msgid: ${msgid}, sdata: ${sdata}, mtype: ${mtype}, logid: ${logid}, user: ${user}, msg: ${msg}, isjson: ${isjson}`);
        logger.log({
            level: level,
            message: msg,
            hostname: hostname,
            app: `${appid}[${pid}]`,
            timestamp: d.toISOString()
        });
    } catch (e) {
        //console.log(`Syslog message parsing error: ${e}`);
        logger.log({
            level: 'info',
            message: value.message,
            hostname: value.host,
        });
    }
});


// insert into Logs (Time,                          Facility,           User,       LogLevel,          DataCenter, ServerName,    Message,       MessageType, LoggerID,    PID,        ComponentType ) 
//           values ('%timereported:::date-mysql%', '%syslogfacility%', '%$!user%','%syslogpriority%', '%$!dc%',   '%HOSTNAME%', '%$!message%', '%$!mtype%',  '%$!logid%', '%procid%', '%app-name%' )
server.start({ port: options.port, address: options.host, exclusive: true });