const { SerialPort } = require("serialport");
const odrive = require("./odrive");
const readline = require("readline/promises"),
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

async function cmdLoop() {
  const cmd = await rl.question(">> ");
  try {
    if (cmd == "hi") console.log("hi");
    if (cmd == "bye") {
      console.log("bye");
      serialPort.close();
      serialPort = null;
      return;
    }
    await serialPort.write(cmd + "\n");
  } catch (err) {
    console.error(err);
  }
  await cmdLoop();
}
