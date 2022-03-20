import odrive
from odrive.enums import *
import time, requests, math

KV = 190

od = odrive.find_any()
def getAxis(axisi):
    return getattr(od, 'axis'+str(axisi))
ax0=getAxis(0)
ax1=getAxis(1)

oc=od.config
mc0=ax0.motor.config
cc0=ax0.controller.config
ec0=ax0.encoder.config
tc0=ax0.trap_traj.config
mc1=ax1.motor.config
cc1=ax1.controller.config
ec1=ax1.encoder.config
tc1=ax1.trap_traj.config

def err():
    odrive.utils.dump_errors(od)
    odrive.utils.dump_errors(ax0)
    odrive.utils.dump_errors(ax1)

def idle():
    ax0.requested_state = AXIS_STATE_IDLE
    ax1.requested_state = AXIS_STATE_IDLE
    
def go(ax,pos):
    ax.requested_state = AXIS_STATE_CLOSED_LOOP_CONTROL
    ax.controller.input_pos=pos

def go0(pos):
    go(ax0,pos)

def go1(pos):
    go(ax1,pos)

def routerLiftCmd(cmd):
    requests.get('http://routerlift/setcmd', {'v': cmd})

def goz(pos):
    routerLiftCmd("um={}".format(math.floor(pos*1000)))
