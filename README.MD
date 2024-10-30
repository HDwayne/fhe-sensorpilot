# SensorPilot Controller Service (Discontinued)

A Node.js application designed to control FHE Sensor Pilot V1.9 devices. This project aimed to create a Dockerized service capable of managing SensorPilot devices, receiving real-time sensor data, controlling relays, and integrating with MQTT brokers. It was designed to facilitate the integration of SensorPilot devices into home automation systems, such as Home Assistant or Node-RED.

However, due to persistent issues with excessive disconnections from the SensorPilot devices and a lack of reliability in maintaining stable connections, **I have decided to discontinue the development of this project**.

Additionally, the Wi-Fi configuration protocol for SensorPilot devices requires hardware that can connect directly to the sensor's Access Point (AP) Wi-Fi mode. Something that is not feasible within a Dockerized environment. This limitation further complicates the project's deployment and usability.

> **Note**: This project is fully based on the official FHE app and its communication protocol available on the Raspberry Pi SD card.


## Features

- **Web Interface**: Access the SensorPilot controller via a web interface.
- **Device Management**: Connect and manage multiple SensorPilot devices simultaneously.
- **Relay Control**: Control sensor relays using RESTful API endpoints.
- **Real-Time Data Streaming**: Broadcast real-time sensor data via WebSocket (mainly used for web-based dashboards).
- **MQTT Integration**: Publish sensor data and device statuses to an MQTT broker for integration with other systems.
- **Dockerized Deployment**: Run the application in a Docker container for easy setup and isolation.

## Project Goals

The primary goal of this project was to eliminate dependency on the official FHE SensorPilot app and provide a standalone service capable of directly controlling SensorPilot devices. The aim was to build a simple solution for integrating these devices into modern home automation systems.

However, due to the aforementioned issues, this goal is no longer being pursued.

## Requirements

- **Node.js** (version 14 or higher)
- **npm** (Node Package Manager)
- **Docker** (optional, for containerized deployment)
- **MQTT Broker** (e.g., Mosquitto)
- **SensorPilot Devices** (FHE Sensor Pilot V1.9)

## Logs example

Some logs examples of the application:

```bash
TCPClient	 192.168.1.129:3000	 DEBUG : Received data: 98 bytes
SensorPilot	 0080E1BB94D3	 INFO : Processing periodic data
SensorPilot	 0080E1BB94D3	 INFO : Received sensor data: {"21735":0,"21736":3,"21737":0,"21738":0,"21739":0,"21740":0,"21741":622.5,"21742":53.8,"21743":0,"21744":46,"21745":277.9,"21746":837.9}
```

```bash
TCPClient	 192.168.1.129:3000	 DEBUG : Sending buffer: 02303d523032303035323b3f03
TCPClient	 192.168.1.129:3000	 DEBUG : Received data: 15 bytes
SensorPilot	 0080E1BB94D3	 INFO : Processing read command: relaisState
SensorPilot	 0080E1BB94D3	 INFO : Received relay states: {"21735":"OFF","21736":"OFF","21737":"OFF","21738":"OFF","21739":"OFF","21740":"OFF"}
```

## Installation

### Setting Up the Environment

1. **Install Dependencies**:

   ```bash
   npm install
   ```

2. **Create a `.env` File**:

   Create a `.env` file in the root directory to configure environment variables:

   ```bash
   touch .env
   ```

   Sample `.env` file:

   ```dotenv
   PORT=3000
   WS_URL=ws://localhost:3000
   MQTT_URL=mqtt://localhost
   MQTT_USERNAME=your_mqtt_username
   MQTT_PASSWORD=your_mqtt_password
   ```

   Alternatively, you can refer to the `.env.sample` file for a template configuration.

3. **Configure Sensors**:

   Ensure you have a `sensor.json` configuration file in the `configs` directory. This file should contain the configurations for your SensorPilot devices.

   You can find these configuration files on the SD card of the Raspberry Pi that comes with the SensorPilot device. Look in the `/home/pi/` directory to locate the configuration files provided by the official FHE app. Copy these files to the `configs` directory of this project.

   > **Note**: Please use linux to read the SD card. Windows may not be able to find the linux files system.

## Running the Application

### Using Docker

1. **Run the Docker Container**:

   ```bash
   docker compose up -d --build
   ```

### Without Docker

1. **Start the Application**:

   ```bash
   npm start
   ```

## Usage

### REST API Endpoints

- **Control Relay State**

  ```http
  POST /api/sensors/:mac_address/relay/:relay_id
  ```

  **Body Parameters**:

  ```json
  {
    "state": "ON" // or "OFF"
  }
  ```

  **Description**: This endpoint allows you to control the relay state (turn it ON or OFF) for a specific SensorPilot device using its MAC address and the relay ID.

### WebSocket and MQTT Integration

- **WebSocket**: Real-time sensor data can be broadcasted to clients connected via WebSocket, allowing for updates on web-based dashboards.
  
- **MQTT**: Sensor data and statuses are published to the MQTT broker specified in the `.env` file.

  - **Sensor Data Topic**: `sensors/sensorpilot/<mac_address>/data`
  - **Sensor Status Topic**: `sensors/sensorpilot/<mac_address>/status`

  **Payload Format**: The messages are JSON-formatted strings containing sensor readings or status updates.

## Final Thoughts

While this project has the foundational elements needed to control and manage FHE Sensor Pilot V1.9 devices, the inherent instability of the connection and the requirement for direct hardware-based configuration of Wi-Fi settings (which cannot be handled in a Docker environment) make it impractical for further development.

If you are still interested in pursuing this idea, you might want to explore alternative methods for managing Wi-Fi configurations outside Docker or find better solutions that offer more reliable connections to the SensorPilot devices.
