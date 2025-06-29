const { SerialPort } = require("serialport");
let serialPort;
const odrive = async ({ stateObj }) => {
  console.log(await SerialPort.list());
  // Create a port
  serialPort = new SerialPort({
    path: "COM4",
    baudRate: 115200,
  });

  let tmpData = "";
  serialPort.on("data", function (data) {
    tmpData += data.toString();
    while (true) {
      const lineLength = tmpData.indexOf("\n");
      if (lineLength === -1) break;
      processLine(tmpData.slice(0, lineLength));
      tmpData = tmpData.slice(lineLength + 1);
    }
  });

  console.log("done.");

  const millis = 0;
  function processLine(line) {
    console.log("<<< " + line);
    const m =
      /^>>(?<axis>[XY]?)(?<delay>\d+) (?<type>\w+)(?: (?<v1>\w+)(?: (?<v2>\w+))?)?/.exec(
        line
      );
    if (!m) return;
    const { axis, delayString, type, v1, v2 } = m.groups,
      delay = parseInt(delayString),
      v1i = parseInt(v1),
      v1f = parseFloat(v1);
    if (axis && isObject(stateObj[axis])) {
      switch (type) {
        case "Axis_stopped_responding":
          stateObj[axis].responding = false;
          break;
        case "Axis_started_responding":
          stateObj[axis].responding = true;
          break;
        case "Axis_error":
          if (v1 && v1.startsWith("0x")) {
            stateObj[axis].error = parseInt(v1, 16);
          }
          break;
        case "Motor_error":
          if (v1 && v1.startsWith("0x")) {
            stateObj[axis].motorError = parseInt(v1, 16);
          }
          break;
        case "Encoder_error":
          if (v1 && v1.startsWith("0x")) {
            stateObj[axis].encoderError = parseInt(v1, 16);
          }
          break;
        case "Sensorless_error":
          if (v1 && v1.startsWith("0x")) {
            stateObj[axis].sensorlessError = parseInt(v1, 16);
          }
          break;
        case "State":
          if (!isNaN(v1i)) stateObj[axis].state = v1i;
          break;
        case "Proc_result":
          if (!isNaN(v1i)) stateObj[axis].procResult = v1i;
          break;
        case "Traj_done_flag":
          if (!isNaN(v1i)) stateObj[axis].trajDone = v1i ? true : false;
          break;
        case "Pos":
          if (!isNaN(v1f)) stateObj[axis].position = v1f;
          break;
        case "Vel":
          if (!isNaN(v1f)) stateObj[axis].velocity = v1f;
          break;
        case "Iq":
          {
            const v2f = parseFloat(v2);
            if (!(isNaN(v1f) || isNaN(v2f))) {
              stateObj[axis].iqMeasured = v1f;
              stateObj[axis].iqSetpoint = v2f;
            }
          }
          break;
        case "Sensorless_estimates":
          {
            const v2f = parseFloat(v2);
            if (!(isNaN(v1f) || isNaN(v2f))) {
              stateObj[axis].sensorlessPositionEstimate = v1f;
              stateObj[axis].sensorlessVelocityEstimates = v2f;
            }
          }
          break;
      }
    } else {
      switch (type) {
        case "Bus_voltage":
          if (!isNaN(v1f)) stateObj.busVoltage = v1f;
          break;
      }
    }

    if (!isNaN(delay)) stateObj.millis = millis += delay;
    stateObj.lastLine = line;
  }
};

function isObject(val) {
  if (val === null) {
    return false;
  }
  return typeof val === "function" || typeof val === "object";
}

const odriveAxisFn = (processor, axis) => ({
    request: {
      state: () => processor(`${axis}-state?`),
      result: () => processor(`${axis}-result?`),
      done: () => processor(`${axis}-done?`),
      error: () => processor(`${axis}-error?`),
      encoder: () => processor(`${axis}-enc?`),
      position: () => processor(`${axis}-pos?`),
      velocity: () => processor(`${axis}-vel?`),
      encError: () => processor(`${axis}-enc-err?`),
      motorError: () => processor(`${axis}-mot-err?`),
      sensorlessError: () => processor(`${axis}-sensorless-err?`),
      sensorlessEstimates: () => processor(`${axis}-sensorless-estimates?`),
      iq: () => processor(`${axis}-iq?`),
    },
    command: {
      state: (state) => processor(`${axis}-setState ${state}`),
      position: (pos, vel, torque) =>
        processor(
          `${axis}-setPos ${pos} ${vel === undefined ? "" : vel} ${
            torque === undefined ? "" : torque
          }`
        ),
      velocity: (vel, torque) =>
        processor(
          `${axis}-setVel ${vel} ${torque === undefined ? "" : torque}`
        ),
      torque: (torque) => processor(`${axis}-setTorque ${torque}`),
      limits: (currentLimit, velLimit) =>
        processor(`${axis}-setLimits current:${currentLimit} vel:${velLimit}`),
      trajVelLimit: (velLimit) =>
        processor(`${axis}-setTrajVelLimit ${velLimit}`),
      trajAccelLimits: (accelLimit, decelLimit) =>
        processor(
          `${axis}-setTrajAccelLimits accel:${accelLimit} decel:${decelLimit}`
        ),
      trajInertia: (trajInertia) =>
        processor(`${axis}-setTrajInertia ${trajInertia}`),
      absolutePosition: (pos) =>
        processor(`${axis}-setAbsolutePosition ${pos}`),
      posGain: (posGain) => processor(`${axis}-setPosGain ${posGain}`),
      velGains: (velGain, velInegratorGains) =>
        processor(
          `${axis}-setVelGains vel:${velGain} integrator:${velInegratorGains}`
        ),
    },
    set state(val) {
      this.command.state(val);
    },
    set position(val) {
      this.command.position(val);
    },
    set velocity(val) {
      this.command.velocity(val);
    },
    set torque(val) {
      this.command.torque(val);
    },
    set trajVelLimit(val) {
      this.command.trajVelLimit(val);
    },
    set trajInertia(val) {
      this.command.trajInertia(val);
    },
    set absolutePosition(val) {
      this.command.absolutePosition(val);
    },
    set posGain(val) {
      this.command.posGain(val);
    },
  }),
  processor = (cmd) => {
    console.log(">>> " + cmd);
    serialPort.write(cmd + "\n");
  };

Object.assign(odrive, {
  odrive,
  x: odriveAxisFn(processor, "x"),
  y: odriveAxisFn(processor, "y"),
  xy: odriveAxisFn(processor, "xy"),
});
module.exports = odrive;
