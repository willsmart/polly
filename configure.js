const c = require("./_configure");
c({
  recal: process.argv.includes("recal"),
  isx: process.argv.includes("isx"),
  isy: process.argv.includes("isy"),
});

require("repl").start({ useGlobal: true });
