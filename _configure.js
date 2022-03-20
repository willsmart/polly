const { odrive, od: odPromise } = require('./odrive');

const KV = 190;

module.exports = async function (recal = false) {
  await odrive.readyPromise;
  const od = (this.od = await odPromise);

  this.getAxis = axisi => od[`axis${axisi}`];

  this.goBase = async () => {
    oc = od.config;

    //  oc.enable_brake_resistor = true
    oc.enable_brake_resistor = true;
    oc.brake_resistance = 2;
    oc.max_regen_current = 0;
    oc.dc_max_negative_current = -0.02;
    oc.gpio3_mode = odrive.GPIO_MODE_DIGITAL_PULL_UP;
    oc.gpio4_mode = odrive.GPIO_MODE_DIGITAL_PULL_UP;
    
    await odrive.readyPromise;
  };

  this.goAxis = async axisi => {
    axis = getAxis(axisi);
    ac = axis.config;
    mc = axis.motor.config;
    cc = axis.controller.config;
    ec = axis.encoder.config;
    tc = axis.trap_traj.config;

    ac.startup_encoder_index_search = true;

    ec.cpr = 4096;
    ec.use_index = true;

    mc.current_lim = 30;
    mc.calibration_current = 10;
    mc.pole_pairs = 7;
    mc.torque_constant = 8.27 / KV;
    mc.motor_type = odrive.MOTOR_TYPE_HIGH_CURRENT;

    cc.vel_limit = 60;
    cc.control_mode = odrive.CONTROL_MODE_POSITION_CONTROL;
    cc.input_mode = odrive.INPUT_MODE_TRAP_TRAJ;
    cc.homing_speed = 4;

    tc.accel_limit = 40;
    tc.decel_limit = 40;
    tc.vel_limit = 40.0;

    axis.min_endstop.config.is_active_high = false;
    axis.min_endstop.config.pullup = true;
    axis.min_endstop.config.offset = 0.5;
    axis.min_endstop.config.enabled = true;
    axis.min_endstop.config.gpio_num = axisi + 3;
    axis.max_endstop.config.enabled = false;

    await odrive.readyPromise;
  };

  await this.goBase();
  await this.goAxis(0);
  await this.goAxis(1);

  this.calAxis = async axisi => {
    axis = getAxis(axisi);
    mc = axis.motor.config;
    ec = axis.encoder.config;

    if (recal) {
      ec.pre_calibrated = false;
      mc.pre_calibrated = false;
      await odrive.readyPromise;
      od.save_configuration();

      console.log(
        '   - have marked the axis as needing calibration. Please power cycle the odrive and rerun the script.\n'
      );
      return;
    }

    if ((await ec.pre_calibrated__get) && (await mc.pre_calibrated__get) && !recal) {
      console.log(`Group ${axisi} is already calibrated`);
      return;
    }

    console.log(`Calibrating group ${axisi}`);

    await axis.requested_state__set(odrive.AXIS_STATE_FULL_CALIBRATION_SEQUENCE);

    sec = 0;
    while (!((await axis.encoder.is_ready__get) && (await axis.motor.is_calibrated__get))) {
      console.log('   .');
      await sleep(1000);
      sec = sec + 1;
      if (sec > 25) {
        console.log('   - failed!\n');
        // odrive.utils.dump_errors(od);
        return;
      }
    }

    ec.pre_calibrated = true;
    mc.pre_calibrated = true;

    console.log('   - done.\n');

    await odrive.readyPromise;
  };

  await this.calAxis(0);
  await this.calAxis(1);

  od.save_configuration();

  console.log('Done calibrating the odrive motors\n');

  return this;
};

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
