const { SerialPort } = require("serialport");
let i = 0;
const odrive = {
  async start({
    stateObj = { x: {}, y: {}, xb: {}, yb: {}, l: {} },
    stateObjChangeCallback = () => {},
    serialPort,
  } = {}) {
    this.stateObj = stateObj;
    this.stateObjVersion = Object.fromEntries(
      [...Object.keys(stateObj)].map((k) => [k, {}])
    );
    this.stateObjChangeCallback = stateObjChangeCallback;
    //console.log(await SerialPort.list());
    // Create a port
    if (!serialPort)
      serialPort = new SerialPort({
        path: "COM8",
        baudRate: 115200,
      });
    this.serialPort = serialPort;

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
  },
};

const axisTransform = {
    x: {
      minOdrivePos: 5,
      maxOdrivePos: 335,
      mmPerOdrivePos: 5 / 4,
      originOdrivePos: 170,
    },
    y: {
      minOdrivePos: 5,
      maxOdrivePos: 335,
      mmPerOdrivePos: 5 / 4,
      originOdrivePos: 170,
    },
    xb: {
      minOdrivePos: 5,
      maxOdrivePos: 335,
      mmPerOdrivePos: 5 / 4,
      originOdrivePos: 170,
    },
    yb: {
      minOdrivePos: 5,
      maxOdrivePos: 335,
      mmPerOdrivePos: 5 / 4,
      originOdrivePos: 170,
    },
  },
  mmToOdrivePos = (axis, mm) =>
    mm / (axisTransform[axis]?.mmPerOdrivePos || 1) +
    (axisTransform[axis]?.originOdrivePos ?? 0),
  odrivePosToMm = (axis, pos) =>
    (pos - (axisTransform[axis]?.originOdrivePos ?? 0)) *
    (axisTransform[axis]?.mmPerOdrivePos || 1),
  mmPerSecToOdriveVel = (axis, mmPerSec) =>
    mmPerSec / (axisTransform[axis]?.mmPerOdrivePos || 1),
  odriveVelToMmPerSec = (axis, vel) =>
    vel * (axisTransform[axis]?.mmPerOdrivePos || 1);
axisTransform.x.minMm = odrivePosToMm(
  axisTransform.mmPerOdrivePos > 0
    ? axisTransform.x.minOdrivePos
    : axisTransform.x.maxOdrivePos
);
axisTransform.x.maxMm = odrivePosToMm(
  axisTransform.mmPerOdrivePos > 0
    ? axisTransform.x.maxOdrivePos
    : axisTransform.x.minOdrivePos
);
axisTransform.y.minMm = odrivePosToMm(
  axisTransform.mmPerOdrivePos > 0
    ? axisTransform.y.minOdrivePos
    : axisTransform.y.maxOdrivePos
);
axisTransform.y.maxMm = odrivePosToMm(
  axisTransform.mmPerOdrivePos > 0
    ? axisTransform.y.maxOdrivePos
    : axisTransform.y.minOdrivePos
);

let _stateChangePromise = null,
  _stateChangePromiseResolver = null;
const resolveStateChangePromise = () => {
    if (_stateChangePromise) {
      _stateChangePromise = null;
      const r = _stateChangePromiseResolver;
      _stateChangePromiseResolver = null;
      r?.();
    }
  },
  stateChangePromise = () =>
    _stateChangePromise ??
    (_stateChangePromise = new Promise((r) => {
      _stateChangePromiseResolver = r;
    })),
  commitStateChange = (changes) => {
    const { stateObj, stateObjVersion } = odrive;
    [...Object.entries(changes)].forEach(([axis, axisChanges]) => {
      [...Object.entries(axisChanges)].forEach(([k, v]) => {
        stateObjVersion[axis][k] = (stateObjVersion[axis][k] || 0) + 1;
        // console.log({
        //   [axis]: { [k]: `Version -> ${stateObjVersion[axis][k]}` },
        // });
        if (stateObj[axis][k] === v) return;
        stateObj[axis][k] = v;
        switch (axis) {
          case "x":
          case "y":
          case "xb":
          case "yb":
            switch (k) {
              case "state":
              case "position":
              case "velocity":
              case "error":
              case "trajDone":
              case "procResult":
                stateObj[axis].hasInfo =
                  [
                    "state",
                    "position",
                    "velocity",
                    "error",
                    "trajDone",
                    "procResult",
                  ].find((k) => stateObj[axis][k] !== undefined) === undefined;
            }
        }
      });
    });

    resolveStateChangePromise();
  };
