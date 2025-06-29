const { SerialPort } = require("serialport");
const readline = require("readline/promises"),
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
const odrive = require("./odrive");
const Drawing = require("./Drawing");

let serialPort;
const websockets = [];

function stateObjChangeCallback(stateObj, ...args) {
  try {
    let data = `robotstate.${args.join(".")} = ${JSON.stringify(
      args.reduce((acc, k) => acc[k], stateObj)
    )}`;
    console.log(data);
    websockets.forEach((websocket) => {
      try {
        websocket.send(data);
      } catch (err) {
        console.error(err);
      }
    });
  } catch (err) {
    console.error(err);
  }
}

(async () => {
  console.log(await SerialPort.list());
  // Create a port
  serialPort = new SerialPort({
    path: "COM8",
    baudRate: 115200,
  });
  odrive.start({ serialPort, stateObjChangeCallback });

  await Promise.all(
    ["x", "y", "xb", "yb"].map((axis) => odrive.axes[axis].command.ensureInfo())
  );
  await cmdLoop();
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
    await new Promise((r) => serialPort.write(cmd + "\n", r));
  } catch (err) {
    console.error(err);
  }
  await cmdLoop();
}

const { readFileSync } = require("node:fs"),
  Koa = require("koa"),
  Router = require("@koa/router"),
  websockify = require("koa-websocket");
const app = websockify(new Koa()),
  router = new Router(),
  wsRouter = new Router();

const drawing = new Drawing();
(async () => {
  await drawing.process({ gcodeFilename: "a.gcode" });
  console.log(drawing.points);
})();

router.get("/", async (ctx) => {
  ctx.body = readFileSync("index.html", "utf-8").replace(
    /SVG_PATH/g,
    drawing.svgPathD
  );
});
router.get("/pidtest.html", async (ctx) => {
  ctx.body = readFileSync("pidtest.html", "utf-8");
});
router.get("/followpath.html", async (ctx) => {
  ctx.body = readFileSync("followpath.html", "utf-8");
});
router.get("/polly-client.js", async (ctx) => {
  ctx.body = readFileSync("polly-client.js", "utf-8");
});
router.get("/pid.js", async (ctx) => {
  ctx.body = readFileSync("pid.js", "utf-8");
});
router.get("/tick", async (ctx) => {
  ctx.body = JSON.stringify(odrive.stateObj, null, 2);
  let { xpos, xvel, ypos, yvel } = ctx.request.query;
  xpos = Math.max(10, Math.min(340, xpos));
  ypos = Math.max(10, Math.min(340, ypos));
  xvel = Math.max(-5, Math.min(5, xvel));
  yvel = Math.max(-5, Math.min(5, yvel));

  if (xpos != null) odrive.x.command.position(xpos, xvel);
  if (ypos != null) odrive.y.command.position(ypos, yvel);
});
router.get("/ws", async (ctx, next) => {
  ctx.body = `<script>
    ws = new WebSocket("ws://localhost:3000");
    ws.addEventListener('open', () => { ws.send("ping"); });
  </script>Check the network inspector!`;
  return next;
});

wsRouter.get("/", async (ctx, next) => {
  try {
    websockets.push(ctx.websocket);
    ctx.websocket.on("close", () => {
      const i = websockets.findIndex((v) => v === ctx.websocket);
      if (i == -1) {
        console.error("Web socket connection not found in array");
        return;
      }
      websockets.splice(i, 1);
    });
    ctx.websocket.on("message", (message) => {
      try {
        // do something with the message from client
        if (message.toString() === "ping") {
          ctx.websocket.send("poong");
          return;
        }
        {
          const m =
            /^goalstate\.(?<keypath>(?:\w+)(?:\.\w+)*)\s*=\s*(?<valuestring>.+)$/.exec(
              message
            );
          if (m) {
            const { keypath, valuestring } = m.groups;
            const firstKeys = keypath.split(/\./g),
              lastKey = firstKeys.pop(),
              value = JSON.parse(valuestring),
              o = firstKeys.reduce((acc, k) => acc?.[k], odrive.axes);
            console.log({
              keypath,
              firstKeys,
              lastKey,
              o,
            });
            if (
              o &&
              typeof o === "object" &&
              (Object.getOwnPropertyDescriptor(o, lastKey)?.set ||
                Object.getOwnPropertyDescriptor(o, lastKey)?.writable)
            ) {
              console.log({ keypath, value });
              o[lastKey] = value;
            }
          }
        }
        {
          const m =
            /^goalstate\.(?<keypath>(?:\w+)(?:\.\w+)*)\s*\((?<valuestring>.*)\)$/.exec(
              message
            );
          if (m) {
            const { keypath, valuestring } = m.groups;
            const firstKeys = keypath.split(/\./g),
              lastKey = firstKeys.pop(),
              args = JSON.parse(`[${valuestring}]`);
            let o = firstKeys.reduce((acc, k) => acc?.[k], odrive.axes);
            console.log({
              keypath,
              firstKeys,
              lastKey,
              args,
              o,
            });

            if (o && typeof o === "object") {
              if (typeof o[lastKey] !== "function") o = o.command;
              if (typeof o[lastKey] === "function") {
                console.log({ keypath, args });
                o[lastKey]?.(...args);
              }
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    });
  } catch (err) {
    console.error(err);
  }
  return next;
});

app.ws.use(wsRouter.routes()).use(wsRouter.allowedMethods());
app.use(router.routes()).use(router.allowedMethods());

app.listen(3000);
