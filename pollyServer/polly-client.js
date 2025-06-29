var robotStateObjListeners = [
  (axis, key, value) => console.log("robot", { axis, key, value }),
];

var robotStateObj = { x: {}, y: {}, xb: {}, yb: {}, l: {} },
  _robotStateProxies = Object.fromEntries(
    [...Object.entries(robotStateObj)].map(([axis, axisStateObj]) => [
      axis,
      new Proxy(axisStateObj, {
        get(state, key) {
          return state[key];
        },
        set(state, key, value) {
          state[key] = value;
          robotStateObjListeners.forEach((f) => f(axis, key, value));
        },
      }),
    ])
  ),
  robotStateProxy = new Proxy(robotStateObj, {
    get(state, key) {
      if (_robotStateProxies[key]) return _robotStateProxies[key];
      return state[key];
    },
    set(state, key, value) {
      if (_robotStateProxies[key]) return (_robotStateProxies[key] = value);
      state[key] = value;
      robotStateObjListeners.forEach((f) => f(null, key, value));
    },
  });

var pollyws;
(function openws() {
  pollyws = new WebSocket("ws://localhost:3000");
  pollyws.onmessage = handleWsMessage;
  pollyws.onopen = () => console.log("Opened ws");
  pollyws.onclose = function ({ code }) {
    console.log("Ws was closed", code);
    if (code !== 1006) return;
    pollyws = null;
    setTimeout(() => openws(), 2000);
  };
})();

function handleWsMessage({ data: message }) {
  try {
    const m =
      /^robotstate\.(?<keypath>\w+(?:\.\w+)*)\s*=\s*(?<valuestring>.+)$/.exec(
        message
      );
    if (m) {
      const { keypath, valuestring } = m.groups;
      const firstKeys = keypath.split(/\./g),
        lastKey = firstKeys.pop(),
        value = JSON.parse(valuestring),
        o = firstKeys.reduce((acc, k) => acc?.[k], robotStateProxy);
      if (o && (typeof o === "function" || typeof o === "object"))
        o[lastKey] = value;
    }
  } catch (err) {
    console.error(err);
  }
}

var goalStateObjListeners = [
  // {
  //   setter: (keyPath, value) => console.log("goal", { keyPath, value }),
  //   caller: (keyPath, ...args) => console.log("goal", { keyPath, args }),
  // },
  {
    setter: (keyPath, value) =>
      pollyws.send(`goalstate.${keyPath.join(".")} = ${JSON.stringify(value)}`),
    caller: (keyPath, ...args) =>
      pollyws.send(
        `goalstate.${keyPath.join(".")}(${JSON.stringify(args).replace(
          /^\s*\[([\s\S]*)\]\s*$/,
          (_, v) => v
        )})`
      ),
  },
];

const createGoalProxy = (keyPath) =>
  new Proxy(new Function(), {
    get(state, key) {
      return state[key] || (state[key] = createGoalProxy([...keyPath, key]));
    },
    set(state, key, value) {
      goalStateObjListeners.forEach(({ setter: f }) =>
        f([...keyPath, key], value)
      );
    },
    apply(state, thisArg, args) {
      goalStateObjListeners.forEach(({ caller: f }) => f(keyPath, ...args));
    },
  });

var goalState = createGoalProxy([]);
