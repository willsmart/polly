import odrive

od = odrive.find_any()

def getAxis(axisi):
    return getattr(od, 'axis'+str(axisi))


def gobase():
    oc=od.config

    print("ODrive base config:")
    print(oc)
    print("\n")

def go(axisi):
    axis = getAxis(axisi)
    mc=axis.motor.config
    cc=axis.controller.config
    ec=axis.encoder.config
    tc=axis.trap_traj.config

    print("Encoder {}:".format(axisi))
    print(ec)
    print("\nController {}:".format(axisi))
    print(cc)
    print("\nMotor {}:".format(axisi))
    print(mc)
    print("\nTrap traj {}:".format(axisi))
    print(tc)
    print("\n")

gobase()
go(0)
go(1)