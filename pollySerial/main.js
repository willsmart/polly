const { SerialPort } = require("serialport");
const readline = require("readline/promises"),
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

let serialPort;
(async () => {
  console.log(await SerialPort.list());
  // Create a port
  serialPort = new SerialPort({
    path: "COM8",
    baudRate: 115200,
  });

  serialPort.on("data", function (data) {
    process.stdout.write(data.toString());
  });

  await cmdLoop();

  console.log("done.");
})();

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
