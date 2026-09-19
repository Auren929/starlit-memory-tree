export const FIELD_DEFAULTS = {
    seed: 20260826,
    bankCore: .62,
    bankFeather: 1.05,
    bankNoise: .48,
    bankNoiseCyc: 2.6,
    cloudCyc: .85,
    cloudCycU: .5,
    cloudAmp: 1,
    cloudFloor: .18,
    ridgeCycT: 9,
    ridgeCycU: 26,
    ridgeAmp: 1,
    ridgeSharp: 2.4,
    warpAmp: .62,
    warpCyc: 1,
    warpAmp2: .26,
    warpCyc2: 3.4,
    riftCycT: .7,
    riftCycU: 1.4,
    riftAmp: .85,
    riftSharp: 2.4,
    braidCyc: 2.3,
    braidSharp: 2.2,
    braidFloor: .06,
    braidWob: .55,
    braidWobCyc: 1.15,
    gatherT: .6,
    gatherSpan: .2,
    gatherAmp: 0,
    gatherNarrow: .45,
    taperFar: .34,
    taperNear: .93
};

const TAU = Math.PI * 2;

const fract = x => x - Math.floor(x);

const smooth = x => {
    const c = Math.max(0, Math.min(1, x));
    return c * c * (3 - 2 * c);
};

const mix = (a, b, k) => a + (b - a) * k;

function hash2(x, y, s) {
    const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453123;
    return fract(n);
}

function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
    const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return mix(mix(a, b, u), mix(c, d, u), v);
}

function fbm(x, y, s, oct = 4) {
    let v = 0, a = .5, fx = x, fy = y;
    for (let i = 0; i < oct; i++) {
        v += a * vnoise(fx, fy, s + i * 17.3);
        fx *= 2.03;
        fy *= 1.97;
        a *= .5;
    }
    return v;
}

function ridged(x, y, s, sharp, oct = 3) {
    let v = 0, a = .55, fx = x, fy = y, norm = 0;
    for (let i = 0; i < oct; i++) {
        const n = 1 - Math.abs(2 * vnoise(fx, fy, s + i * 31.7) - 1);
        v += a * Math.pow(n, sharp);
        norm += a;
        fx *= 2.11;
        fy *= 2.07;
        a *= .5;
    }
    return v / norm;
}

export function fieldAt(t, u, P) {
    const S = P.seed * .001;
    const bankWob = (fbm(t * P.bankNoiseCyc, 7.3, S + 3.1, 3) - .5) * 2 * P.bankNoise;
    let core = P.bankCore * (1 + bankWob);
    const side = u >= 0 ? 0 : 1;
    core *= 1 + (fbm(t * (P.bankNoiseCyc * 1.37) + side * 11.9, 2.1, S + 8.7, 3) - .5) * .5;
    let narrow = 1;
    if (P.gatherAmp > 0) {
        const g = Math.max(0, 1 - Math.abs(t - P.gatherT) / P.gatherSpan);
        const gg = smooth(g);
        narrow = mix(1, P.gatherNarrow, gg * P.gatherAmp);
        core *= narrow;
    }
    const au = Math.abs(u);
    const edge = Math.min(1.6, au / Math.max(.05, core));
    const env = au <= core ? 1 : smooth(1 - (au - core) / Math.max(.02, P.bankFeather));
    if (env <= .001) return {
        d: 0,
        ridge: 0,
        cloud: 0,
        edge: edge,
        env: 0
    };
    const tFade = smooth(t / P.taperFar) * smooth((1 - t) / (1 - P.taperNear));
    const wt = t + (fbm(t * P.warpCyc * .7, u * P.warpCyc * .5, S + 21.4, 3) - .5) * 2 * P.warpAmp * .5;
    const wu = u + (fbm(t * P.warpCyc, u * P.warpCyc * .45, S + 44.9, 3) - .5) * 2 * P.warpAmp + (fbm(t * P.warpCyc2, u * P.warpCyc2 * .8, S + 9.2, 3) - .5) * 2 * P.warpAmp2;
    const cloudRaw = fbm(wt * P.cloudCyc, wu * P.cloudCycU, S + 1.7, 4);
    const cloudC = Math.max(0, Math.min(1, (cloudRaw - .48) * (1 + P.cloudAmp * 2.4) + .5));
    const cloud = P.cloudFloor + (1 - P.cloudFloor) * cloudC;
    const ridge = ridged(wt * P.ridgeCycT, wu * P.ridgeCycU, S + 5.3, P.ridgeSharp, 3);
    const riftRaw = ridged(wt * P.riftCycT, wu * P.riftCycU, S + 12.9, P.riftSharp, 2);
    const rift = 1 - P.riftAmp * riftRaw;
    const braidShift = (fbm(t * P.braidWobCyc, 3.7, S + 61.3, 3) - .5) * 2 * P.braidWob;
    const braidRaw = .5 + .5 * Math.cos((wu + braidShift) * P.braidCyc * TAU);
    const braid = P.braidFloor + (1 - P.braidFloor) * Math.pow(braidRaw, P.braidSharp);
    let d = env * tFade * cloud * (1 - P.ridgeAmp * .5 + P.ridgeAmp * ridge) * Math.max(.04, rift) * braid;
    if (P.gatherAmp > 0) {
        const g = smooth(Math.max(0, 1 - Math.abs(t - P.gatherT) / P.gatherSpan));
        d *= 1 + g * P.gatherAmp * .9;
    }
    return {
        d: Math.max(0, Math.min(1, d)),
        ridge: ridge,
        cloud: cloud,
        edge: edge,
        env: env * tFade
    };
}

