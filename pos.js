const aTransform = { mmPerTurn: 5, mmAt0: 44.5 * 5 - 1000 },
  bTransform = { mmPerTurn: 5, mmAt0: 53.5 * 5 },
  aLen = 799,
  bLen = 797.5,
  bu = -200,
  au = bu - 42.5,
  wallY = -566.45,
  runnerPivot = {
    x: -1098,
    y: 95.5,
  },
  mmFromTurn = (turn, { mmPerTurn, mmAt0 }) => turn * mmPerTurn + mmAt0,
  turnFromMM = (mm, { mmPerTurn, mmAt0 }) => (mm - mmAt0) / mmPerTurn;

function robotFromDesk(pos) {
  if (arguments.length >= 2 && typeof pos == 'number') pos = { u: pos, v: arguments[1] };
  const { u: workU, v: workV } = pos,
    t = pointAtTangent({ circle: { x: 0, y: 0, r: workV }, a: runnerPivot }),
    ab = normalizedLerpPt({ a: t, b: runnerPivot }, { du: workU - bu }),
    amm = ab.x - Math.sqrt(aLen ** 2 - (ab.y - wallY) ** 2),
    bmm = ab.x + Math.sqrt(bLen ** 2 - (ab.y - wallY) ** 2);

  Object.assign(pos, {
    a: { mm: amm, turn: turnFromMM(amm, aTransform) },
    b: { mm: bmm, turn: turnFromMM(bmm, bTransform) },
  });

  const working = {
    pos,
    t,
    ab,
    amm,
    bmm,
  };
  return {
    ...pos,
    working,
  };
}

function deskFromRobot(pos) {
  if (arguments.length >= 2 && typeof pos == 'number') pos = { a: { mm: pos }, b: { mm: arguments[1] } };
  let {
    a: { mm: amm, turn: aTurn },
    b: { mm: bmm, turn: bTurn },
  } = pos;
  if (amm === undefined) amm = mmFromTurn(aTurn, aTransform);
  if (bmm === undefined) bmm = mmFromTurn(bTurn, bTransform);

  const a = { x: amm, y: wallY },
    b = { x: bmm, y: wallY },
    abPivot = thirdPointOnTri({ a, b, distToA: aLen, distToB: bLen })[0];
  const { du, dv } = normalizedUnlerpPt({ a: abPivot, b: runnerPivot }, { x: 0, y: 0 });
  pos.u = bu - du;
  pos.v = dv;

  const working = {
    pos,
    a,
    b,
    abPivot,
    du,
    dv,
  };
  return {
    ...pos,
    working,
  };
}

module.exports = {
  mmFromTurn,
  turnFromMM,
  robotFromDesk,
  deskFromRobot,
  aTransform,
  bTransform,
  aLen,
  bLen,
  wallY,
  bu,
  au,
  runnerPivot,
  sqdist,
  dist,
  lerpPt,
  normalizedLerpPt,
  unlerpPt,
  normalizedUnlerpPt,
  thirdPointOnTri,
};

function sqdist({ a: { x: ax, y: ay }, b: { x: bx, y: by } }) {
  return (ax - bx) ** 2 + (ay - by) ** 2;
}
function dist(ab) {
  return Math.sqrt(sqdist(ab));
}
function lerpPt({ a: { x: ax, y: ay }, b: { x: bx, y: by } }, { u, v = 0 }) {
  return {
    x: ax + u * (bx - ax) - v * (by - ay),
    y: ay + u * (by - ay) + v * (bx - ax),
  };
}
function normalizedLerpPt(ab, { du, dv = 0 }) {
  const dab = dist(ab);
  return lerpPt(ab, { u: du / dab, v: dv / dab });
}
function unlerpPt({ a: { x: ax, y: ay }, b: { x: bx, y: by } }, { x, y }) {
  const bax = bx - ax,
    bay = by - ay;
  return {
    u: ((x - ax) * bax + (y - ay) * bay) / (bax ** 2 + bay ** 2),
    v: ((ax - x) * bay + (y - ay) * bax) / (bax ** 2 + bay ** 2), // plus or minus
  };
}
function normalizedUnlerpPt(ab, xy) {
  const dab = dist(ab),
    { u, v } = unlerpPt(ab, xy);
  return { du: u * dab, dv: v * dab };
}
function thirdPointOnTri({ a, b, distToA, distToB }) {
  const { x: ax, y: ay } = a,
    { x: bx, y: by } = b,
    dab = dist({ a, b }),
    u = (1 + (distToA / dab) ** 2 - (distToB / dab) ** 2) / 2,
    v = Math.sqrt((distToA / dab) ** 2 - u ** 2); // plus or minus
  return [
    { x: ax + u * (bx - ax) - v * (by - ay), y: ay + u * (by - ay) + v * (bx - ax) },
    { x: ax + u * (bx - ax) + v * (by - ay), y: ay + u * (by - ay) - v * (bx - ax) },
  ];
}
function pointAtTangent({ circle, a }) {
  const { x: cx, y: cy, r } = circle,
    { x: ax, y: ay } = a,
    sqdac = sqdist({ a, b: circle }),
    x = (ax * r ** 2 + Math.sign(r) * Math.sqrt(ay ** 2 * r ** 2 * (sqdac - r ** 2))) / sqdac;
  return {
    x: cx + x,
    y: cy + Math.sign(r) * Math.sqrt(r ** 2 - x ** 2),
  };
}
