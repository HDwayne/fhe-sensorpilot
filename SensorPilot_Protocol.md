# Sensor Pilot Communication Protocol Documentation

This document describes the communication protocol used by the Sensor Pilot device. It outlines the message structure, commands, data encoding, and error-checking methods employed in communication between the Sensor Pilot and external systems.

> **Note**: This document is based on my observations and analysis of the application available on the Raspberry Pi. It should not be considered official documentation. It serves as a reference for my understanding of the protocol. This document is incomplete and may contain inaccuracies.

## Protocol Overview

The Sensor Pilot communicates over TCP using a custom binary protocol. Messages are structured with specific fields and encoded in hexadecimal format. Each message consists of a header and optional data, with fields for synchronization, length, command identification, data, and error checking.

---

## Message Structure

Each message sent to or received from the Sensor Pilot follows a specific structure:

```
+-----------+-----------+----------+----------+----------+--------+----------+
|   STX     |  Length   |  Order   | Command  |   Data   |  CRC   |   ETX    |
+-----------+-----------+----------+----------+----------+--------+----------+
| 1 byte    | 2 bytes   | 1 byte   | 2 bytes  | N bytes  | 2 bytes| 1 byte   |
+-----------+-----------+----------+----------+----------+--------+----------+
```

1. Start of Text (STX)

    - **Size**: 1 byte
    - **Value**: `0x02`

    Indicates the beginning of a message.

2. Length Field

    - **Size**: 2 bytes
    - **Description**: Represents the total length of the message, including the STX, Length, Order, Command, Data, CRC, and ETX fields.
    - **Encoding**: Encoded as a masked hexadecimal string.

3. Order Field

    - **Size**: 1 byte
    - **Description**: Specifies the type of operation to perform (e.g., read, write, periodic).
    - **Encoding**: Encoded as a hexadecimal value.

4. Command Field

    - **Size**: 2 bytes
    - **Description**: Specifies the specific command under the given order.
    - **Encoding**: Encoded as a masked hexadecimal string.

5. Data Field

    - **Size**: Variable (N bytes)
    - **Description**: Contains the payload data for the command.
    - **Encoding**: Encoded  as a masked hexadecimal string.

6. Checksum (CRC)

    - **Size**: 2 bytes
    - **Description**: A CRC-16 checksum calculated over the message.
    - **Encoding**: Encoded as a masked hexadecimal string.

7. End of Text (ETX)
    - **Size**: 1 byte
    - **Value**: `0x03`

---

## Orders and Commands

### Order Types

1. **Read**
   - **Value**: `0x34`
   - **Description**: Used to read data from the device.

2. **Write**
   - **Value**: `0x39`
   - **Description**: Used to write data or settings to the device.

3. **Period**
   - **Value**: `0x32`
   - **Description**: Used for periodic operations.

### Command Codes


1. Commands under Read Order (`0x34`):

- **oneWire**
  - **Code**: `0x3031`
  - **Description**: Read temperature from one-wire sensors.

- **relaisState**
  - **Code**: `0x3032`
  - **Description**: Read the state of relays.

- **analog**
  - **Code**: `0x3033`
  - **Description**: Read analog inputs.

- **wifi**
  - **Code**: `0x3036`
  - **Description**: Read Wi-Fi configuration.

- **version**
  - **Code**: `0x3037`
  - **Description**: Read firmware version.

- **configuration**
  - **Code**: `0x3038`
  - **Description**: Read device configuration.

- **consigneOneWire**
  - **Code**: `0x3039`
  - **Description**: Read one-wire sensor settings.

- **dateHeure**
  - **Code**: `0x303A`
  - **Description**: Read date and time settings.

- **ampDataInstant**
  - **Code**: `0x3130`
  - **Description**: Read instantaneous current data.

- **ampDataCumul**
  - **Code**: `0x3131`
  - **Description**: Read cumulative current data.

- **relais16DataInstant**
  - **Code**: `0x3230`
  - **Description**: Read instantaneous data for 16 relays.

- **relais16DataCumul**
  - **Code**: `0x3231`
  - **Description**: Read cumulative data for 16 relays.

- **relais32DataInstant**
  - **Code**: `0x3330`
  - **Description**: Read instantaneous data for 32 relays.

- **relais32DataCumul**
  - **Code**: `0x3331`
  - **Description**: Read cumulative data for 32 relays.

- **tic**
  - **Code**: `0x3430`
  - **Description**: Read TIC (Télé-Information Client) data.

2. Commands under Write Order (`0x39`):

- **relaisState**
  - **Code**: `0x3032`
  - **Description**: Set the state of relays.

- **resetWifi**
  - **Code**: `0x3034`
  - **Description**: Reset Wi-Fi settings.

- **majSensor**
  - **Code**: `0x3035`
  - **Description**: Update sensor firmware.

- **configuration**
  - **Code**: `0x3038`
  - **Description**: Write device configuration.

- **consigneOneWire**
  - **Code**: `0x3039`
  - **Description**: Set one-wire sensor settings.

- **dateHeure**
  - **Code**: `0x303A`
  - **Description**: Set date and time settings.

- **ampDataInstant**
  - **Code**: `0x3130`
  - **Description**: ?

- **ampDataCumul**
  - **Code**: `0x3131`
  - **Description**: ?

