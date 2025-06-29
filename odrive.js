#!/usr/bin/env node
var ODrive = require("odrive");
var Util = require("util");
var Progress = require("cli-progress");

module.exports = ((finderFnMap) => {
  if (this.odrives) return this;

  this.DEB = true;
  const print = (o) => console.log(Util.inspect(o, false, 10, true)),
    dprint = (o) => this.DEB && print(o);

  this.odrives = [0].map(() => new ODrive());
  this.ctxts = this.odrives.map((odrive) => ({ odrive, state: {} }));
  this.ods = [];

  for (const ctxtIndex in this.ctxts) {
    const ctxt = this.ctxts[ctxtIndex],
      { odrive, state } = ctxt;

    odrive.on("error", (o) => {
      print(o);
      ctxt.od = null;
      state.error = o;
      ctxt.od_reject?.(new Error());
    });

    odrive.on("remoteObject", (object) => {
      delete object[""]; //remove endpoint 0
      setTimeout(async () => {
        dprint(
          "Connected to ODrive " + (await object.serial_number) + " as odrv0."
        );
        ctxt.od = object;
        state.od = "connected";
        ctxt.od_resolve?.();
      }, 100);
    });

    odrive.fibre.on("connect", () => {
      state.fibre = "connected";
    });

    odrive.fibre.on("error", (o) => {
      print(o);
      state.fibreErrors = [...(state.fibreErrors ?? []), o];
    });

    odrive.fibre.on("payload.start", () => {
      print("Fibre connected to ODrive on USB.");
      const b2 = new Progress.Bar({
        barCompleteChar: "#",
        barIncompleteChar: "_",
        format:
          " |- Read JSON Definition : {percentage}%" + " - " + "||{bar}||",
        fps: 5,
        stream: process.stdout,
        barsize: 30,
      });
      b2.start(100, 0);
      odrive.fibre.on("payload.update", (length) => {
        b2.setTotal(length + 512);
        b2.update(length);
      });
      odrive.fibre.on("payload.complete", (length) => {
        b2.setTotal(length);
        b2.update(length);
        b2.stop();
      });
    });

    this.ods[ctxtIndex] =
      ctxt.od !== undefined
        ? ctxt.od
        : new Promise((resolve, reject) => {
            ctxt.od_resolve = () => {
              this.ods[ctxtIndex] = ctxt.od;
              delete ctxt.od;
              delete ctxt.od_resolve;
              delete ctxt.od_reject;
              resolve(this.ods[ctxtIndex]);
            };
            ctxt.od_reject = (e) => {
              this.ods[ctxtIndex] = null;
              delete ctxt.od;
              delete ctxt.od_resolve;
              delete ctxt.od_reject;
              reject(e);
            };
          });

    odrive.fibre.start(undefined, (device, index) => index == ctxtIndex);
  }
  return this;
})();
