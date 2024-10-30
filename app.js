require('dotenv').config();
const path = require('path');
const jsonfile = require('jsonfile');
const express = require('express');
const logger = require('./src/logger');
const http = require('http');
const WebSocket = require('ws');
const mqtt = require('mqtt');

const app = express();
const port = process.env.PORT || 3000;

const mqttClient = mqtt.connect(process.env.MQTT_URL || 'mqtt://localhost', {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD
});

mqttClient.on('connect', () => {
    logger.info('Connected to MQTT broker');
});

mqttClient.on('error', (err) => {
    logger.error(`Failed to connect to MQTT broker: ${err.message}`);
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const sensorConfigPath = path.join(__dirname, 'configs', 'sensor.json');
let sensorConfig = jsonfile.readFileSync(sensorConfigPath);

const SensorPilot = require('./src/sensorPilot');

var sensors = {};
let clients = [];

wss.on('connection', (ws) => {
    logger.info('New WebSocket connection');
    clients.push(ws);

    ws.on('close', () => {
        clients = clients.filter(client => client !== ws);
    });
});

for (const mac_address in sensorConfig) {
    if (sensorConfig.hasOwnProperty(mac_address)) {
        const sensor = new SensorPilot(mac_address, sensorConfig[mac_address].host, sensorConfig[mac_address].port);
        sensors[mac_address] = sensor;
        setupSensorEventHandlers(sensor);
        sensor.connect();
    }
}

function setupSensorEventHandlers(sensor) {
    sensor.on('data', (data) => {
        broadcastSensorData(sensor.mac_address, data);
        publishToMQTT(sensor.mac_address, data);
    });

    sensor.on('connected', () => {
        logger.info(`Sensor ${sensor.mac_address} connected`);
        broadcastSensorStatus(sensor.mac_address, 'connected');
        publishStatusToMQTT(sensor.mac_address, 'connected');
    });

    sensor.on('disconnected', () => {
        logger.info(`Sensor ${sensor.mac_address} disconnected`);
        broadcastSensorStatus(sensor.mac_address, 'disconnected');
        publishStatusToMQTT(sensor.mac_address, 'disconnected');
    });
}

function broadcastSensorData(mac_address, data) {
    const mes = {}
    mes[mac_address] = data;
    const message = JSON.stringify(mes);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            logger.debug(`Broadcasting data : ${message}`);
            client.send(message);
        }
    });
}

function broadcastSensorStatus(mac_address, status) {
    const message = JSON.stringify({
        [mac_address]: {
            status: status
        }
    });
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            logger.debug(`Broadcasting status: ${message}`);
            client.send(message);
        }
    });
}

function publishStatusToMQTT(mac_address, status) {
    const topic = `sensors/sensorpilot/${mac_address}/status`;
    const message = JSON.stringify(status);

    mqttClient.publish(topic, message, (err) => {
        if (err) {
            logger.error(`Failed to publish status to MQTT topic ${topic}: ${err.message}`);
        } else {
            logger.info(`Sensor status published to MQTT topic ${topic}`);
        }
    });
}

function publishToMQTT(mac_address, data) {
    const topic = `sensors/sensorpilot/${mac_address}/data`;
    const message = JSON.stringify(data);

    mqttClient.publish(topic, message, (err) => {
        if (err) {
            logger.error(`Failed to publish data to MQTT topic ${topic}: ${err.message}`);
        } else {
            logger.info(`Sensor data published to MQTT topic ${topic}`);
        }
    });
}


app.use(express.json());
app.use(express.static('public'));

app.get('/api/env', (req, res) => {
    res.json({ wsUrl: process.env.WS_URL || 'ws://localhost:3000' });
});

app.post('/api/sensors/:mac_address/relay/:relay_id', (req, res) => {
    const mac_address = req.params.mac_address;
    const relay_id = req.params.relay_id;
    const state = req.body.state; // 'ON' or 'OFF'

    const sensor = sensors[mac_address];

    if (!sensor) {
        return res.status(404).json({ error: 'Sensor not found' });
    }

    sensor.setRelayState(relay_id, state);
    res.json({ message: 'Relay state updated' });
});

server.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
    logger.info('Shutting down...');
    for (const mac_address in sensors) {
        if (sensors.hasOwnProperty(mac_address)) {
            sensors[mac_address].disconnect();
        }
    }
    mqttClient.end();
    process.exit(0);
}
