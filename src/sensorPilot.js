const path = require('path');
const jsonfile = require('jsonfile');
const EventEmitter = require('events').EventEmitter;
const util = require('util');
const lean = require('./lean-utils');
const TCPClient = require('./tcpClient');
const logger = require('./logger');

const sensorProtocol = jsonfile.readFileSync(path.join(__dirname, '/../configs/sensorProtocol.json'));

function SensorPilot(mac_address, host, port) {
    this.port = port;
    this.host = host;

    const configLines = jsonfile.readFileSync(path.join(__dirname, '/../configs/sensor.json'));
    this.sensorLines = configLines[mac_address];

    this.tcpClient = new TCPClient(this.host, this.port);
    this.mac_address = mac_address;
    this.sensorConnected = false;
    this.queuedBuffers = [];

    this.ackRelaisState = false;
    
    this.latestData = {};
    this.isRelayStateInitialized = false;

    EventEmitter.call(this);

    this.setupTCPClientEventHandlers();
}

util.inherits(SensorPilot, EventEmitter);

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ------------------------------------------ PUBLIC METHODS ------------------------------------------

SensorPilot.prototype.connect = function() {
    this.tcpClient.connect();
};

SensorPilot.prototype.disconnect = function() {
    this.tcpClient.disconnect();
};

SensorPilot.prototype.getLatestData = function() {
    return this.latestData || {};
};

SensorPilot.prototype.restart = function() {
    logger.warn(`Restarting in 1min after wrong data received`, { moduleInfo: 'SensorPilot', addr: this.mac_address });
    this.disconnect();
    
    this.queuedBuffers = [];
    this.tcpClient = null;

    this.emit('disconnected');

    setTimeout(() => {
        this.tcpClient = new TCPClient(this.host, this.port);
        this.setupTCPClientEventHandlers();
        this.connect();
    }, 60000);
}

// ------------------------------------------ TCP CLIENT EVENT HANDLERS ------------------------------------------

SensorPilot.prototype.setupTCPClientEventHandlers = function() {
    this.tcpClient.on('connect', this.onTCPConnect.bind(this));
    this.tcpClient.on('data', this.onTCPData.bind(this));
    this.tcpClient.on('disconnect', this.onTCPDisconnect.bind(this));
};

SensorPilot.prototype.onTCPConnect = async function() {
    this.sensorConnected = true;
    logger.info(`SensorPilot ${this.mac_address} connected`);
    this.emit('connected');

    while (this.queuedBuffers.length > 0) {
        const buffer = this.queuedBuffers.shift();
        this.tcpClient.writeBuffer(buffer);
    }

    this.isRelayStateInitialized = false;
    this.getRelaisState();
};

SensorPilot.prototype.onTCPDisconnect = function() {
    this.sensorConnected = false;
    logger.warn(`SensorPilot ${this.mac_address} TCP disconnected`);
    this.emit('disconnected');
};

SensorPilot.prototype.onTCPData = function(data) {
    if (data.length === 3 && data.toString('hex') === '060d0a') {
        logger.warn(`SensorPilot ${this.mac_address} is updating firmware`);
    } else {
        this.processData(data);
    }
};

// ------------------------------------------ DATA PROCESSING FROM SENSOR ------------------------------------------

SensorPilot.prototype.processData = function(data) {
    var taille = lean.decodeData(data.slice(1, 3).toString('hex'));
    var orderHex = data.slice(3, 4).toString('hex');
    var order = sensorProtocol.reverseOrders[orderHex];

    if (!order) {
        logger.error(`Unknown order: ${orderHex}`, { moduleInfo: 'SensorPilot', addr: this.mac_address });
        this.restart();
        return;
    }

    switch (order.text) {
        case 'read':
            this.processReadCommands(data, taille);
            break;
        case 'write':
            this.processWriteCommands(data, taille);
            break;
        case 'period':
            this.processPeriodicCommands(data.slice(19, taille - 5));
            break;
        default:
            logger.error(`Unknown command for sensor ${this.mac_address}: ${orderHex}`);
            break;
    }
};

SensorPilot.prototype.processReadCommands = function(buffer, taille) {
    var command = buffer.slice(4, 6).toString('hex');
    var data = buffer.slice(7, taille - 5);
    var commandText = sensorProtocol.reverseOrders[sensorProtocol.orders.read.value].commands[command];
    
    logger.info(`Processing read command: ${commandText}`, { moduleInfo: 'SensorPilot', addr: this.mac_address });

    switch (commandText) {
        case 'relaisState':
            this.readRelaisStates(data.slice(1, 2).toString('hex'), data.slice(2, 3).toString('hex'));
            break;
        case 'version':
            lean.decodeUnmaskedData(data, function(version) {
                logger.info(`Sensor version: ${version}`, { moduleInfo: 'SensorPilot', addr: self.mac_address });
            });
            break;
        default:
            break;
    }
};