let millis = 0;
function processLine(line) {
  const { stateObj, stateObjChangeCallback } = odrive;

  console.log("<<< " + line);
  const m =
    /^>>(?<axisString>[XYL]?b?)(?<delayString>\d+) (?<type>\w+)(?: (?<v1>[\w.-]+)(?: (?<v2>[\w.-]+))?)?/.exec(
      line
    );
  if (!m) return;
  const { axisString, delayString, type, v1, v2 } = m.groups,
    axis = axisString.toLowerCase(),
    delay = parseInt(delayString),
    v1i = parseInt(v1),
    v1f = parseFloat(v1);
  //console.log({ axis, delayString, type, v1, v2, delay, v1i, v1f });
  if (axis && isObject(stateObj[axis])) {
    switch (type) {
      case "Axis_stopped_responding":
        commitStateChange({ [axis]: { responding: false } });
        stateObjChangeCallback(stateObj, axis, "responding");
        break;
      case "Axis_started_responding":
        commitStateChange({ [axis]: { responding: true } });
        stateObjChangeCallback(stateObj, axis, "responding");
        break;
      case "Axis_error":
        if (v1 && v1.startsWith("0x")) {
          commitStateChange({ [axis]: { error: parseInt(v1, 16) } });
          stateObjChangeCallback(stateObj, axis, "error");
        }
        break;
      case "Motor_error":
        if (v1 && v1.startsWith("0x")) {
          commitStateChange({ [axis]: { motorError: parseInt(v1, 16) } });
          stateObjChangeCallback(stateObj, axis, "motorError");
        }
        break;
      case "Encoder_error":
        if (v1 && v1.startsWith("0x")) {
          commitStateChange({ [axis]: { encoderError: parseInt(v1, 16) } });
          stateObjChangeCallback(stateObj, axis, "encoderError");
        }
        break;
      case "Sensorless_error":
        if (v1 && v1.startsWith("0x")) {
          commitStateChange({ [axis]: { sensorlessError: parseInt(v1, 16) } });
          stateObjChangeCallback(stateObj, axis, "sensorlessError");
        }
        break;
      case "State":
        if (!isNaN(v1i)) {
          commitStateChange({ [axis]: { state: v1i } });
          stateObjChangeCallback(stateObj, axis, "state");
        }
        break;
      case "Proc_result":
        if (!isNaN(v1i)) {
          commitStateChange({ [axis]: { procResult: v1i } });
          stateObjChangeCallback(stateObj, axis, "procResult");
        }
        break;
      case "Traj_done_flag":
        if (!isNaN(v1i)) {
          commitStateChange({ [axis]: { trajDone: v1i ? true : false } });
          stateObjChangeCallback(stateObj, axis, "trajDone");
        }
        break;
      case "Pos":
        if (!isNaN(v1f)) {
          commitStateChange({ [axis]: { position: odrivePosToMm(axis, v1f) } });
          stateObjChangeCallback(stateObj, axis, "position");
        }
        break;
      case "Vel":
        if (!isNaN(v1f)) {
          commitStateChange({
            [axis]: { velocity: odriveVelToMmPerSec(axis, v1f) },
          });
          stateObjChangeCallback(stateObj, axis, "velocity");
        }
        break;
      case "Iq":
        {
          const v2f = parseFloat(v2);
          if (!(isNaN(v1f) || isNaN(v2f))) {
            commitStateChange({ [axis]: { iqMeasured: v1f, iqSetpoint: v2f } });
            stateObjChangeCallback(stateObj, axis, "iqMeasured");
            stateObjChangeCallback(stateObj, axis, "iqSetpoint");
          }
        }
        break;
      case "Sensorless_estimates":
        {
          const v2f = parseFloat(v2);
          if (!(isNaN(v1f) || isNaN(v2f))) {
            commitStateChange({
              [axis]: {
                sensorlessPositionEstimate: v1f,
                sensorlessVelocityEstimates: v2f,
              },
            });
            stateObjChangeCallback(
              stateObj,
              axis,
              "sensorlessPositionEstimate"
            );
            stateObjChangeCallback(
              stateObj,
              axis,
              "sensorlessVelocityEstimates"
            );
          }
        }
        break;
    }
  } else {
    switch (type) {
      case "Bus_voltage":
        if (!isNaN(v1f)) {
          commitStateChange({ busVoltage: v1f });
          stateObjChangeCallback(stateObj, "busVoltage");
        }
        break;
    }
  }
  //console.log(stateObj);

  if (!isNaN(delay)) stateObj.millis = millis += delay;
  stateObj.lastLine = line;
}

function isObject(val) {
  if (val === null) {
    return false;
  }
  return typeof val === "function" || typeof val === "object";
}

