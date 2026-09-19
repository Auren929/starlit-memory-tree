import * as THREE from "three";

import { buildRiver, riverCenter, riverPointAt, RIVER_DEFAULTS } from "./river.js";

import { fieldAt, sampleField, FieldTable, FIELD_DEFAULTS } from "./river_field.js";

export function createWardrobePearl(camera, controls, overrides = {}, opt = {}) {
    const bloomPass = {};
    const RIVER_TUNED = {
        linesPerCluster: 44,
        clusterInnerSpan: .92,
        halfWidth: 1850,
        wave1Amp: 470,
        wave1Cyc: 2.85,
        wobbleAmp: .05,
        lineJitter: 12
    };
    const VIEW_DEFAULTS = {
        _n: 6500,
        _dust: 185e3,
        _flow: 125e3,
        _bed: 8e4,
        _bright: 1950,
        _aniso: 6.7,
        _thick: 110,
        _fila: .24,
        _starA: 3.25,
        _dustA: 1.75,
        _bedA: 0,
        _bloom: .3,
        _bloomR: .65,
        _bloomT: .34,
        _tree: 1.1,
        _bokeh: .45,
        _focus: 2600,
        _warm: .28,
        _filaN: 3300,
        _endSoft: .75,
        _memGather: 0,
        _riverA: .44,
        _filaKnee: 17,
        _filaRidge: 3,
        _filaCap: 2,
        _haze: 9e3,
        _hazeA: .86,
        _flowA: .88,
        _persp: 1.6,
        _spike: .85,
        _mistA: 1.76,
        _mistGrain: .55,
        _mistLayers: 4,
        _mistRise: 210
    };
    const MOBILE = matchMedia("(max-width: 820px)").matches || navigator.maxTouchPoints > 1;
    const PREVIEW_Q = MOBILE ? .1 : .16;
    if (MOBILE) {
        VIEW_DEFAULTS._dust = 45e3;
        VIEW_DEFAULTS._bed = 32e3;
        VIEW_DEFAULTS._bright = 700;
        RIVER_TUNED.linesPerCluster = 26;
    }
    const BASE = {
        ...RIVER_DEFAULTS,
        ...RIVER_TUNED,
        ...FIELD_DEFAULTS,
        ...VIEW_DEFAULTS,
        taperMin: .34,
        nearFadeStart: .94,
        farFadeSpan: .62,
        gatherAmp: .75,
        wave1Amp: 700,
        wave1Cyc: .75,
        widthWaveAmp: .2,
        wave2Amp: 40,
        wave3Amp: 20,
        drift: 250,
        wave1Shear: .1,
        wave2Shear: .16,
        wave3Shear: .4
    };
    Object.assign(BASE, {
        halfWidth: 1280,
        wave1Cyc: 2.8,
        islandPush: 0,
        zFar: -8800
    });
    BASE.taperNear = 1 - BASE.taperFar;
    const state = {
        ...BASE,
        ...overrides
    };
    const fieldParams = () => {
        const P = {};
        for (const k of Object.keys(FIELD_DEFAULTS)) P[k] = state[k];
        return P;
    };
    const PALETTE = [ new THREE.Color(16774135), new THREE.Color(16763357), new THREE.Color(13219570), new THREE.Color(10470640), new THREE.Color(16766628) ];
    function palUniforms(mixIdx, mix) {
        return {
            uP0: {
                value: PALETTE[0]
            },
            uP1: {
                value: PALETTE[1]
            },
            uP2: {
                value: PALETTE[2]
            },
            uP3: {
                value: PALETTE[3]
            },
            uP4: {
                value: PALETTE[4]
            },
            uMixIdx: {
                value: mixIdx
            },
            uMix: {
                value: mix
            }
        };
    }
    const PAL_GLSL = `\n  uniform vec3 uP0, uP1, uP2, uP3, uP4; uniform float uMixIdx, uMix;\n  vec3 palAt(float k){ if(k<0.5) return uP0; if(k<1.5) return uP1; if(k<2.5) return uP2;\n                       if(k<3.5) return uP3; return uP4; }\n`;
    function buildBedMesh() {
        const P = river.params, NT = 260, NU = 96, US = ftable.uSpan;
        const pos = [], uv = [], idx = [];
        for (let j = 0; j <= NU; j++) {
            const u = (j / NU * 2 - 1) * US;
            for (let i = 0; i <= NT; i++) {
                const t = i / NT;
                const w = riverPointAt(t, u, P);
                pos.push(w.x, 0, w.z);
                uv.push(t, u / US * .5 + .5);
            }
        }
        const row = NT + 1;
        for (let j = 0; j < NU; j++) for (let i = 0; i < NT; i++) {
            const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
            idx.push(a, c, b, b, c, d);
        }
        const geo = new THREE.BufferGeometry;
        geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        geo.setIndex(idx);
        const rgba = ftable.toRGBA();
        const tex = new THREE.DataTexture(rgba.data, rgba.width, rgba.height, THREE.RGBAFormat);
        tex.minFilter = tex.magFilter = THREE.LinearFilter;
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.needsUpdate = true;
        const mats = [], meshes = [], N = Math.max(1, Math.round(state._mistLayers));
        for (let L = 0; L < N; L++) {
            const lz = N === 1 ? 0 : L / (N - 1);
            const mat = new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                uniforms: {
                    uEndSoft: {
                        value: 0
                    },
                    uField: {
                        value: tex
                    },
                    uA: {
                        value: state._mistA
                    },
                    uGrain: {
                        value: state._mistGrain
                    },
                    uLayer: {
                        value: lz
                    },
                    ...palUniforms(0, 0)
                },
                vertexShader: `\n      varying vec2 vUv;\n      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
                fragmentShader: PAL_GLSL + `\n      uniform float uEndSoft; uniform sampler2D uField; uniform float uA; uniform float uGrain; uniform float uLayer;\n      varying vec2 vUv;\n      // 一点高频抖动：纯插值出来的面太"塑料"，加了才有星云的颗粒呼吸感\n      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n      void main(){\n        vec4 f = texture2D(uField, vUv);\n        float d = f.r, ridge = f.g, cloud = f.b, env = f.a;\n        // 雾面只吃【包络 × 雾团】这两个低频量。含丝的 d 一旦画上来，\n        // 平滑插值会把丝变成绸缎（8-26 实拍）；丝归粒子层。\n        float mist = env * cloud;\n        if (mist < 0.006) discard;\n        // 配色跟着场走：脊上偏珍珠白，雾团里偏粉，岸外转淡紫冷蓝\n        vec3 c = mix(uP2, uP1, clamp(cloud * 1.25, 0.0, 1.0));\n        c = mix(c, uP0, clamp(cloud * 1.6 - 0.55, 0.0, 1.0) * 0.6);\n        c = mix(c, uP3, clamp(0.62 - env, 0.0, 1.0) * 0.7);   // 岸外转冷\n        float g = mix(1.0, 0.55 + 0.9 * h(floor(vUv * vec2(760.0, 300.0))), uGrain);\n        // 越往上越淡、越只剩雾团的低频（高层不该还有清晰的丝）\n        float body = mist * mix(1.0, cloud, uLayer * 0.9);\n        float lay = (1.0 - uLayer * 0.72) / (1.0 + uLayer * 1.6);\n        // 指数 1.4 而不是 2.0：暗处仍要压下去，但中等密度得留住，\n        // 平方会把整片雾压没（8-26 实拍：雾面几乎看不见）\n        // 指数 2.1：雾必须大部分是暗的，参考图七成画面是安静的暗部。\n        // 太低的指数会让整片发灰发白（8-26 实拍：1.4 就白了）。\n        gl_FragColor = vec4(c, pow(body, 1.8) * uA * g * lay * mix(1.0, smoothstep(0.0,0.20,vUv.x)*(1.0-smoothstep(0.72,1.0,vUv.x)), uEndSoft));\n      }`
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.y = lz * state._mistRise;
            mats.push(mat);
            meshes.push(mesh);
        }
        return {
            meshes: meshes,
            mats: mats,
            tex: tex
        };
    }
    const allMats = [];
    function pointsMaterial(sizeMul = 1, alphaMul = 1, mixIdx = 0, mix = 0, spike = 0) {
        const m = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: {
                uScale: {
                    value: innerHeight * .9
                },
                uSizeMul: {
                    value: sizeMul
                },
                uAlphaMul: {
                    value: alphaMul
                },
                uSpike: {
                    value: spike
                },
                uMidLift: {
                    value: 0
                },
                uEndSoft: {
                    value: 0
                },
                uZBounds: {
                    value: new THREE.Vector2(state.zFar, state.zNear)
                },
                uAngleDepth: {
                    value: 0
                },
                uViewDistance: {
                    value: 4e3
                },
                uBokeh: {
                    value: state._bokeh
                },
                uFocus: {
                    value: state._focus
                },
                ...palUniforms(mixIdx, mix)
            },
            vertexShader: PAL_GLSL + `\n      attribute float aSize; attribute float aAlpha; attribute float aKey; attribute float aTint;\n      varying vec3 vC; varying float vA; varying float vSoft;\n      uniform float uScale; uniform float uSizeMul; uniform float uAlphaMul;\n      uniform float uBokeh; uniform float uFocus;\n      uniform float uAngleDepth; uniform float uViewDistance; uniform float uMidLift; uniform float uEndSoft; uniform vec2 uZBounds;\n      void main(){\n        vC = mix(palAt(aKey), palAt(uMixIdx), uMix) * aTint;\n        vec4 mv = modelViewMatrix * vec4(position, 1.0);\n        float depth = max(1.0, -mv.z);\n        // near: 0=在焦平面或更远，1=贴到镜头前\n        float near = clamp((uFocus - depth) / uFocus, 0.0, 1.0);\n        float blur = near * near * uBokeh;          // 平方：只有真的很近才明显散开\n        float grow = 1.0 + blur * 3.4;\n        vSoft = mix(2.2, 0.42, clamp(blur, 0.0, 1.0));   // 指数越小，光斑越扁平越糊\n        vA = aAlpha * uAlphaMul / (1.0 + blur * 2.6);    // 摊大就摊薄，能量守恒\n        // Only river layers opt in. Fade compressed far-field energy, preserving nearby pearls.\n        float farBlend = smoothstep(uViewDistance * 0.75, uViewDistance * 1.9, depth);\n        vA *= 1.0 - uAngleDepth * farBlend;\n        float riverT = clamp((position.z-uZBounds.x)/(uZBounds.y-uZBounds.x),0.0,1.0);\n        float midLift=smoothstep(0.06,0.28,riverT)*(1.0-smoothstep(0.44,0.64,riverT));\n        vA *= 1.0 + uMidLift * midLift;\n        float tail = smoothstep(0.0,0.17,riverT) * (1.0-smoothstep(0.76,1.0,riverT));\n        vA *= mix(1.0, tail*tail, uEndSoft);\n        // Original density favors t=1; restore some balance when looking from t=0.\n        float balance = clamp(pow(0.92/(0.42+riverT),0.55),0.80,1.35);\n        vA *= mix(1.0,balance,uEndSoft);\n        gl_PointSize = max(1.0, aSize * uSizeMul * grow * uScale / depth);\n        gl_Position = projectionMatrix * mv; }`,
            fragmentShader: `\n      varying vec3 vC; varying float vA; varying float vSoft;\n      uniform float uSpike;\n      void main(){\n        vec2 p = gl_PointCoord - 0.5;\n        float d = length(p);\n        if (d > 0.5) discard;\n        // 带芒的点核心要【小而锐】：芒长靠 gl_PointSize 撑开，核心得收住，\n        // 否则点一放大就是个糊球，把画面淹掉（8-26 实拍教训）。\n        float a = pow(max(0.0, 1.0 - d * 2.0), uSpike > 0.0 ? vSoft + 7.0 : vSoft);\n        if (uSpike > 0.0) {\n          // 十字主芒 + 45° 副芒：沿一轴极细、沿另一轴长而衰减\n          float sx = exp(-abs(p.y) * 150.0) * exp(-abs(p.x) * 5.5);\n          float sy = exp(-abs(p.x) * 150.0) * exp(-abs(p.y) * 5.5);\n          vec2 q = vec2(p.x + p.y, p.x - p.y) * 0.70711;\n          float dx = exp(-abs(q.y) * 190.0) * exp(-abs(q.x) * 7.0);\n          float dy = exp(-abs(q.x) * 190.0) * exp(-abs(q.y) * 7.0);\n          a += ((sx + sy) * 0.85 + (dx + dy) * 0.30) * uSpike;\n        }\n        gl_FragColor = vec4(vC, a * vA); }`
        });
        allMats.push(m);
        return m;
    }
    function lineMaterial(alphaMul = 1) {
        return new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: {
                uKnee: {
                    value: state._filaKnee
                },
                uCleanRoot: {
                    value: 0
                },
                uRoot: {
                    value: new THREE.Vector2(riverCenter(state.islandT, state).x, riverCenter(state.islandT, state).z)
                },
                uMidLift: {
                    value: 0
                },
                uEndSoft: {
                    value: 0
                },
                uZBounds: {
                    value: new THREE.Vector2(state.zFar, state.zNear)
                },
                uAlphaMul: {
                    value: alphaMul
                },
                ...palUniforms(0, 0)
            },
            vertexShader: PAL_GLSL + `\n      attribute float aAlpha; attribute float aKey; attribute float aTint;\n      varying vec2 vRootXZ; varying vec3 vC; varying float vA; uniform float uAlphaMul; uniform float uKnee; uniform float uMidLift; uniform float uEndSoft; uniform vec2 uZBounds;\n      void main(){ vRootXZ = position.xz; vC = palAt(aKey) * aTint; vA = aAlpha * uAlphaMul;\n        float t = clamp((position.z-uZBounds.x)/(uZBounds.y-uZBounds.x),0.0,1.0);\n        float midLift=smoothstep(0.06,0.28,t)*(1.0-smoothstep(0.44,0.64,t));\n        vA *= 1.0 + uMidLift * midLift;\n        float tail = smoothstep(0.0,0.12,t)*(1.0-smoothstep(0.82,1.0,t));\n        vA *= mix(1.0,tail,uEndSoft);\n        vA = vA / (1.0 + uKnee * vA);   // 压暗突兀亮丝：越亮压得越狠，暗丝几乎不动\n        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `\n      varying vec3 vC; varying float vA;\n      varying vec2 vRootXZ; uniform vec2 uRoot; uniform float uCleanRoot;\n      void main(){\n        float radius = length((vRootXZ-uRoot)/vec2(560.0,300.0));\n        float rootFade = smoothstep(0.82,1.35,radius);\n        gl_FragColor = vec4(vC, vA * mix(1.0,rootFade,uCleanRoot));\n      }`
        });
    }
    function buildFilaments() {
        const P = river.params;
        const pos = [], key = [], tint = [], alp = [];
        const seedC = ftable.buildCdf((k, T) => {
            const ti = (k % T.nt + .5) / T.nt;
            return T.d[k] * Math.pow(T.ridge[k], state._filaRidge) * Math.pow(.42 + ti, state._persp);
        });
        const seeds = [];
        const cap = state._filaCap | 0, cellN = new Map;
        if (seedC.total > 0) for (let i = 0, tries = 0; i < state._filaN && tries < state._filaN * 4; tries++) {
            const s = ftable.pick(seedC);
            if (cap > 0) {
                const ck = (s.t * 96 | 0) * 64 + ((s.u / ftable.uSpan * .5 + .5) * 64 | 0), c = cellN.get(ck) || 0;
                if (c >= cap) continue;
                cellN.set(ck, c + 1);
            }
            seeds.push(s);
            i++;
        }
        for (const s of seeds) {
            let t = s.t, u = s.u;
            const dir = Math.random() < .5 ? 1 : -1;
            const steps = 5 + (Math.random() * 26 | 0);
            const k = Math.random() < state._warm * .6 ? 4 : s.ridge > .6 ? 0 : Math.random() < .5 ? 1 : 2;
            const tn = .62 + .55 * s.ridge;
            const y = (Math.abs(u) * 7919 % 1 - .5) * state._thick * .7;
            let prev = riverPointAt(t, u, P);
            for (let i = 0; i < steps; i++) {
                const dt = dir * .0042 * (.6 + Math.random() * .9);
                const du = .014;
                const lo = ftable.at(t + dt, u - du), mid = ftable.at(t + dt, u), hi = ftable.at(t + dt, u + du);
                if (lo.ridge > mid.ridge && lo.ridge >= hi.ridge) u -= du * .75; else if (hi.ridge > mid.ridge) u += du * .75;
                t += dt;
                if (t <= .002 || t >= .998) break;
                const f = ftable.at(t, u);
                if (f.dn <= .05) break;
                const w = riverPointAt(t, u, P);
                const endFade = Math.min(1, (i + 1) / 3.5) * Math.min(1, (steps - i) / 4);
                const a = f.dn * (.35 + .65 * f.ridge) * endFade;
                pos.push(prev.x, y, prev.z, w.x, y, w.z);
                key.push(k, k);
                tint.push(tn, tn);
                alp.push(a, a * .96);
                prev = w;
            }
        }
        const geo = new THREE.BufferGeometry;
        geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute("aKey", new THREE.Float32BufferAttribute(key, 1));
        geo.setAttribute("aTint", new THREE.Float32BufferAttribute(tint, 1));
        geo.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alp, 1));
        return geo;
    }
    let group = null, river = null, treeGroup = null, ftable = null;
    var pMask = null, pMaskOn = false;
    const layers = {};
    const LIVE = new Set([ "_fila", "_starA", "_dustA", "_flowA", "_bedA", "_hazeA", "_spike", "_mistA", "_mistGrain", "_bloom", "_bloomR", "_bloomT", "_bokeh", "_focus" ]);
    function applyLive() {
        const g = state._riverA ?? 1;
        if (layers.fila) {
            layers.fila.uniforms.uAlphaMul.value = state._fila * g;
            layers.fila.uniforms.uKnee.value = state._filaKnee;
        }
        if (layers.stars) layers.stars.uniforms.uAlphaMul.value = state._starA * g;
        if (layers.glow) layers.glow.uniforms.uAlphaMul.value = .1 * state._starA * g;
        if (layers.bright) layers.bright.uniforms.uAlphaMul.value = state._starA * .9 * g;
        if (layers.mid) layers.mid.uniforms.uAlphaMul.value = state._starA * .45 * g;
        for (const m of allMats) if (m.uniforms.uSpike && m.uniforms.uSpike.value > 0) m.uniforms.uSpike.value = state._spike * (m === layers.mid ? .55 : 1);
        if (layers.dust) layers.dust.uniforms.uAlphaMul.value = state._dustA * g;
        if (layers.flow) layers.flow.uniforms.uAlphaMul.value = state._flowA * g;
        if (layers.bed) layers.bed.uniforms.uAlphaMul.value = state._bedA * g;
        if (layers.haze) layers.haze.uniforms.uAlphaMul.value = state._hazeA * g;
        if (layers.mistMats) for (const m of layers.mistMats) {
            m.uniforms.uA.value = state._mistA * g;
            m.uniforms.uGrain.value = state._mistGrain;
        }
        for (const m of allMats) {
            if (m.uniforms.uBokeh) m.uniforms.uBokeh.value = state._bokeh;
            if (m.uniforms.uFocus) m.uniforms.uFocus.value = state._focus;
        }
        bloomPass.strength = state._bloom;
        bloomPass.radius = state._bloomR;
        bloomPass.threshold = state._bloomT;
    }
    function sampleFromField(count, opt = {}) {
        const P = river.params;
        const pos = [], key = [], tint = [], siz = [], alp = [];
        const rb = opt.ridgeBias ?? 0;
        const persp = opt.persp ?? state._persp;
        const C = ftable.buildCdf((k, T) => {
            let w = T.d[k];
            if (!w) return 0;
            if (rb > 0) w *= Math.pow(T.ridge[k], rb * 3); else if (rb < 0) w *= Math.pow(1 - T.ridge[k] * .85, -rb * 2);
            if (pMaskOn && pMask && T.wx) {
                w *= maskAtWorld(T.wx[k], T.wz[k]);
                if (!w) return 0;
            }
            if (persp > 0) {
                const ti = (k % T.nt + .5) / T.nt;
                w *= Math.pow(.42 + ti, persp);
            }
            return w;
        });
        const pts = [];
        if (C.total > 0) for (let i = 0; i < count; i++) pts.push(ftable.pick(C));
        const jitter = opt.jitter ?? 0;
        const thickMul = opt.thickMul ?? 1;
        for (const p of pts) {
            const w = riverPointAt(p.t, p.u, P);
            const th = state._thick * thickMul * (1 - .55 * Math.min(1, p.edge));
            pos.push(w.x + (Math.random() - .5) * jitter, (Math.random() + Math.random() - 1) * th, w.z + (Math.random() - .5) * jitter);
            key.push(opt.keyFn ? opt.keyFn(p) : pickKey(p));
            tint.push(opt.tintFn ? opt.tintFn(p) : .55 + .45 * p.cloud);
            siz.push(opt.sizeFn ? opt.sizeFn(p) : 1);
            alp.push(opt.alphaFn ? opt.alphaFn(p) : p.d);
        }
        const geo = new THREE.BufferGeometry;
        geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute("aKey", new THREE.Float32BufferAttribute(key, 1));
        geo.setAttribute("aTint", new THREE.Float32BufferAttribute(tint, 1));
        geo.setAttribute("aSize", new THREE.Float32BufferAttribute(siz, 1));
        geo.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alp, 1));
        return {
            geo: geo,
            count: pts.length
        };
    }
    function pickKey(p) {
        if (Math.random() < state._warm) return 4;
        const r = Math.random();
        if (p.ridge > .55) return r < .72 ? 0 : 1;
        if (p.edge > .85) return r < .45 ? 3 : 2;
        return r < .34 ? 0 : r < .72 ? 1 : 2;
    }
    function buildTree(TREE, scale) {
        const g = new THREE.Group;
        if (scale <= 0) {
            g.position.copy(TREE);
            return g;
        }
        const segs = [], tips = [];
        let s = 8675309;
        const rnd = () => (s = s * 1103515245 + 12345 & 2147483647) / 2147483647;
        (function branch(p, dir, len, depth, thick) {
            const e = p.clone().addScaledVector(dir, len);
            const n = Math.max(1, Math.round(thick));
            const side = new THREE.Vector3(-dir.z, 0, dir.x);
            if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
            side.normalize();
            const up2 = (new THREE.Vector3).crossVectors(dir, side).normalize();
            for (let i = 0; i < n; i++) {
                const a = (n === 1 ? 0 : i / (n - 1) - .5) * thick * 1.5;
                const b = (rnd() - .5) * thick * 1.5;
                const o = side.clone().multiplyScalar(a).addScaledVector(up2, b);
                segs.push(p.x + o.x, p.y + o.y, p.z + o.z, e.x + o.x * .72, e.y + o.y * .72, e.z + o.z * .72);
            }
            if (depth >= 7) {
                tips.push(e.clone());
                return;
            }
            const k = depth < 2 ? 2 : rnd() < .62 ? 2 : 3;
            for (let i = 0; i < k; i++) {
                const d = dir.clone();
                d.x += (rnd() - .5) * (depth < 2 ? .95 : 1.5);
                d.z += (rnd() - .5) * (depth < 2 ? .95 : 1.5);
                d.y += (rnd() - .52) * .5;
                branch(e, d.normalize(), len * (.68 + rnd() * .13), depth + 1, thick * .62);
            }
        })(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 360 * scale, 0, 22 * scale);
        const geo = new THREE.BufferGeometry;
        geo.setAttribute("position", new THREE.Float32BufferAttribute(segs, 3));
        g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
            color: 16773370,
            transparent: true,
            opacity: .52,
            blending: THREE.AdditiveBlending
        })));
        const cp = [], ck = [], ct = [], cs = [], ca = [];
        for (let i = 0; i < 5200 && tips.length; i++) {
            const tip = tips[Math.random() * tips.length | 0];
            const r = Math.pow(Math.random(), .6) * 95 * scale;
            const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1);
            cp.push(tip.x + Math.cos(a) * Math.sin(b) * r, tip.y + Math.cos(b) * r, tip.z + Math.sin(a) * Math.sin(b) * r);
            ck.push(Math.random() < .72 ? 0 : 1);
            ct.push(.7 + Math.random() * .6);
            cs.push(1.5 + Math.random() * 3.4);
            ca.push(.22 + Math.random() * .52);
        }
        const cg = new THREE.BufferGeometry;
        cg.setAttribute("position", new THREE.Float32BufferAttribute(cp, 3));
        cg.setAttribute("aKey", new THREE.Float32BufferAttribute(ck, 1));
        cg.setAttribute("aTint", new THREE.Float32BufferAttribute(ct, 1));
        cg.setAttribute("aSize", new THREE.Float32BufferAttribute(cs, 1));
        cg.setAttribute("aAlpha", new THREE.Float32BufferAttribute(ca, 1));
        g.add(new THREE.Points(cg, pointsMaterial()));
        g.position.copy(TREE);
        return g;
    }
    let angleEnabled = true;
    let refineEnds = true;
    let liftFibers = true;
    const angleVector = new THREE.Vector3;
    function applyAngleReadability() {
        applyLive();
        angleVector.subVectors(camera.position, controls.target);
        const distance = angleVector.length();
        const elevation = Math.abs(angleVector.y) / Math.max(1, distance);
        const low = angleEnabled ? 1 - THREE.MathUtils.smoothstep(elevation, .12, .82) : 0;
        const weights = {
            dust: .62,
            flow: .38,
            bed: .62,
            haze: .78,
            glow: .72,
            stars: .2,
            mid: .4,
            bright: .44
        };
        for (const [name, reduction] of Object.entries(weights)) {
            const m = layers[name];
            if (!m) continue;
            m.uniforms.uAlphaMul.value *= 1 - low * reduction;
            m.uniforms.uAngleDepth.value = low * (name === "flow" ? refineEnds ? .3 : .48 : .6);
            m.uniforms.uEndSoft.value = +state._endSoft || 0;
            if (m.uniforms.uMidLift) m.uniforms.uMidLift.value = liftFibers && name === "flow" ? .65 : 0;
            m.uniforms.uViewDistance.value = distance;
            m.uniforms.uBokeh.value = state._bokeh * (1 - low * .65);
        }
        if (layers.fila) {
            layers.fila.uniforms.uAlphaMul.value *= 1 + low * (refineEnds ? .65 : .3);
            layers.fila.uniforms.uEndSoft.value = +state._endSoft || 0;
            layers.fila.uniforms.uCleanRoot.value = 0;
            layers.fila.uniforms.uMidLift.value = liftFibers ? 1.1 : 0;
        }
        for (const m of layers.mistMats || []) {
            m.uniforms.uEndSoft.value = +state._endSoft || 0;
            m.uniforms.uA.value *= 1 - low * (.32 + .42 * m.uniforms.uLayer.value);
        }
    }
    const SCALE = 5.2 / 1550;
    const root = new THREE.Group;
    root.name = "approved-v8-pearl-river";
    river = buildRiver(state);
    ftable = opt.preview ? new FieldTable(fieldParams(), 256, 102, 1.55) : new FieldTable(fieldParams(), 640, 256, 1.55);
    ftable.buildWorldXZ((t, u) => riverPointAt(t, u, river.params));
    group = new THREE.Group;
    root.add(group);
    const preview = !!opt.preview, quality = preview ? PREVIEW_Q : 1;
    let starCount = 0;
    layers.fila = lineMaterial(state._fila);
    group.add(new THREE.LineSegments(buildFilaments(), layers.fila));
    {
        const bed = buildBedMesh();
        layers.mistMats = bed.mats;
        for (const m of bed.meshes) group.add(m);
    }
    if (state._bed > 0 && !preview) {
        const bed = sampleFromField(state._bed, {
            ridgeBias: -.25,
            uSpan: 1.8,
            thickMul: .9,
            jitter: 40,
            sizeFn: () => 3.5 + Math.random() * 9,
            alphaFn: p => (.055 + .075 * Math.random()) * (.28 + .72 * p.cloud),
            tintFn: p => .34 + .34 * p.cloud
        });
        layers.bed = pointsMaterial(1, state._bedA, 2, .3);
        group.add(new THREE.Points(bed.geo, layers.bed));
    }
    const dust = sampleFromField(Math.round(state._dust * quality), {
        ridgeBias: .05,
        jitter: 14,
        sizeFn: () => .75 + Math.random() * 1.5,
        alphaFn: p => (.07 + .15 * Math.random()) * (.45 + .55 * p.dn)
    });
    layers.dust = pointsMaterial(1, state._dustA, 0, .42);
    group.add(new THREE.Points(dust.geo, layers.dust));
    const flow = sampleFromField(Math.round(state._flow * quality), {
        ridgeBias: .9,
        jitter: 9,
        sizeFn: () => 1.5 + Math.random() * 2.9,
        alphaFn: p => (.42 + .46 * Math.random()) * (.3 + .7 * p.dn),
        tintFn: p => .85 + .55 * p.ridge,
        keyFn: p => Math.random() < .3 ? 4 : Math.random() < .5 ? 0 : 1
    });
    layers.flow = pointsMaterial(1, state._flowA, 0, .25);
    group.add(new THREE.Points(flow.geo, layers.flow));
    if (!preview) {
        const haze = sampleFromField(state._haze, {
            ridgeBias: -.15,
            uSpan: 1.9,
            thickMul: .7,
            jitter: 130,
            sizeFn: () => 46 + Math.random() * 130,
            alphaFn: p => (.022 + .03 * Math.random()) * (.22 + .78 * p.cloud),
            tintFn: p => .72 + .38 * p.cloud
        });
        layers.haze = pointsMaterial(1, state._hazeA, 2, .35);
        group.add(new THREE.Points(haze.geo, layers.haze));
    }
    const stars = sampleFromField(Math.round(state._n * quality), {
        ridgeBias: .28,
        jitter: 8,
        sizeFn: () => Math.random() < .02 ? 4 + Math.random() * 6 : 1.1 + Math.random() * 1.6,
        alphaFn: p => (.6 + .4 * Math.random()) * (.35 + .65 * p.dn),
        tintFn: p => .75 + .55 * Math.random()
    });
    if (!preview) {
        layers.glow = pointsMaterial(5.5, .1 * state._starA);
        group.add(new THREE.Points(stars.geo, layers.glow));
    }
    layers.stars = pointsMaterial(1, state._starA);
    group.add(new THREE.Points(stars.geo, layers.stars));
    starCount = stars.count;
    if (!preview && state._spike > 0) {
        const mid = sampleFromField(Math.round(state._bright * 3.2), {
            ridgeBias: .5,
            jitter: 8,
            sizeFn: () => 4 + Math.random() * 8,
            alphaFn: p => (.3 + .3 * Math.random()) * (.4 + .6 * p.dn),
            tintFn: () => .9 + Math.random() * .4,
            keyFn: () => Math.random() < state._warm * 2.2 ? 4 : Math.random() < .7 ? 0 : 1
        });
        layers.mid = pointsMaterial(1, state._starA * .45, 0, 0, state._spike * .55);
        group.add(new THREE.Points(mid.geo, layers.mid));
    }
    if (state._bright > 0 && !preview) {
        const bright = sampleFromField(state._bright, {
            ridgeBias: .9,
            jitter: 6,
            sizeFn: () => 10 + Math.random() * 18,
            alphaFn: p => (.75 + .25 * Math.random()) * (.4 + .6 * p.dn),
            tintFn: () => 1.15 + Math.random() * .5,
            keyFn: p => Math.random() < .62 ? 0 : Math.random() < state._warm * 3 ? 4 : 1
        });
        layers.bright = pointsMaterial(1, state._starA * .9, 0, 0, state._spike);
        group.add(new THREE.Points(bright.geo, layers.bright));
    }
    const isle = riverCenter(state.islandT, river.params);
    root.scale.setScalar(SCALE);
    root.position.set(-isle.x * SCALE, -2.43, -isle.z * SCALE);
    const branch = buildTree(new THREE.Vector3(isle.x, 0, isle.z), state._tree);
    root.add(branch);
    branch.visible = false;
    const cdf = ftable.buildCdf((k, T) => T.d[k] * (.4 + .6 * T.ridge[k]));
    function pick(id) {
        let seed = 2166136261;
        for (const c of String(id)) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
        const rnd = () => {
            seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
            return seed / 4294967296;
        };
        const f = ftable.pick(cdf, rnd);
        const g = Math.max(0, Math.min(1, +state._memGather || 0));
        let ft = f.t;
        if (g > 0) {
            const c0 = +river.params.islandT, d = ft - c0;
            ft = Math.max(0, Math.min(1, c0 + Math.sign(d) * Math.pow(Math.abs(d), 1 + g * 3.5)));
        }
        const q = riverPointAt(ft, f.u, river.params);
        return {
            x: q.x * SCALE + root.position.x,
            y: -2.39,
            z: q.z * SCALE + root.position.z,
            fade: 1,
            key: 0,
            core: false,
            t: ft
        };
    }
    function update() {
        if (!root.visible) return;
        applyAngleReadability();
        for (const m of allMats) {
            m.uniforms.uScale.value = innerHeight * .9 * SCALE;
            m.uniforms.uFocus.value = state._focus * SCALE;
        }
    }
    function dispose() {
        root.traverse(o => {
            o.geometry?.dispose();
            if (o.material) {
                for (const m of Array.isArray(o.material) ? o.material : [ o.material ]) m.dispose();
            }
        });
        root.removeFromParent();
    }
    return {
        root: root,
        branch: branch,
        pick: pick,
        update: update,
        state: state,
        defaults: BASE,
        palette: PALETTE,
        applyLive: applyLive,
        dispose: dispose
    };
}