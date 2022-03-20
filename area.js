const dw=530,dt=640

const Q = 100;

const
  triArea = (a,b,c) => (a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y))/2,
  quadArea = (a,b,c,d) => triArea(a,b,c)+triArea(c,d,a),
  lerp = (f,a,b)=>(1-f)*a+f*b,
  alerp = i => lerp(i/Q, 1, 1000),
  blerp = i => lerp(i/Q, 600, 1500);

const best = {}
for (let abi = 0; abi<=Q; abi++) {
  const ab = lerp(abi/Q, 1, 1000);
  for (let rli = 0; rli<=Q; rli++) {
    const rl = lerp(rli/Q, 600, 2000);

    const v = go(ab, rl);
    if  (v>(best.v??-Infinity)) {
      Object.assign(best, {v, ab, rl})
    }
  }
}

console.log(best);

function go(ab, rl) {
  const pos = (a,b) => ({x: (b - a)/2, y: Math.sqrt(rl**2 - ((a+b+ab)/2)**2)});

  let area = 0;
  for (let ai = 0; ai<Q; ai++) {
    const a0 = alerp(ai), a1 = alerp(ai+1);
    for (let bi = 0; bi<Q; bi++) {
      const b0 = blerp(bi), b1 = blerp(bi+1);
      const a = pos(a0,b0), b=pos(a1,b0), c=pos(a1,b1), d=pos(a0,b1);
      area += quadArea(a,b,c,d);
    }
  }
  return area;
}
