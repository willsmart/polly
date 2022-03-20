const { odrive, od: odPromise } = require('./odrive'),
  fetch = require('node-fetch'),
  MAX_POS = 126;

let {
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
  sqdist,dist,lerpPt,normalizedLerpPt,unlerpPt,normalizedUnlerpPt,thirdPointOnTri
} = require('./pos.js');

let robot = {
}

let od, ax0, ax1, oc, mc0, cc0, ec0, tc0, mc1, cc1, ec1, tc1;
let idleTimer

const getAxis = axisi => od[`axis${axisi}`],
  err = () => {
    odrive.utils.dump_errors(od);
    odrive.utils.dump_errors(ax0);
    odrive.utils.dump_errors(ax1);
  },
  idle = async () => {
    ax0.requested_state = odrive.AXIS_STATE_IDLE;
    ax1.requested_state = odrive.AXIS_STATE_IDLE;
    await odrive.readyPromise;
  },
  home = async (axisi=undefined) => {
    if (axisi==0 || axisi===undefined) {
      await ax0.requested_state__set(odrive.AXIS_STATE_CLOSED_LOOP_CONTROL);
      ax0.requested_state = odrive.AXIS_STATE_HOMING;
    }
    if (axisi==1 || axisi===undefined) {
      await ax1.requested_state__set(odrive.AXIS_STATE_CLOSED_LOOP_CONTROL);
      ax1.requested_state = odrive.AXIS_STATE_HOMING;
    }
    await odrive.readyPromise;
  },
  go = async (ax, pos, timeout = 0) => {
    pos = Math.max(0, Math.min(MAX_POS, pos));
    ax.requested_state = odrive.AXIS_STATE_CLOSED_LOOP_CONTROL;
    ax.controller.input_pos = pos;
    await odrive.readyPromise;
    idleTimer && clearTimeout(idleTimer);
    timeout && (idleTimer = setTimeout(()=> {
      idle();
      idleTimer=null;
    }, timeout*1000));
  },
  routerLiftCmd = cmd => fetch(`http://routerlift/setcmd?v=${encodeURIComponent(cmd)}`),
  go0 = pos => go(ax0, pos),
  go1 = pos => go(ax1, pos),
  goz = pos => routerLiftCmd(`um=${Math.floor(pos * 1000)}`),
  gouv = (u, v) => {
    const pos = robotFromDesk(u, v),
      {
        a: { turn: aturn },
        b: { turn: bturn },
      } = pos;
    go0(aturn);
    go1(bturn);
    robot = {u,v};
    return pos;
  };

(async () => {
  await odrive.readyPromise;
  od = await odPromise;

  ax0 = getAxis(0);
  ax1 = getAxis(1);
  oc = od.config;
  mc0 = ax0.motor.config;
  cc0 = ax0.controller.config;
  ec0 = ax0.encoder.config;
  tc0 = ax0.trap_traj.config;
  mc1 = ax1.motor.config;
  cc1 = ax1.controller.config;
  ec1 = ax1.encoder.config;
  tc1 = ax1.trap_traj.config;
})();


let sleep = ms =>new Promise(resolve => setTimeout(resolve, ms));

let goSmooth = (u,v, speed) => {
} 