SensorPilot.prototype.processPeriodicCommands = function(buffer){
    if (!this.isRelayStateInitialized) {
        this.getRelaisState();
    }

    logger.info(`Processing periodic data`, { moduleInfo: 'SensorPilot', addr: this.mac_address });

    if(this.sensorLines.pince == undefined || this.sensorLines.relais == undefined)
        return false;

    var data = {};

    // pinces
    for(var i=0;i<6;i++){
        var value = parseInt(lean.decodeData(buffer.slice(i*6,i*6+6).toString('hex'))) / 10;
        // PATCH : pinces[6-i] car pince 1 soft Sensor = pince 6 IHM client
        value = (value <= this.sensorLines.pince[6-i].threshold) ? 0 : value
        data[this.sensorLines.pince[6-i].id] = value > 45 ? value : 0;
    }

    // relais
    var indices = ['F','E','D','C','B','A'];
    for(var i=6;i<12;i++){
        var value = parseInt(lean.decodeData(buffer.slice(i*6,i*6+6).toString('hex'))) / 10
        value = (value <= this.sensorLines.relais[indices[i-6]].threshold) ? 0 : value
        data[this.sensorLines.relais[indices[i-6]].id] = value;
    }

    logger.info(`Received sensor data: ${JSON.stringify(data)}`, { moduleInfo: 'SensorPilot', addr: this.mac_address });
    this.latestData['sensor'] = data;
    this.emit('data', this.latestData);
};

SensorPilot.prototype.processWriteCommands = function(buffer, taille){
    logger.info(`Processing write command`, { moduleInfo: 'SensorPilot', addr: this.mac_address });

    var command = buffer.slice(4,6).toString('hex'),
        data = buffer.slice(7,taille - 5);

    switch(sensorProtocol.reverseOrders[sensorProtocol.orders.write.value].commands[command]){
        case 'relaisState':
            logger.info(`Relay state updated`, { moduleInfo: 'SensorPilot', addr: this.mac_address });
            this.readRelaisStates(data.slice(1,2).toString('hex'),data.slice(2,3).toString('hex'));
            break;
        default:
            break;
    }
};

SensorPilot.prototype.readRelaisStates = function(byte1, byte2){
    this.isRelayStateInitialized = true;

    if(this.ackRelaisState == false){
        this.ackRelaisState = true;
    }

    var value1 = parseInt(byte1.slice(-1),16),
        value2 = parseInt(byte2.slice(-1),16),
        relais = {};

    var indices = ['F','E','D','C'];
    var subs = [1,2,4,8];
    for(var i=4;i>0;i--){
        if(value1 >= subs[i-1]){
            relais[this.sensorLines.relais[indices[i-1]].id] = 'OFF';
            value1 = value1 - subs[i-1];
        }else relais[this.sensorLines.relais[indices[i-1]].id] = 'ON';
    }

    switch(value2){
        case 0: relais[this.sensorLines.relais['B'].id] = 'ON'; relais[this.sensorLines.relais['A'].id] = 'ON';break;
        case 1: relais[this.sensorLines.relais['B'].id] = 'OFF'; relais[this.sensorLines.relais['A'].id] = 'ON';break;
        case 2: relais[this.sensorLines.relais['B'].id] = 'ON'; relais[this.sensorLines.relais['A'].id] = 'OFF';break;
        case 3: relais[this.sensorLines.relais['B'].id] = 'OFF'; relais[this.sensorLines.relais['A'].id] = 'OFF';break;
        default:break;
    }

    this.latestData['relais'] = relais;
    logger.info(`Received relay states: ${JSON.stringify(relais)}`, { moduleInfo: 'SensorPilot', addr: this.mac_address });
    this.emit('data', this.latestData);
};

// ------------------------------------------ COM TO SENSOR ------------------------------------------

SensorPilot.prototype.writeBuffer = function(buffer, autoFree) {
    if (this.sensorConnected) {
        this.tcpClient.writeBuffer(buffer);
    } else {
        this.queuedBuffers.push(buffer);
    }
};

// Read Commands

SensorPilot.prototype.getVersion = function() {
    var self = this;
    lean.getBufferFromMaskedData('read', 'version', '3030', function(buffer) {
        self.writeBuffer(buffer, true);
    });
};

SensorPilot.prototype.getRelaisState = function() {
    var self = this;
    lean.getBufferFromMaskedData('read', 'relaisState', '3030', function(buffer){
        self.writeBuffer(buffer, true);
    });
}

// Write Commands

SensorPilot.prototype.setRelayState = async function(relay_id, state) {
    var letter = '', i = 'A';
    while (letter == '' && i < 'G') {
        if (this.sensorLines.relais[i].id == relay_id)
            letter = i;
        else i = String.fromCharCode(i.charCodeAt(0) + 1);
    }

    if (letter != '') {
        var relay = '', value = '';
        switch (letter) {
            case 'A':
                relay = '36';
                break;
            case 'B':
                relay = '35';
                break;
            case 'C':
                relay = '34';
                break;
            case 'D':
                relay = '33';
                break;
            case 'E':
                relay = '32';
                break;
            case 'F':
                relay = '31';
                break;
            default:
                break;
        }
        value = state == 'ON' ? '3030' : '3131';

        var self = this;
        this.ackRelaisState = false;
        lean.getBufferFromMaskedData('write', 'relaisState', relay + value, function(buffer) {
            self.writeBuffer(buffer, true);
        });
        while (this.ackRelaisState == false) {
            await delay(5000);
            this.getRelaisState();
        }
    } else {
        logger.error(`Relay with ID ${relay_id} not found`, { moduleInfo: 'SensorPilot', addr: this.mac_address });
    }
};

module.exports = SensorPilot;
