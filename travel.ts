type Time = number;
type Pos = number;
type Speed = number;
type Coor = [Pos, Pos, Pos];
type WaypointDefn = {
  coor: Coor;
  speedDefn: Speed;
}
type WaypointComputed = {
  speed: Speed;
};
type WaypointDerived = {
  len: Pos;
  dist: Pos;
  dcoor: Coor;
};
type ProtoWaypoint = WaypointDefn & WaypointComputed & WaypointDerived;
type ProtoPlan = {waypoints:ProtoWaypoint[]};
type PlanDefn = {waypoints:WaypointDefn[]};
type SameArgForChaining<T> = T;

const lerp = (a: number, b: number, f: number, sz = 1, offs = 0): number =>
    a * (1 - (f - offs) / sz) + b * ((f - offs) / sz),
  sameNumber = (a, b) => Math.abs(a - b) < 0.0000001,
  distBetween = (a: Coor, b : Coor): Pos =>
    Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2),
    vecLen = (v: Coor): Pos =>Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2),
    vecNormed = (v:Coor):Coor => {const d = vecLen(v) || 1;return [v[0]/d,v[1]/d,v[2]/d];},
    vecDiff=(vto:Coor,vfrom:Coor):Coor=>{
      return [vto[0]-vfrom[0],vto[1]-vfrom[1],vto[2]-vfrom[2]];
    },
    vecSum=(v1:Coor,v2:Coor):Coor=>{
      return [v1[0]+v2[0],v1[1]+v2[1],v1[2]+v2[2]];
    },
    vecAvg=(v1,v2)=>vecNormed(vecSum(vecNormed(v1), vecNormed(v2))),
  bezerp = (
    a: number | Coor,
    da: typeof a | number,
    b: typeof a,
    db: typeof a | number,
    f: number,
    sz = 1,
    offs = 0
  ): typeof a => {
    f = (f - offs) / sz;
    const omf = 1 - f;
    if (typeof a === 'number') {
      return (
        a * omf * omf * omf +
        (3 * a + <number>da / sz) * f * omf * omf +
        (3 * <number>b - <number>db / sz) * f * f * omf +
        <number>b * f * f * f
      );
    }
    return <Coor>(
      a.map((_, i) =>
        bezerp(
          a[i],
          typeof da === 'number' ? da : da[i],
          (<Coor>b)[i],
          typeof db === 'number' ? db : db[i],
          f,
          sz,
          offs
        )
      )
    );
  },
  mapPlanWaypoints = <T>(plan: PlanDefn, cb:{first?:((_:{w:WaypointDefn, nextw:WaypointDefn})=>T), mid?:((_:{w:WaypointDefn, prevw:WaypointDefn, nextw:WaypointDefn})=>T)|'first'|'end', end?:((_:{w:WaypointDefn, prevw:WaypointDefn})=>T)}):T[] => {
    const m = cb.mid ==='first' ? (typeof(cb.first)==='function' ? cb.first :null): cb.mid ==='end' ? (typeof(cb.end)==='function' ? cb.end:null) : cb.mid
    return plan.waypoints.map((w,i,a)=>(
      i==0 ? cb.first({w, nextw: a[i+1]}): i===a.length-1 ? cb.end({w, prevw: a[i-1]}):m({w, prevw:a[i-1], nextw:a[i+1]})
    ))
  },
  pplanFromdplan = (plan: PlanDefn): ProtoPlan => {
    let len = 0,
      dist = 0;
    const ret = plan.waypoints.map(
      (defn, i, a):ProtoWaypoint => {
        const nextc = i + 1 == a.length ? plan.end : a[i+1].coor;
        const len = distBetween(defn.coor, nextc),
        return { ...defn, speed: 0, len, dist: (dist += len) - len, dcoor: vecAvg()}
      )
    );
    let gap = 0,
      prevSpeed: number;
    ret.forEach((w, bi, a) => {
      if (w.speedDefn == null) {
        gap++;
        return;
      }
      w.speed = w.speedDefn;
      if (!gap) return;
      prevSpeed = prevSpeed ?? w.speedDefn;
      for (let i = 1; i <= gap; i++) a[bi - i].speed = lerp(w.speedDefn, prevSpeed, gap + 1, i);
      prevSpeed = w.speedDefn;
    });
    prevSpeed = prevSpeed ?? 0;
    for (let i = 1; i <= gap; i++) ret[ret.length - i].speed = prevSpeed;
    return ret.map(
      (defn, i, a) => (
        (len = i + 1 == a.length ? 0 : distBetween(defn, a[i + 1])),
        { ...defn, speed: 0, len, dist: (dist += len) - len }
      )
    );;
  },
  calcLengths = (plan: ProtoPlan): SameArgForChaining<ProtoPlan> => {};

let g_plan: ProtoPlan;
type P = number | ProtoWaypoint;
/*
function guessSpeeds(plan = g_plan) {
  // step 1: fill in estimates on the distance travelled in a dumb way
  for (const _bi in plan) {
    const bi = +_bi;
    const w0 = plan[bi],
      w1 = plan[bi + 1];
    w0._speed = 0;
    if (!w1) continue;
    w0._len = distBetween(w0, w1);
  }

  // step 1: fill in any estimates
  let gap: number;
  for (const _bi in plan) {
    const bi = +_bi;
    const w = plan[bi];
    if ('speed' in w || '_speed' in w) {
      if (gap) {
        const prevw = plan[bi - (gap + 1)];
        for (let i = 1; i <= gap; i++)
          plan[bi - i]._speed = lerp(w.speed ?? w.speed, prevw.speed ?? prevw._speed, gap + 1, i);
      }
      gap = 0;
    } else gap++;
  }
}

const plan = [
  { time: 100, coor: [10, 20, 30], entryRounding: [1, 1, 1], exitRounding: [1, 1, 1] },
  { time: 200, coor: [20, 10, 5] },
];

function coorAtTime(time) {
  const i = plan.findIndex(({ time: t }) => t >= time);
  if (i == -1 || i + 1 == plan.length) return null;
  let { [i - 1]: p0, [i]: p1, [i + 1]: p2, [i + 2]: p3 } = plan;
  if (!p0) p0 = p1;
  if (!p3) p3 = p2;
  let { coor: c0 } = p0,
    { exitRounding: p1Rounding = [1, 1, 1], coor: c1 } = p1,
    { entryRounding: p2Rounding = [1, 1, 1], coor: c2 } = p2,
    { coor: c3 } = p3;
  return c0.map((_, ax) => {
    const p1r = p1Rounding[ax] && sameNumber(c0[ax], c1[ax]) ? 0 : p1Rounding[ax],
      p2r = p2Rounding[ax] && sameNumber(c2[ax], c3[ax]) ? 0 : p2Rounding[ax];

    return;
  });
}

*/