- **relais16DataInstant**
  - **Code**: `0x3230`
  - **Description**: ?

- **relais16DataCumul**
  - **Code**: `0x3231`
  - **Description**: ?

- **relais32DataInstant**
  - **Code**: `0x3330`
  - **Description**: ?

- **relais32DataCumul**
  - **Code**: `0x3331`
  - **Description**: ?

3. Commands under Period Order (`0x32`):

- **none**
  - **Code**: `0x3030` (ASCII `'00'`)
  - **Description**: No specific command; used for periodic operations.

---

## Data Encoding and Decoding

Data in messages is encoded using a specific method to ensure correct transmission and to avoid issues with control characters.

### Hexadecimal Encoding

- Data values are converted to their hexadecimal representation.

### Character Masking

To prevent control characters (like `STX`, `ETX`, etc.) from appearing in the data, each hexadecimal character is masked.

- **Masking Method**:
  - Each hexadecimal character is prefixed with `0x3`.
  - For example:
    - Original hex string: `34`
    - Masked hex string: `0x33 0x34`

### Data Decoding Examples

When receiving data, the process is reversed:

1. Remove the masking character (`0x33`) from each pair.
2. Concatenate the remaining characters to form the original hex string.
3. Convert the hex string back to its original form (ASCII or numeric value).

---

## Checksum Calculation

The checksum (CRC) is used to detect errors in the message transmission.

- **Algorithm**: CRC-16/XMODEM

### Steps:

1. Calculate the CRC over the entire message, excluding the `STX` and `ETX` bytes.
2. Include the masked length, order, command, and data fields in the calculation.
3. The CRC value is then masked using the same character masking method before being placed in the message.

---

## Communication Flow

### Establishing a Connection

- Open a TCP socket to the Sensor Pilot's IP address and port.
- Ensure the connection is stable before sending commands.

### Sending Commands

1. **Construct the Message**:
   - Start with the `STX` byte.
   - Calculate the total length and encode it.
   - Specify the order and command codes.
   - Include any necessary data, properly encoded.
   - Calculate and include the CRC.
   - End with the `ETX` byte.

2. **Send the Message**:
   - Write the complete message buffer to the TCP socket.

### Receiving Responses

1. **Read Data**:
   - Listen for incoming data on the TCP socket.
   - Read the data into a buffer.

2. **Parse the Message**:
   - Check for `STX` and `ETX` bytes to determine message boundaries.
   - Extract and decode the length, order, command, data, and CRC fields.
   - Verify the CRC.

3. **Process the Data**:
   - Depending on the command, interpret the data accordingly.
   - Use the decoding methods to retrieve the original values.

---

# Appendices

## A. Full Command List

### Read Order (`0x34`)

| Command               | Code (Hex) | Description                                    |
|-----------------------|------------|------------------------------------------------|
| `oneWire`             | `0x3031`   | Read temperature from one-wire sensors         |
| `relaisState`         | `0x3032`   | Read the state of relays                       |
| `analog`              | `0x3033`   | Read analog inputs                             |
| `wifi`                | `0x3036`   | Read Wi-Fi configuration                       |
| `version`             | `0x3037`   | Read firmware version                          |
| `configuration`       | `0x3038`   | Read device configuration                      |
| `consigneOneWire`     | `0x3039`   | Read one-wire sensor settings                  |
| `dateHeure`           | `0x303A`   | Read date and time settings                    |
| `ampDataInstant`      | `0x3130`   | Read instantaneous current data                |
| `ampDataCumul`        | `0x3131`   | Read cumulative current data                   |
| `relais16DataInstant` | `0x3230`   | Read instantaneous data for 16 relays          |
| `relais16DataCumul`   | `0x3231`   | Read cumulative data for 16 relays             |
| `relais32DataInstant` | `0x3330`   | Read instantaneous data for 32 relays          |
| `relais32DataCumul`   | `0x3331`   | Read cumulative data for 32 relays             |
| `tic`                 | `0x3430`   | Read TIC data                                  |

### Write Order (`0x39`)

| Command               | Code (Hex) | Description                                   |
|-----------------------|------------|-----------------------------------------------|
| `relaisState`         | `0x3032`   | Set the state of relays                       |
| `resetWifi`           | `0x3034`   | Reset Wi-Fi settings                          |
| `majSensor`           | `0x3035`   | Update sensor firmware                        |
| `configuration`       | `0x3038`   | Write device configuration                    |
| `consigneOneWire`     | `0x3039`   | Set one-wire sensor settings                  |
| `dateHeure`           | `0x303A`   | Set date and time settings                    |
| `ampDataInstant`      | `0x3130`   | Write instantaneous current data              |
| `ampDataCumul`        | `0x3131`   | Write cumulative current data                 |
| `relais16DataInstant` | `0x3230`   | Write instantaneous data for 16 relays        |
| `relais16DataCumul`   | `0x3231`   | Write cumulative data for 16 relays           |
| `relais32DataInstant` | `0x3330`   | Write instantaneous data for 32 relays        |
| `relais32DataCumul`   | `0x3331`   | Write cumulative data for 32 relays           |

### Period Order (`0x32`)

| Command | Code (Hex) | Description                       |
|---------|------------|-----------------------------------|
| `none`  | `0x3030`   | No specific command; periodic ops |
