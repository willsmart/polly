#!/usr/local/bin/python3

import odrive
from odrive.enums import *
import time, sys, getopt

recal=False

try:
    opts, args = getopt.getopt(sys.argv,":",["recal"])
except getopt.GetoptError:
    print('--recal')
    sys.exit(2)
for opt, arg in opts:
    if opt == '--recal':
        recal = True

recal = sys.argv[0]
KV = 190

od = odrive.find_any()

def getAxis(axisi):
    return getattr(od, 'axis'+str(axisi))
0
def gobase():
    oc=od.config

    # oc.enable_brake_resistor = True
    oc.brake_resistance = 2
    oc.max_regen_current = -0.01

def go(axisi):
    axis = getAxis(axisi)
    ac=axis.config
    mc=axis.motor.config
    cc=axis.controller.config
    ec=axis.encoder.config
    tc=axis.trap_traj.config

    ac.startup_encoder_index_search = True

    ec.cpr=4096
    ec.use_index=True

    mc.current_lim=30
    mc.calibration_current = 10
    mc.pole_pairs = 7
    mc.torque_constant = 8.27 / KV
    mc.motor_type = MOTOR_TYPE_HIGH_CURRENT

    cc.vel_limit=20
    cc.control_mode = CONTROL_MODE_POSITION_CONTROL
    cc.input_mode = INPUT_MODE_TRAP_TRAJ

    tc.accel_limit = 40
    tc.decel_limit = 40
    tc.vel_limit = 10.0

gobase()
go(0)
go(1)

od.save_configuration()


def cal(axisi):
    axis = getAxis(axisi)
    mc=axis.motor.config
    ec=axis.encoder.config

    if ec.pre_calibrated and mc.pre_calibrated and not recal:
        print("Group {} is already calibrated".format(axisi))
        return

    print("Calibrating group {}".format(axisi))

    axis.requested_state = AXIS_STATE_FULL_CALIBRATION_SEQUENCE
    
    sec=0
    while not(axis.encoder.is_ready and axis.motor.is_calibrated):
        print('   .')
        time.sleep(1)
        sec = sec+1
        if sec>25:
            print("   - failed!\n")
            odrive.utils.dump_errors(od)
            return

    ec.pre_calibrated = True
    mc.pre_calibrated = True
    od.save_configuration()
    print("   - done.\n")


cal(0)
cal(1)
