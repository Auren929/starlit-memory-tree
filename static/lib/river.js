export const RIVER_DEFAULTS = {
    seed: 20260825,
    clusters: 14,
    linesPerCluster: 9,
    clusterInnerSpan: .88,
    clusterJitter: .26,
    strengthMin: .35,
    strengthMax: 1,
    samples: 220,
    halfWidth: 900,
    zFar: -4200,
    zNear: 1850,
    drift: 1500,
    xBase: -820,
    wave1Amp: 300,
    wave1Cyc: 1.7,
    wave1Phase: .3,
    wave1Shear: .42,
    wave2Amp: 88,
    wave2Cyc: 3.35,
    wave2Phase: 1.9,
    wave2Shear: .58,
    wave3Amp: 46,
    wave3Cyc: 6.1,
    wave3Phase: .75,
    wave3Shear: 1.6,
    wobbleAmp: .13,
    wobbleCycMin: 1.2,
    wobbleCycMax: 2.8,
    lineJitter: 7,
    lateralBias: .78,
    islandT: .6,
    islandSpanT: .085,
    islandPush: 260,
    islandCore: .34,
    widthWaveAmp: .15,
    widthWaveCyc: 2.2,
    widthWavePhase: .6,
    taperMin: .4,
    taperFarEnd: .55,
    taperNearStart: .32,
    nearFadeStart: .52,
    detailFar: .14,
    farFadeSpan: .44
};

const TAU = Math.PI * 2;

function mulberry32(a) {
    return function() {
        a |= 0;
        a = a + 1831565813 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

export function riverZ(t, P) {
    return P.zFar + (P.zNear - P.zFar) * t;
}

const smooth = x => {
    const c = Math.max(0, Math.min(1, x));
    return c * c * (3 - 2 * c);
};

export function riverTaper(t, P) {
    const a = P.taperMin + (1 - P.taperMin) * smooth(t / P.taperFarEnd);
    const b = P.taperMin + (1 - P.taperMin) * smooth((1 - t) / (1 - P.taperNearStart));
    return Math.min(a, b);
}

export function riverHalfWidth(t, P) {
    return P.halfWidth * (1 + P.widthWaveAmp * Math.sin(t * TAU * P.widthWaveCyc + P.widthWavePhase)) * riverTaper(t, P);
}

export function riverCenterX(t, P, u = 0) {
    return P.xBase + P.drift * t + P.wave1Amp * Math.sin(t * TAU * P.wave1Cyc + P.wave1Phase + u * P.wave1Shear) + P.wave2Amp * Math.sin(t * TAU * P.wave2Cyc + P.wave2Phase + u * P.wave2Shear) + P.wave3Amp * Math.sin(t * TAU * P.wave3Cyc + P.wave3Phase + u * P.wave3Shear) * (P.detailFar + (1 - P.detailFar) * t);
}

export function riverCenter(t, P) {
    return {
        x: riverCenterX(t, P, 0),
        z: riverZ(t, P)
    };
}

export function applyIsland(t, lateral, P) {
    const dT = Math.abs(t - P.islandT);
    if (dT >= P.islandSpanT) return lateral;
    const g = Math.cos(dT / P.islandSpanT * Math.PI * .5);
    const core = Math.max(0, 1 - Math.abs(lateral) / (P.halfWidth * P.islandCore));
    return lateral + (lateral >= 0 ? 1 : -1) * P.islandPush * g * core;
}

export function riverPointAt(t, u, P) {
    const lateral = applyIsland(t, u * riverHalfWidth(t, P), P);
    return {
        x: riverCenterX(t, P, u) + lateral,
        z: riverZ(t, P)
    };
}

export function buildRiver(opts = {}) {
    const P = {
        ...RIVER_DEFAULTS,
        ...opts
    };
    const rnd = mulberry32(P.seed);
    const lines = [];
    const brnd = mulberry32(P.seed ^ 2654435769);
    const clusterColor = [];
    for (let c = 0; c < P.clusters; c++) {
        let k, guard = 0;
        do {
            const r = brnd();
            k = r < .5 ? 0 : r < .75 ? 1 : r < .93 ? 2 : 3;
        } while (c > 0 && k === clusterColor[c - 1] && guard++ < 8);
        clusterColor.push(k);
    }
    const clusterGap = 2 / P.clusters;
    for (let c = 0; c < P.clusters; c++) {
        let s = (c + .5) / P.clusters * 2 - 1;
        s += (rnd() - .5) * clusterGap * P.clusterJitter;
        const uc = Math.sign(s) * Math.pow(Math.min(1, Math.abs(s)), P.lateralBias);
        const wc1 = P.wobbleCycMin + rnd() * (P.wobbleCycMax - P.wobbleCycMin);
        const wp1 = rnd() * TAU;
        const wc2 = wc1 * (1.8 + rnd() * .9);
        const wp2 = rnd() * TAU;
        const wAmp = P.wobbleAmp * (.55 + rnd() * .9) * P.halfWidth;
        const colorKey = clusterColor[c];
        const strength = P.strengthMin + rnd() * (P.strengthMax - P.strengthMin);
        const nLines = Math.max(2, Math.round(P.linesPerCluster * (.45 + .55 * strength)));
        for (let j = 0; j < nLines; j++) {
            const inner = ((j + .5) / nLines - .5) * clusterGap * P.clusterInnerSpan * (.4 + .6 * strength);
            const u = uc + inner;
            const jitter = (rnd() - .5) * 2 * P.lineJitter;
            const tA = rnd() < .62 ? 0 : rnd() * .4;
            const tB = rnd() < .62 ? 1 : .6 + rnd() * .4;
            if (tB - tA < .25) continue;
            const pts = [];
            for (let k = 0; k < P.samples; k++) {
                const t = tA + (tB - tA) * (k / (P.samples - 1));
                const detail = P.detailFar + (1 - P.detailFar) * t;
                let lateral = u * riverHalfWidth(t, P) + jitter + (Math.sin(t * TAU * wc1 + wp1) * .7 + Math.sin(t * TAU * wc2 + wp2) * .3) * wAmp * detail;
                lateral = applyIsland(t, lateral, P);
                const x = riverCenterX(t, P, u) + lateral;
                const soft = x => Math.pow(Math.max(0, Math.min(1, x)), .62);
                const farFade = soft(t / P.farFadeSpan);
                const nearFade = soft((1 - t) / (1 - P.nearFadeStart));
                const tt = (t - tA) / (tB - tA);
                const endFade = Math.min(1, tt / .13) * Math.min(1, (1 - tt) / .11);
                pts.push({
                    x: x,
                    z: riverZ(t, P),
                    t: t,
                    fade: farFade * nearFade * endFade,
                    dist: Math.min(1, Math.abs(lateral) / P.halfWidth)
                });
            }
            lines.push({
                u: u,
                cluster: c,
                colorKey: colorKey,
                strength: strength,
                pts: pts
            });
        }
    }
    return {
        params: P,
        lines: lines
    };
}