const odriveAxisFn = (processor, axis) => ({
    request: {
      info: async () => {
        const {
          state: stateVersion = 0,
          procResult: procResultVersion = 0,
          trajDone: trajDoneVersion = 0,
          error: errorVersion = 0,
          position: positionVersion = 0,
          velocity: velocityVersion = 0,
        } = odrive.stateObjVersion[axis];
        processor(`${axis}-??`);
        await waitForState({
          [axis]: {
            state: ({ version }) => version > stateVersion,
            procResult: ({ version }) => version > procResultVersion,
            trajDone: ({ version }) => version > trajDoneVersion,
            error: ({ version }) => version > errorVersion,
            position: ({ version }) => version > positionVersion,
            velocity: ({ version }) => version > velocityVersion,
          },
        });
        return odrive.stateObj[axis];
      },
      state: async () => {
        const { state: versionWas = 0 } = odrive.stateObjVersion[axis];
        processor(`${axis}-state?`);
        await waitForState({
          [axis]: {
            state: ({ version }) => version > versionWas,
          },
        });
        return odrive.stateObj[axis].state;
      },

      procResult: async () => {
        const { procResult: versionWas = 0 } = odrive.stateObjVersion[axis];
        processor(`${axis}-result?`);
        await waitForState({
          [axis]: {
            procResult: ({ version }) => version > versionWas,
          },
        });
        return odrive.stateObj[axis].procResult;
      },

      trajDone: async () => {
        const { trajDone: versionWas = 0 } = odrive.stateObjVersion[axis];
        processor(`${axis}-done?`);
        await waitForState({
          [axis]: {
            trajDone: ({ version }) => version > versionWas,
          },
        });
        return odrive.stateObj[axis].trajDone;
      },

      error: async () => {
        const { error: versionWas = 0 } = odrive.stateObjVersion[axis];
        processor(`${axis}-error?`);
        await waitForState({
          [axis]: {
            error: ({ version }) => version > versionWas,
          },
        });
        return odrive.stateObj[axis].error;
      },

      encoder: async () => {
        const {
          position: positionVersionWas = 0,
          velocity: velocityVersionWas = 0,
        } = odrive.stateObjVersion[axis];
        processor(`${axis}-enc?`);
        await waitForState({
          [axis]: {
            position: ({ version }) => version > positionVersionWas,
            velocity: ({ version }) => version > velocityVersionWas,
          },
        });
        return {
          position: odrive.stateObj[axis].position,
          velocity: odrive.stateObj[axis].velocity,
        };
      },

      position: async () => {
        const { position: versionWas = 0 } = odrive.stateObjVersion[axis];
        processor(`${axis}-pos?`);
        await waitForState({
          [axis]: {
            position: ({ version }) => version > versionWas,
          },
        });
        return odrive.stateObj[axis].position;
      },

      velocity: async () => {
        const { velocity: versionWas = 0 } = odrive.stateObjVersion[axis];
        processor(`${axis}-vel?`);
        await waitForState({
          [axis]: {
            velocity: ({ version }) => version > versionWas,
          },
        });
        return odrive.stateObj[axis].velocity;
      },

      encError: async () => {
        const { encError: versionWas = 0 } = odrive.stateObjVersion[axis];
        processor(`${axis}-enc-err?`);
        await waitForState({
          [axis]: {
            encError: ({ version }) => version > versionWas,
          },
        });
        return odrive.stateObj[axis].encError;
      },

      motorError: async () => {
        const { motorError: versionWas = 0 } = odrive.stateObjVersion[axis];
        processor(`${axis}-mot-err?`);
        await waitForState({
          [axis]: {
            motorError: ({ version }) => version > versionWas,
          },
        });
        return odrive.stateObj[axis].motorError;
      },

      sensorlessError: async () => {
        const { sensorlessError: versionWas = 0 } =
          odrive.stateObjVersion[axis];
        processor(`${axis}-sensorless-err?`);
        await waitForState({
          [axis]: {
            sensorlessError: ({ version }) => version > versionWas,
          },
        });
        return odrive.stateObj[axis].sensorlessError;
      },

      sensorlessEstimates: async () =>
        processor(`${axis}-sensorless-estimates?`),
      iq: async () => processor(`${axis}-iq?`),
    },

    command: {
      ensureInfo: async () => {
        if (odrive.stateObj[axis].hasInfo) return;
        await odrive.axes[axis].request.info();
      },
      homed: async () => {
        if (odrive.stateObj[axis].homed) return;
        await odrive.axes[axis].command.home();
      },
      homed: async () => {
        if (odrive.stateObj[axis].homed) return;
        await odrive.axes[axis].command.home();
      },
      home: async () => odrive.axes[axis].command.state(11),
      state: async (state) => {
        if (axis == "xb" || axis == "yb")
          throw "I'd rather not set the state of the follower motor directly, since it might break the machine. Please control on the leader motor only";

        if (axis != "x" && axis != "y") {
          await processor(`${axis}-setState ${state}`);
          await waitForState({
            [axis]: {
              state,
            },
          });
          return;
        }

        const axisb = axis + "b";
        if (odrive.stateObj[axisb].error)
          throw "Please clear the follower axis error before requesting a new state";
        if (odrive.stateObj[axis].error)
          throw "Please clear the axis error before requesting a new state";

        const targetState = state === 8 ? state : 1,
          { state: axisVersionWas = 0 } = odrive.stateObjVersion[axis],
          { state: axisbVersionWas = 0 } = odrive.stateObjVersion[axisb];

        let aPromise, aaPromise, bPromise, bbPromise;
        const axisPromise =
            odrive.stateObj[axis].state === state
              ? Promise.resolve()
              : (aaPromise = processor(`${axis}-setState ${state}`)).then(
                  () =>
                    (aPromise = waitForState({
                      [axis]: {
                        state: ({ value, version }) =>
                          value === targetState && version > axisVersionWas,
                      },
                    }))
                ),
          axisbPromise =
            odrive.stateObj[axisb].state === state
              ? Promise.resolve()
              : (bbPromise = processor(`${axisb}-setState ${state}`)).then(
                  () =>
                    (bPromise = waitForState({
                      [axisb]: {
                        state: ({ value, version }) =>
                          value === targetState && version > axisbVersionWas,
                      },
                    }))
                );
        // try {
        //   await axisbPromise;
        //   await axisPromise;
        // } catch (err) {
        //   console.error(err);
        //   throw "hi";
        // }
        // await waitForState({
        //   [axis]: {
        //     state: ({ value, version }) => (
        //       console.log(
        //         { a: { value, version } },
        //         value === targetState && version > axisVersionWas
        //       ),
        //       value === targetState && version > axisVersionWas
        //     ),
        //   },
        // });
        await (state === 8
          ? axisbPromise.then(() => axisPromise)
          : Promise.all([axisPromise, axisbPromise]));
        if (state === 11) commitStateChange({ [axis]: { homed: true } });
        if (state === 3) commitStateChange({ [axis]: { homed: false } });
      },
      position: async (pos, vel, torque) => {
        if (/^[a-z]b$/.test(axis))
          throw "Can't set position of follower axis, please drive via the leader axis";
        let posToSend = pos,
          velToSend = vel;
        if (axisTransform[axis]) {
          const { minMm, maxMm } = axisTransform[axis];
          if (minMm > pos) {
            console.error(
              `Clipping request to move ${axis} to ${pos} to nearest in bounds (${minMm})`
            );
            pos = minMm;
          }
          if (maxMm < pos) {
            console.error(
              `Clipping request to move ${axis} to ${pos} to nearest in bounds (${maxMm})`
            );
            pos = maxMm;
          }
          posToSend = mmToOdrivePos(axis, pos);
          if (vel) velToSend = mmPerSecToOdriveVel(axis, vel);
        }
        await ensureState({ [axis]: { homed: true } });
        await ensureState({ [axis]: { state: 8 } }, 10000);
        await processor(
          `${axis}-setPos ${posToSend} ${
            velToSend === undefined ? "" : "vel:" + velToSend
          } ${torque === undefined ? "" : "torque:" + torque}`
        );
      },
      velocity: async (vel, torque) => {
        if (/^[a-z]b$/.test(axis))
          throw "Can't set velcity of follower axis, please drive via the leader axis";
        let velToSend = vel;
        if (axisTransform[axis] && vel)
          velToSend = mmPerSecToOdriveVel(axis, vel);
        await ensureState({ [axis]: { state: 8 } }, 10000);
        await processor(
          `${axis}-setVel ${velToSend} ${
            torque === undefined ? "" : "torque:" + torque
          }`
        );
      },
      torque: async (torque) => {
        if (/^[a-z]b$/.test(axis))
          throw "Can't set torque of follower axis, please drive via the leader axis";
        await ensureState({ [axis]: { state: 8 } }, 10000);
        await processor(`${axis}-setTorque ${torque}`);
      },
      limits: async (currentLimit, velLimit) =>
        processor(`${axis}-setLimits current:${currentLimit} vel:${velLimit}`),
      trajVelLimit: async (velLimit) =>
        processor(`${axis}-setTrajVelLimit ${velLimit}`),
      trajAccelLimits: async (accelLimit, decelLimit) =>
        processor(
          `${axis}-setTrajAccelLimits accel:${accelLimit} decel:${decelLimit}`
        ),
      trajInertia: async (trajInertia) =>
        processor(`${axis}-setTrajInertia ${trajInertia}`),
      linearCount: async (count) =>
        processor(`${axis}-setLinearCount ${count}`),
      posGain: async (posGain) => processor(`${axis}-setPosGain ${posGain}`),
      velGains: async (velGain, velInegratorGains) =>
        processor(
          `${axis}-setVelGains vel:${velGain} integrator:${velInegratorGains}`
        ),
      estop: async () => processor(`${axis}-stop`),
      clearErrors: async () => {
        await processor(`${axis}-clearErrors`);
        await waitForState({
          [axis]: {
            error: ({ value }) => !value,
            motorError: ({ value }) => !value,
            encError: ({ value }) => !value,
          },
        });
      },
    },
    set homedFlag_force(val) {
      commitStateChange({ [axis]: { homed: !!val } });
    },
    set state(val) {
      odrive.axes[axis].command.state(val);
    },
    set position(val) {
      odrive.axes[axis].command.position(val);
    },
    set velocity(val) {
      odrive.axes[axis].command.velocity(val);
    },
    set torque(val) {
      odrive.axes[axis].command.torque(val);
    },
    set trajVelLimit(val) {
      odrive.axes[axis].command.trajVelLimit(val);
    },
    set trajInertia(val) {
      odrive.axes[axis].command.trajInertia(val);
    },
    set linearCount(count) {
      if (/^[a-z]b$/.test(axis))
        throw "Can't set linear count of follower axis, please drive via the leader axis";
      throw "Please don't set the linear count. It's untested and might break things";
      odrive.axes[axis].command.linearCount(count);
    },
    set posGain(val) {
      odrive.axes[axis].command.posGain(val);
    },
  }),
  processor = async (cmd) => {
    console.log(">>> " + cmd);
    await new Promise((r) => odrive.serialPort.write(cmd + "\n", r));
  };

