const winston = require('winston');
const winstonColorizer = winston.format.colorize();

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp, addr, moduleInfo }) => {
            const coloredLevel = winstonColorizer.colorize(level, level.toUpperCase());
            const modInfo = moduleInfo ? `${moduleInfo}` : '\t';
            const addrInfo = addr ? `${addr}` : '\t';
            // return `${timestamp} ${modInfo} ${macInfo} ${coloredLevel} : ${message}`;
            return `${modInfo}\t ${addrInfo}\t ${coloredLevel} : ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'app.log' })
    ],
});

module.exports = logger;
