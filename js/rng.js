let rngState = null;
let currentSeed = null;

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function setRngSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed) && seed >= 0) {
    currentSeed = Math.floor(seed) >>> 0;
    rngState = mulberry32(currentSeed);
  } else {
    currentSeed = null;
    rngState = null;
  }
}

export function getRngSeed() {
  return currentSeed;
}

export function isDeterministic() {
  return rngState !== null;
}

export function random() {
  if (rngState) {
    return rngState();
  }
  return Math.random();
}

export function randomBits(count) {
  return Array.from({ length: count }, () => (random() > 0.5 ? 1 : 0));
}

export function gaussianRandom() {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
