const { odrives, ods: odPromises } = require("./odrive"),
  fetch = require("node-fetch"),
  MAX_POS = 126;

const readyPromise = () => Promise.all(odrives.map((o) => o.readyPromise));

let replContext = globalThis,
  {
    mmFromTurn,
    turnFromMM,
    robotFromDesk,
    deskFromRobot,
    aTransform,
    bTransform,
    aLen,
    bLen,
    wallY,
    bu,
    au,
    runnerPivot,
    sqdist,
    dist,
    lerpPt,
    normalizedLerpPt,
    unlerpPt,
    normalizedUnlerpPt,
    thirdPointOnTri,
  } = require("./pos.js");

let robot = {};

let ods,
  od0,
  od1,
  ax0,
  ax1,
  ax2,
  ax3,
  oc0,
  oc1,
  mc0,
  cc0,
  ec0,
  tc0,
  mc1,
  cc1,
  ec1,
  tc1,
  mc2,
  cc2,
  ec2,
  tc2,
  mc3,
  cc3,
  ec3,
  tc3;
let idleTimers = {};
const getAxis = (axisi) => ods[axisi >> 1][`axis${axisi & 1}`],
  unmaskError = (abits, prefix) => {
    if (typeof abits != "number" && typeof abits != "bigint") return "?";
    const vs = Object.fromEntries(
        Object.entries(odrives[0])
          .filter(([k, v]) => k.startsWith(prefix))
          .map(([k, v]) => [v, k])
      ),
      ret = [];

    bits = BigInt(abits);
    for (let b = 1n; bits && b < 1n << 64n; b <<= 1n) {
      if (b & bits) {
        ret.push(vs[b.toString()] ?? `<${b}>`);
        bits &= ~b;
      }
    }

    return `${abits}(${ret.join("|")})`;
  },
  err = async () => {
    const res = () => ({
      c0: unmaskError(ax0.controller.error, "CONTROLLER_ERROR_"),
      c0_at: ax0.controller.last_error_time,
      e0: unmaskError(ax0.encoder.error, "ENCODER_ERROR_"),
      e0_spiRate: ax0.encoder.spi_error_rate,
      ax0: unmaskError(ax0.error, "AXIS_ERROR_"),
      m0: unmaskError(ax0.motor.error, "MOTOR_ERROR_"),
      m0_at: ax0.motor.last_error_time,
      se0: unmaskError(
        ax0.sensorless_estimator.error,
        "SENSORLESS_ESTIMATOR_ERROR_"
      ),
      can: unmaskError(od0.can.error, "CAN_ERROR_"),
      sys: unmaskError(od0.error, "ERROR_"),
      ic2_cnt: od0.system_stats.i2c.error_cnt,
    });
    res();
    await readyPromise();
    const r = await res();
    console.log(
      JSON.stringify(r, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2)
    );
    return r;
  },
  idle = async () => {
    ax0.requested_state = odrive.AXIS_STATE_IDLE;
    ax1.requested_state = odrive.AXIS_STATE_IDLE;
    await readyPromise();
  },
  home = async (axisi = undefined) => {
    if (axisi == 0 || axisi === undefined) {
      await ax0.requested_state__set(odrive.AXIS_STATE_CLOSED_LOOP_CONTROL);
      ax0.requested_state = odrive.AXIS_STATE_HOMING;
    }
    if (axisi == 1 || axisi === undefined) {
      await ax1.requested_state__set(odrive.AXIS_STATE_CLOSED_LOOP_CONTROL);
      ax1.requested_state = odrive.AXIS_STATE_HOMING;
    }
    await readyPromise();
  },
  go = async (axs, pos, timeout = 2000) => {
    pos = Math.max(0, Math.min(MAX_POS, pos));
    for (const ax of axs) {
      ax.requested_state = odrive.AXIS_STATE_CLOSED_LOOP_CONTROL;
      ax.controller.input_pos = pos;
    }
    await readyPromise();
    for (const ax of axs) {
      idleTimers[ax.id] &&
        (clearTimeout(idleTimers[ax.id]), (idleTimers[ax.id] = null));
      timeout &&
        (idleTimers[ax.id] = setTimeout(async () => {
          idleTimers[ax.id] = null;
          ax.requested_state = odrive.AXIS_STATE_IDLE;
          await readyPromise();
        }, timeout));
    }
  },
  routerLiftCmd = (cmd) =>
    fetch(`http://routerlift/setcmd?v=${encodeURIComponent(cmd)}`),
  go0 = (pos) => go([ax0], pos),
  go1 = (pos) => go([ax1], pos),
  go2 = (pos) => go([ax2], pos),
  go3 = (pos) => go([ax3], pos),
  gob = (pos) => go([ax0, ax1], pos),
  goz = (pos) => routerLiftCmd(`um=${Math.floor(pos * 1000)}`),
  gouv = (u, v) => {
    const pos = robotFromDesk(u, v),
      {
        a: { turn: aturn },
        b: { turn: bturn },
      } = pos;
    go0(aturn);
    go1(bturn);
    robot = { u, v };
    return pos;
  };

