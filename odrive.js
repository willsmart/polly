#!/usr/bin/env node
var ODrive = require('odrive');
var Util = require('util');
var Progress = require('cli-progress');

module.exports = (() => {
  if (this.odrive) return this;

  this.DEB = true;
  const print = o => console.log(Util.inspect(o, false, 10, true)),
    dprint = o => this.DEB && print(o);

  const odrive = new ODrive();
  this.odrive = odrive;
  this.state = {};

  let _od0, _od0_reject, _od0_resolve;

  odrive.on('error', o => {
    print(o);
    _od0 = null;
    this.state.error = o;
    _od0_reject?.(new Error());
  });

  this.odrive.on('remoteObject', object => {
    delete object['']; //remove endpoint 0
    setTimeout(async () => {
      dprint('Connected to ODrive ' + (await object.serial_number) + ' as odrv0.');
      _od0 = object;
      this.state.od = 'connected';
      _od0_resolve?.();
    }, 100);
  });

  odrive.fibre.on('connect', () => {
    this.state.fibre = 'connected';
  });

  odrive.fibre.on('error', o => {
    print(o);
    this.state.fibreErrors = [...(this.state.fibreErrors ?? []), o];
  });

  odrive.fibre.on('payload.start', () => {
    print('Fibre connected to ODrive on USB.');
    const b2 = new Progress.Bar({
      barCompleteChar: '#',
      barIncompleteChar: '_',
      format: ' |- Read JSON Definition : {percentage}%' + ' - ' + '||{bar}||',
      fps: 5,
      stream: process.stdout,
      barsize: 30,
    });
    b2.start(100, 0);
    odrive.fibre.on('payload.update', length => {
      b2.setTotal(length + 512);
      b2.update(length);
    });
    odrive.fibre.on('payload.complete', length => {
      b2.setTotal(length);
      b2.update(length);
      b2.stop();
    });
  });

  this.od =
    _od0 !== undefined
      ? _od0
      : new Promise((resolve, reject) => {
          _od0_resolve = () => {
            this.od = _od0;
            delete _od0;
            delete _od0_resolve;
            delete _od0_reject;
            resolve(this.od);
          };
          _od0_reject = e => {
            this.od = null;
            delete _od0;
            delete _od0_resolve;
            delete _od0_reject;
            reject(e);
          };
        });

  odrive.fibre.start();

  return this;
})();
