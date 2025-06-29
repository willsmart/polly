const { readFileSync } = require("node:fs");

class Drawing {
  points = [];

  constructor(arg) {
    if (arg) this.process(arg);
  }

  async process({ gcodeFilename }) {
    if (gcodeFilename)
      return await this.processGcode({ filename: gcodeFilename });
  }
  async processGcode({ filename }) {
    const state = { x: 0, y: 0, z: 0 };
    return (this.points = (await readFileSync(filename, "utf-8"))
      .split("\n")
      .filter((line) => /^G1\b/.test(line))
      .map((line) =>
        Object.fromEntries(
          line
            .split(/\s+/g)
            .map((param, i) =>
              i ? /([XYZF]?)(-?\d+(\.\d+)?)/.exec(param) : null
            )
            .flatMap((v) =>
              v ? [[v[1].toLowerCase() || "e", parseFloat(v[2])]] : []
            )
        )
      )
      .map((o) => {
        delete state.e;
        Object.assign(state, o);
        return { ...state };
      }));
  }

  get svgPathD() {
    return this.points
      .map(({ x, y, e }) => `${e > 0 ? "L" : "M"} ${x / 6} ${y / 6}`)
      .join(" ");
  }
}

module.exports = Drawing;