export class FieldTable {
    constructor(P, nt = 640, nu = 256, uSpan = 1.55) {
        this.P = P;
        this.nt = nt;
        this.nu = nu;
        this.uSpan = uSpan;
        const n = nt * nu;
        this.d = new Float32Array(n);
        this.ridge = new Float32Array(n);
        this.cloud = new Float32Array(n);
        this.edge = new Float32Array(n);
        this.env = new Float32Array(n);
        let mx = 0;
        for (let j = 0; j < nu; j++) {
            const u = ((j + .5) / nu * 2 - 1) * uSpan;
            for (let i = 0; i < nt; i++) {
                const f = fieldAt((i + .5) / nt, u, P), k = j * nt + i;
                this.d[k] = f.d;
                this.ridge[k] = f.ridge;
                this.cloud[k] = f.cloud;
                this.edge[k] = f.edge;
                this.env[k] = f.env;
                if (f.d > mx) mx = f.d;
            }
        }
        this.dMax = mx || 1;
    }
    at(t, u) {
        const x = Math.max(0, Math.min(this.nt - 1.001, t * this.nt - .5));
        const y = Math.max(0, Math.min(this.nu - 1.001, (u / this.uSpan * .5 + .5) * this.nu - .5));
        const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi;
        const k00 = yi * this.nt + xi, k10 = k00 + 1, k01 = k00 + this.nt, k11 = k01 + 1;
        const bl = A => (A[k00] * (1 - fx) + A[k10] * fx) * (1 - fy) + (A[k01] * (1 - fx) + A[k11] * fx) * fy;
        const d = bl(this.d);
        return {
            d: d,
            dn: d / this.dMax,
            ridge: bl(this.ridge),
            cloud: bl(this.cloud),
            edge: bl(this.edge)
        };
    }
    buildWorldXZ(toWorld) {
        const n = this.nt * this.nu;
        this.wx = new Float32Array(n);
        this.wz = new Float32Array(n);
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (let j = 0; j < this.nu; j++) {
            const u = ((j + .5) / this.nu * 2 - 1) * this.uSpan;
            for (let i = 0; i < this.nt; i++) {
                const w = toWorld((i + .5) / this.nt, u), k = j * this.nt + i;
                this.wx[k] = w.x;
                this.wz[k] = w.z;
                if (w.x < x0) x0 = w.x;
                if (w.x > x1) x1 = w.x;
                if (w.z < z0) z0 = w.z;
                if (w.z > z1) z1 = w.z;
            }
        }
        const padX = (x1 - x0) * .06, padZ = (z1 - z0) * .06;
        this.bounds = {
            x0: x0 - padX,
            x1: x1 + padX,
            z0: z0 - padZ,
            z1: z1 + padZ
        };
        return this.bounds;
    }
    toRGBA() {
        const n = this.nt * this.nu, buf = new Uint8Array(n * 4);
        for (let k = 0; k < n; k++) {
            buf[k * 4] = Math.min(255, this.d[k] / this.dMax * 255) | 0;
            buf[k * 4 + 1] = Math.min(255, this.ridge[k] * 255) | 0;
            buf[k * 4 + 2] = Math.min(255, this.cloud[k] * 255) | 0;
            buf[k * 4 + 3] = Math.min(255, this.env[k] * 255) | 0;
        }
        return {
            data: buf,
            width: this.nt,
            height: this.nu
        };
    }
    buildCdf(weight) {
        const n = this.nt * this.nu, cdf = new Float64Array(n);
        let acc = 0;
        for (let k = 0; k < n; k++) {
            acc += Math.max(0, weight(k, this));
            cdf[k] = acc;
        }
        return {
            cdf: cdf,
            total: acc
        };
    }
    pick(C, rnd = Math.random) {
        const target = rnd() * C.total;
        let lo = 0, hi = C.cdf.length - 1;
        while (lo < hi) {
            const mid = lo + hi >> 1;
            if (C.cdf[mid] < target) lo = mid + 1; else hi = mid;
        }
        const i = lo % this.nt, j = lo / this.nt | 0;
        const t = (i + rnd()) / this.nt;
        const u = ((j + rnd()) / this.nu * 2 - 1) * this.uSpan;
        return {
            t: t,
            u: u,
            d: this.d[lo],
            dn: this.d[lo] / this.dMax,
            ridge: this.ridge[lo],
            cloud: this.cloud[lo],
            edge: this.edge[lo]
        };
    }
}

export function sampleField(n, P, opt = {}) {
    const rnd = opt.rnd || Math.random;
    const tMin = opt.tMin ?? 0, tMax = opt.tMax ?? 1;
    const uSpan = opt.uSpan ?? 1.35;
    const ridgeBias = opt.ridgeBias ?? 0;
    const out = [];
    let tries = 0, cap = opt.maxTries ?? n * 42;
    while (out.length < n && tries++ < cap) {
        const t = tMin + (tMax - tMin) * rnd();
        const u = (rnd() * 2 - 1) * uSpan;
        const f = fieldAt(t, u, P);
        if (f.d <= 0) continue;
        let p = f.d;
        if (ridgeBias > 0) p *= Math.pow(f.ridge, ridgeBias * 3); else if (ridgeBias < 0) p *= Math.pow(1 - f.ridge * .85, -ridgeBias * 2);
        if (opt.gate && !opt.gate(f, t, u)) continue;
        if (rnd() > p) continue;
        out.push({
            t: t,
            u: u,
            ...f
        });
    }
    return out;
}