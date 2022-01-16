"use strict";

var Sequelize = require('sequelize');


async function initSequelize(dbname, user, password, host, port,sequelizeLogs) {

    // connect to mySQL
    var sequelize = new Sequelize(dbname, user, password, {
        host : host,
        dialect : "mysql",
        port : port,
        logging : sequelizeLogs,        
    });

    var db = {};

    // define Version Object
    db.Log = sequelize.define('Logs', {
        ID : {
            type : Sequelize.INTEGER,
            primaryKey : true
        },
        Time : Sequelize.DATE,
        Facility: Sequelize.INTEGER,
        LogLevel: Sequelize.INTEGER,
        ServerName: Sequelize.STRING,
        Message: Sequelize.STRING,
        Device: Sequelize.STRING,
        LoggerID: Sequelize.STRING,
        PlatfromID: Sequelize.INTEGER,
        DataCenter: Sequelize.STRING,
        User: Sequelize.STRING,
        MessageType: Sequelize.STRING,
        PID: Sequelize.INTEGER,
        AppID: Sequelize.INTEGER,
        ComponentType: Sequelize.STRING
    }, {
        timestamps : false
    });

    // authentication to mySQL
    await sequelize.authenticate();

    return db;

}


module.exports = {
    initSequelize : initSequelize
};