Object.assign(odrive, {
  odrive,
  x: odriveAxisFn(processor, "x"),
  y: odriveAxisFn(processor, "y"),
  xb: odriveAxisFn(processor, "xb"),
  yb: odriveAxisFn(processor, "yb"),
  l: odriveAxisFn(processor, "l"),
});
odrive.axes = Object.fromEntries(
  ["x", "y", "xb", "yb", "l"].map((k) => [k, odrive[k]])
);
module.exports = odrive;

function checkForState(state, alsoPrepareActionPromise) {
  const { stateObj, stateObjVersion } = odrive;
  const promises = [];
  let ready = true;
  [...Object.entries(state)].forEach(([axis, axisState]) => {
    [...Object.entries(axisState)].forEach(([key, val]) => {
      if (typeof val == "function") {
        if (
          val({
            axis,
            key,
            value: stateObj[axis][key],
            version: stateObjVersion[axis][key],
          })
        )
          return;
      } else if (stateObj[axis][key] === val) return;
      if (alsoPrepareActionPromise) {
        promises.push(odrive.axes[axis]?.command[key]?.(val));
      }
      ready = false;
    });
  });
  return {
    ready,
    ...(alsoPrepareActionPromise && promises.length
      ? { actionPromise: Promise.all(promises) }
      : {}),
  };
}
async function ensureState(state, retryPeriod = null) {
  await waitForState(state, true, retryPeriod);
}
async function waitForState(
  state,
  makeItSo = false,
  retryPeriod = null,
  otimeout = []
) {
  //  console.log({ waitForState: { state: JSON.stringify(state), makeItSo } });
  const { ready, actionPromise } = checkForState(state, makeItSo);

  if ((ready || actionPromise) && otimeout[0]) {
    clearTimeout(otimeout[0].timeout);
    otimeout.pop();
  }

  if (ready) {
    //    console.log({ waitedForState: { state: JSON.stringify(state), makeItSo } });
    return;
  }

  if (actionPromise) {
    await actionPromise;
    if (checkForState(state).ready) {
      return;
    }
    if (retryPeriod > 100) {
      otimeout[0] = {};
      otimeout[0].promise = new Promise(
        (r) =>
          (otimeout[0].timeout = setTimeout(() => {
            otimeout.pop();
            r("timeout");
          }, retryPeriod))
      );
    }
  }
  const which = await Promise.any(
    [stateChangePromise(), otimeout[0]?.promise].filter((v) => v)
  );
  await waitForState(state, which === "timeout", retryPeriod, otimeout);
}