(async () => {
  await readyPromise();
  ods = await Promise.all(odPromises);
  [od0, od1] = ods;
  console.log(od0.config);
  ax0 = getAxis(0);
  ax0.id = 0;
  ax1 = getAxis(1);
  ax1.id = 1;
  ax2 = getAxis(2);
  ax2.id = 2;
  ax3 = getAxis(3);
  ax3.id = 3;
  oc0 = od0.config;
  oc1 = od1.config;
  mc0 = ax0.motor.config;
  cc0 = ax0.controller.config;
  ec0 = ax0.encoder.config;
  tc0 = ax0.trap_traj.config;
  mc1 = ax1.motor.config;
  cc1 = ax1.controller.config;
  ec1 = ax1.encoder.config;
  tc1 = ax1.trap_traj.config;
  mc2 = ax2.motor.config;
  cc2 = ax2.controller.config;
  ec2 = ax2.encoder.config;
  tc2 = ax2.trap_traj.config;
  mc3 = ax3.motor.config;
  cc3 = ax3.controller.config;
  ec3 = ax3.encoder.config;
  tc3 = ax3.trap_traj.config;

  Object.assign(replContext, {
    mmFromTurn,
    turnFromMM,
    robotFromDesk,
    deskFromRobot,
    aTransform,
    bTransform,
    aLen,
    bLen,
    wallY,
    bu,
    au,
    runnerPivot,
    sqdist,
    dist,
    lerpPt,
    normalizedLerpPt,
    unlerpPt,
    normalizedUnlerpPt,
    thirdPointOnTri,
    robot,
    ods,
    od0,
    od1,
    ax0,
    ax1,
    oc0,
    oc1,
    mc0,
    cc0,
    ec0,
    tc0,
    mc1,
    cc1,
    ec1,
    tc1,
    mc2,
    cc2,
    ec2,
    tc2,
    mc3,
    cc3,
    ec3,
    tc3,
    idleTimers,
    getAxis,
    err,
    idle,
    home,
    go,
    gob,
    routerLiftCmd,
    go0,
    go1,
    go2,
    go3,
    goz,
    gouv,
  });
})();

let sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let goSmooth = (u, v, speed) => {};

Object.assign(replContext, {
  odrives,
  odPromises,
  mmFromTurn,
  turnFromMM,
  robotFromDesk,
  deskFromRobot,
  aTransform,
  bTransform,
  aLen,
  bLen,
  wallY,
  bu,
  au,
  runnerPivot,
  sqdist,
  dist,
  lerpPt,
  normalizedLerpPt,
  unlerpPt,
  normalizedUnlerpPt,
  thirdPointOnTri,
  robot,
  ods,
  od0,
  od1,
  ax0,
  ax1,
  oc0,
  oc1,
  mc0,
  cc0,
  ec0,
  tc0,
  mc1,
  cc1,
  ec1,
  tc1,
  mc2,
  cc2,
  ec2,
  tc2,
  mc3,
  cc3,
  ec3,
  tc3,
  idleTimers,
  getAxis,
  err,
  idle,
  home,
  go,
  routerLiftCmd,
  go0,
  go1,
  goz,
  gouv,
  sleep,
  goSmooth,
});
require("repl").start({ useGlobal: true, preview: false });
