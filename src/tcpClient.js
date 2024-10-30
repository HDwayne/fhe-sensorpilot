const net = require('net');
const EventEmitter = require('events').EventEmitter;
const util = require('util');
const logger = require('./logger');

function TCPClient(host, port) {
    this.host = host;
    this.port = port;
    this.tcpClient = null;
    this.isConnected = false;
    this.isConnecting = false;

    EventEmitter.call(this);
    this.createClient();
}

util.inherits(TCPClient, EventEmitter);

TCPClient.prototype.createClient = function() {
    if (this.tcpClient) {
        this.cleanup();
    }
    
    this.tcpClient = new net.Socket();
    this.tcpClient.setNoDelay();

    const self = this;

    this.tcpClient.on('close', function(had_error) {
        self.isConnected = false;
        self.isConnecting = false;
        logger.debug(`TCP client disconnected, error: ${had_error}`, { moduleInfo: "TCPClient", addr: `${self.host}:${self.port}` });
        self.emit('disconnect');
        self.handleReconnect();
    });

    this.tcpClient.on('error', function(err) {
        logger.error(`TCP client error: ${err.message}`, { moduleInfo: "TCPClient", addr: `${self.host}:${self.port}` });
    });

    this.tcpClient.on('timeout', function() {
        self.isConnected = false;
        self.isConnecting = false;
        logger.debug('TCP client timeout', { moduleInfo: "TCPClient", addr: `${self.host}:${self.port}` });
        self.emit('disconnect');
        self.handleReconnect();
    });

    this.tcpClient.on('connect', function() {
        self.isConnected = true;
        self.isConnecting = false;
        logger.debug('TCP client connected', { moduleInfo: "TCPClient", addr: `${self.host}:${self.port}` });
        self.emit('connect');
    });

    this.tcpClient.on('data', function(data) {
        logger.debug(`Received data: ${data.length} bytes`, { moduleInfo: "TCPClient", addr: `${self.host}:${self.port}` });
        self.emit('data', data);
    });
};

TCPClient.prototype.connect = function(timeout = 30000) {
    if (this.isConnecting) {
        logger.warn('Connection attempt already in progress');
        return;
    }

    this.isConnecting = true;

    logger.debug(`Connecting to ${this.host}:${this.port}`, { moduleInfo: "TCPClient", addr: `${this.host}:${this.port}` });

    this.tcpClient.connect(this.port, this.host, () => {
        this.tcpClient.setTimeout(timeout);
    });
};

TCPClient.prototype.writeBuffer = function(buffer) {
    if (this.isConnected && this.tcpClient.writable) {
        logger.debug(`Sending buffer: ${buffer.toString('hex')}`, { moduleInfo: "TCPClient", addr: `${this.host}:${this.port}` });
        this.tcpClient.write(buffer);
    } else {
        logger.warn(`Attempted to write to a non-writable socket`, { moduleInfo: "TCPClient", addr: `${this.host}:${this.port}` });
    }
};

TCPClient.prototype.disconnect = function() {
    if (this.isConnected) {
        logger.debug('TCP client disconnecting...', { moduleInfo: "TCPClient", addr: `${this.host}:${this.port}` });
        this.tcpClient.end(() => {
            logger.debug('TCP client gracefully disconnected', { moduleInfo: "TCPClient", addr: `${this.host}:${this.port}` });
            this.cleanup();
        });
    } else {
        this.cleanup();
    }
};

TCPClient.prototype.cleanup = function() {
    if (this.tcpClient) {
        this.tcpClient.removeAllListeners();
        if (!this.tcpClient.destroyed) {
            this.tcpClient.destroy();
            logger.debug('TCP client socket destroyed', { moduleInfo: "TCPClient", addr: `${this.host}:${this.port}` });
        }
    }
    this.isConnected = false;
    this.isConnecting = false;
};

TCPClient.prototype.handleReconnect = function(retryCount = 0) {
    if (this.isConnecting) {
        logger.warn('Reconnect attempt already in progress, skipping...');
        return;
    }

    logger.debug(`Reconnecting in 15s.`, { moduleInfo: "TCPClient", addr: `${this.host}:${this.port}` });

    setTimeout(() => {
        retryCount += 1;
        this.cleanup();
        this.createClient();
        this.connect();
    }, 15000);
};


module.exports = TCPClient;
