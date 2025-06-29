const c = require("./_configureLift");
c(process.argv.includes("recal"));

require("repl").start({ useGlobal: true });
