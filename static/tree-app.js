import * as THREE from "three";
import { createWardrobePearl } from "/static/lib/wardrobe-pearl.js?v=20260919-yuyu";
var wardrobePearl = null, pearlEnabled = true, pearlBranch = false;
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createClawdWardrobe, outfitNames } from "/static/clawd/20260915-v6/wardrobe.skin.js";
import { createTreeAmbient, AMBIENT_DEFAULTS } from "/static/lib/tree-ambient.js?v=20260915-lonely-soft";
import { buildRiver, riverCenter, RIVER_DEFAULTS } from "/static/lib/river.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { CopyShader } from "three/addons/shaders/CopyShader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { readMemoryQuery, memoryMatches, memoryDomains, memoryMonths, monthRange, updateMemoryUrl, copyMemoryUrl } from "/static/lib/memory-tree-tools.js?v=3";
const treeSidePanel = document.getElementById("treeSidePanel"), treeSideToggle = document.getElementById("treeSideToggle");
const visitorModeBtn = document.getElementById("visitorModeBtn"), visitorClawdToggle = document.getElementById("visitorClawdToggle");
let clawdGlowIn = (() => {
    try {
        const v = parseFloat(localStorage.getItem("memoryTreeClawdGlow"));
        return v >= 0 && v <= 1 ? v : .55;
    } catch (e) {
        return .55;
    }
})();
let clawdBright = (() => {
    try {
        const v = parseFloat(localStorage.getItem("memoryTreeClawdBright"));
        return v > 0 ? v : 1;
    } catch (e) {
        return 1;
    }
})();
let clawdUserOff = (() => {
    try {
        return localStorage.getItem("memoryTreeClawdOff") === "1";
    } catch (e) {
        return false;
    }
})();
const DAYLIGHT = new URLSearchParams(location.search).get("daylight") === "1";
let visitorModeOn = sessionStorage.getItem("memoryTreeVisitorMode") === "1", visitorClawdVisible = sessionStorage.getItem("memoryTreeVisitorClawd") === "1";
function safeMemoryText(kind = "text") {
    return kind === "title" ? "一段被珍藏的记忆" : kind === "tag" ? "隐私标签" : kind === "date" ? "日期已隐藏" : "这段内容已在访客模式中隐藏。";
}
function setVisitorMode(on, refresh = true) {
    visitorModeOn = !!on;
    try {
        riverPanelVisible();
    } catch (e) {}
    document.body.classList.toggle("visitor-mode", visitorModeOn);
    visitorModeBtn.classList.toggle("on", visitorModeOn);
    visitorModeBtn.textContent = visitorModeOn ? "▣ 访客模式：开启" : "▣ 访客模式：关闭";
    try {
        sessionStorage.setItem("memoryTreeVisitorMode", visitorModeOn ? "1" : "0");
    } catch (e) {}
    if (refresh) refreshPrivacySurfaces();
}
function setVisitorClawdVisible(on, refresh = true) {
    visitorClawdVisible = !!on;
    visitorClawdToggle.checked = visitorClawdVisible;
    try {
        sessionStorage.setItem("memoryTreeVisitorClawd", visitorClawdVisible ? "1" : "0");
    } catch (e) {}
    if (refresh) refreshPrivacySurfaces();
}
visitorModeBtn.onclick = () => setVisitorMode(!visitorModeOn);
visitorClawdToggle.onchange = () => setVisitorClawdVisible(visitorClawdToggle.checked);
visitorClawdToggle.checked = visitorClawdVisible;
setVisitorMode(visitorModeOn, false);
[ ".info", ".quick-actions", ".forms-key", ".memory-count", ".star-size-pop", ".ring-panel", ".dock" ].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) treeSidePanel.appendChild(el);
});
(function organizeTreePanel() {
    const P = treeSidePanel, byId = id => document.getElementById(id);
    const mk = (key, title) => {
        const d = document.createElement("details");
        d.className = "pg";
        d.dataset.group = key;
        d.innerHTML = `<summary>${title}</summary><div class="pg-body"></div>`;
        return d;
    };
    const groups = {
        daily: mk("daily", "日常"),
        tree: mk("tree", "树 · 模型与枝叶"),
        ring: mk("ring", "记忆星 · 星环与形态"),
        river: mk("river", "河 · 模式与控台"),
        sky: mk("sky", "星空 · 光色与朝向"),
        clawd: mk("clawd", "Clawd"),
        show: mk("show", "展示 · 临时功能")
    };
    groups.daily.open = true;
    const body = k => groups[k].querySelector(".pg-body");
    const into = (target, el) => {
        if (el) (target instanceof Element ? target : body(target)).appendChild(el);
    };
    const box = (k, cls, title) => {
        const d = document.createElement("div");
        d.className = cls;
        if (title) {
            d.dataset.curate = k + ":" + title;
            const h = document.createElement("h4");
            h.className = "pg-h";
            h.textContent = title;
            d.appendChild(h);
        }
        body(k).appendChild(d);
        return d;
    };
    const ringLabel = key => {
        const i = document.querySelector(`#ringPanel [data-ring="${key}"],#ringPanel [data-ringc="${key}"]`);
        return i ? i.closest("label") : null;
    };
    into("daily", byId("memoryCount"));
    const dr = box("daily", "pg-row");
    [ "memorySearchBtn", "treeChatBtn", "resetViewBtn", "pauseRotateBtn" ].forEach(id => into(dr, byId(id)));
    into("daily", document.querySelector(".visitor-controls"));
    {
        const tip = document.createElement("small");
        tip.className = "pg-tip";
        tip.textContent = "🌸 戳树干靠近根部三下会摇落一场花瓣雨，金色的花瓣捎着记忆，落地后点它";
        body("daily").appendChild(tip);
    }
    {
        const pop = document.createElement("div");
        pop.id = "musicPop";
        pop.className = "music-pop";
        into(pop, byId("musicPanel"));
        document.body.appendChild(pop);
        document.addEventListener("pointerdown", e => {
            if (pop.classList.contains("on") && !pop.contains(e.target) && e.target !== byId("treeMusicBtn")) pop.classList.remove("on");
        }, true);
    }
    {
        const cb = document.createElement("button");
        cb.type = "button";
        cb.id = "clawdOnBtn";
        cb.className = "ring-btn tune-toggle";
        cb.style.marginBottom = "8px";
        const paint = () => {
            cb.textContent = clawdUserOff ? "Clawd：躲起来了（点我叫他出来）" : "Clawd：在树下（点我让他躲起来）";
            cb.classList.toggle("on", !clawdUserOff);
        };
        paint();
        cb.onclick = () => {
            clawdUserOff = !clawdUserOff;
            try {
                localStorage.setItem("memoryTreeClawdOff", clawdUserOff ? "1" : "0");
            } catch (e) {}
            if (!clawdUserOff) {
                try {
                    clawdGroup.visible = !!active;
                } catch (e) {}
            }
            paint();
        };
        body("clawd").appendChild(cb);
    }
    {
        const d = document.createElement("div");
        d.className = "pg-tune";
        const l = document.createElement("label");
        l.textContent = "受辉光程度";
        const i = document.createElement("input");
        i.type = "range";
        i.min = "0";
        i.max = "1";
        i.step = ".05";
        i.value = clawdGlowIn;
        const o = document.createElement("output");
        o.value = (+clawdGlowIn).toFixed(2);
        i.oninput = () => {
            clawdGlowIn = +i.value;
            o.value = clawdGlowIn.toFixed(2);
            try {
                localStorage.setItem("memoryTreeClawdGlow", String(clawdGlowIn));
            } catch (e) {}
        };
        l.append(i, o);
        d.appendChild(l);
        body("clawd").appendChild(d);
    }
    {
        const d = document.createElement("div");
        d.className = "pg-tune";
        const l = document.createElement("label");
        l.textContent = "Clawd亮度";
        const i = document.createElement("input");
        i.type = "range";
        i.min = ".3";
        i.max = "1.5";
        i.step = ".05";
        i.value = clawdBright;
        const o = document.createElement("output");
        o.value = (+clawdBright).toFixed(2);
        i.oninput = () => {
            clawdBright = +i.value;
            o.value = clawdBright.toFixed(2);
            try {
                localStorage.setItem("memoryTreeClawdBright", String(clawdBright));
            } catch (e) {}
        };
        l.append(i, o);
        d.appendChild(l);
        body("clawd").appendChild(d);
    }
    into("clawd", document.querySelector(".clawd-wardrobe"));
    const tb = box("tree", "pg-row");
    into(tb, byId("pearlBranchBtn"));
    const ty = box("tree", "pg-tune", "枝条树朝向");
    ty.id = "yawBranchRows";
    const tt = box("tree", "pg-tune", "树干与枝叶");
    [ "treeGlow", "treeAlpha", "treeColor" ].forEach(k => into(tt, ringLabel(k)));
    into(tt, byId("branchPanel"));
    into(tt, byId("leafPanel"));
    const lr = box("ring", "pg-row");
    const ringB = document.createElement("button");
    ringB.className = "ring-btn tune-toggle";
    ringB.id = "layoutRingBtn";
    ringB.type = "button";
    ringB.textContent = "星环";
    ringB.onclick = () => setArchiveLayoutMode("ring");
    lr.appendChild(ringB);
    [ "waterfallModeBtn", "ringModeBtn" ].forEach(id => into(lr, byId(id)));
    into("ring", byId("formsKey"));
    const rt = box("ring", "pg-tune", "星环位置和速度");
    [ "x", "y", "size", "round", "tiltX", "tiltZ", "ringSpeed", "flowSpeed" ].forEach(k => into(rt, ringLabel(k)));
    into(rt, byId("centerRingBtn"));
    const sm = box("ring", "pg-tune", "记忆星大小与光");
    [ "starSize", "starBright", "twinkleSpeed", "ringGlow", "seedSize", "fruitSize", "dewSize" ].forEach(k => into(sm, ringLabel(k)));
    const sc = box("ring", "pg-tune", "记忆星颜色");
    [ "ringColor", "seedColor", "fruitColor", "dewColor" ].forEach(k => into(sc, ringLabel(k)));
    const rb = box("river", "pg-row");
    [ "pearlRiverBtn", "riverModeBtn" ].forEach(id => into(rb, byId(id)));
    const ry = box("river", "pg-tune", "河流朝向");
    ry.id = "yawRiverRows";
    into("river", byId("pearlPanel"));
    into("river", byId("riverPanel"));
    const skyYaw = byId("yawPanel");
    skyYaw.querySelector("h3").textContent = "背景朝向";
    skyYaw.querySelector("small").textContent = "转动星空背景，让喜欢的角度对上树。";
    into("sky", skyYaw);
    const light = box("sky", "pg-tune", "光与雾");
    [ "bloomGlow", "lightGlow", "beamGlow", "fillLight", "backFillI", "fogDensity" ].forEach(k => into(light, ringLabel(k)));
    const colors = box("sky", "pg-tune", "天空颜色");
    [ "skyColor" ].forEach(k => into(colors, ringLabel(k)));
    into(colors, byId("galaxyToggleBtn"));
    [ "galaxyBase", "galaxyNebula", "galaxyCore" ].forEach(k => into(colors, ringLabel(k)));
    {
        const tip = document.createElement("div");
        tip.className = "pg-row";
        tip.id = "riverGroupTip";
        tip.innerHTML = '<small class="pg-tip">河控台调的是珠光记忆河，切过去就能调</small>';
        const go = document.createElement("button");
        go.type = "button";
        go.className = "ring-btn tune-toggle";
        go.textContent = "切到珠光记忆河";
        go.onclick = () => {
            byId("pearlRiverBtn").click();
            setTimeout(() => window.__syncRiverGroup && window.__syncRiverGroup(), 80);
        };
        tip.appendChild(go);
        body("river").insertBefore(tip, body("river").firstChild);
        window.__syncRiverGroup = () => {
            try {
                const inPearl = archiveLayoutMode === "river" && pearlEnabled;
                tip.style.display = inPearl ? "none" : "";
                if (inPearl && groups.river.open) {
                    const rows = byId("pearlRows");
                    if (rows && !rows.children.length) buildPearlPanel();
                    riverPanelVisible();
                }
            } catch (e) {}
        };
        groups.river.addEventListener("toggle", () => {
            if (groups.river.open) window.__syncRiverGroup();
        });
    }
    const sr = box("show", "pg-row");
    [ "realMemoryBtn", "preview1000Btn", "preview10000Btn" ].forEach(id => into(sr, byId(id)));
    into("show", document.querySelector(".quick-actions"));
    const first = P.firstChild;
    Object.values(groups).forEach(g => P.insertBefore(g, first));
    [ "ringBtn", "starSizeBtn" ].forEach(id => {
        const e = byId(id);
        if (e) e.style.display = "none";
    });
    [ "ringPanel", "starSizePop" ].forEach(id => {
        const e = byId(id);
        if (e) e.classList.add("pg-empty");
    });
    Object.values(groups).forEach(g => {
        const key = "memoryTreePanelGroupV2_" + g.dataset.group;
        try {
            const v = localStorage.getItem(key);
            if (v !== null) g.open = v === "1";
        } catch (e) {}
        g.addEventListener("toggle", () => {
            try {
                localStorage.setItem(key, g.open ? "1" : "0");
            } catch (e) {}
        });
    });
    const syncLayoutBtns = () => {
        try {
            const rb = byId("layoutRingBtn");
            if (rb) rb.classList.toggle("on", archiveLayoutMode === "ring");
            const pb = byId("pearlRiverBtn");
            if (pb) pb.classList.toggle("on", archiveLayoutMode === "river");
        } catch (e) {}
    };
    setInterval(() => {
        syncLayoutBtns();
        window.__syncRiverGroup && window.__syncRiverGroup();
    }, 800);
    window.__panelGroups = () => Object.fromEntries(Object.entries(groups).map(([k, g]) => [ k, [ ...g.querySelectorAll(".pg-body > *") ].map(e => e.id || e.className || e.tagName) ]));
})();
const quickActionsEl = document.querySelector(".quick-actions");
function setTreeSide(open) {
    treeSidePanel.classList.toggle("on", open);
    treeSidePanel.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("side-open", open);
    treeSideToggle.textContent = open ? "× 收起控台" : "☰ 树控台";
}
treeSideToggle.onclick = () => setTreeSide(!treeSidePanel.classList.contains("on"));
const canvas = document.getElementById("gl"), renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
});
const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|CriOS/.test(navigator.userAgent);
const lowGpu = sessionStorage.getItem("memoryTreeLowGpu") === "1";
renderer.setPixelRatio(Math.min(devicePixelRatio, lowGpu ? 1 : isSafari ? 1.15 : 1.35));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .94;
canvas.addEventListener("webglcontextlost", e => {
    e.preventDefault();
    sessionStorage.setItem("memoryTreeLowGpu", "1");
    const recovery = +(sessionStorage.getItem("memoryTreeRecovery") || 0);
    const notice = document.getElementById("load");
    if (notice) {
        notice.style.display = "block";
        notice.textContent = recovery ? "3D 画布需要重新打开" : "正在用安全画质恢复世界树…";
    }
    if (!recovery) {
        sessionStorage.setItem("memoryTreeRecovery", "1");
        setTimeout(() => location.reload(), 700);
    }
}, false);
canvas.addEventListener("webglcontextrestored", () => location.reload(), false);
setTimeout(() => sessionStorage.removeItem("memoryTreeRecovery"), 2e4);
const scene = new THREE.Scene;
scene.background = new THREE.Color("#090512");
scene.fog = new THREE.FogExp2("#090512", .018);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .1, 100);
camera.position.set(0, 1.1, 9);
const galaxyMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: {
            value: 0
        },
        uBase: {
            value: new THREE.Color("#090512")
        },
        uNebula: {
            value: new THREE.Color("#6f416f")
        },
        uCore: {
            value: new THREE.Color("#e6cde4")
        },
        tSky: {
            value: null
        },
        tSkyAvg: {
            value: null
        },
        uSkyOn: {
            value: 0
        },
        uSkyPano: {
            value: 1
        },
        uSkyAspect: {
            value: 1
        },
        uPanoRepeat: {
            value: 1
        },
        imgAz: {
            value: 0
        },
        imgSpan: {
            value: 1.92
        },
        imgEl: {
            value: .1
        },
        imgFeather: {
            value: .31
        },
        panoTop: {
            value: 1.05
        },
        panoBottom: {
            value: -1.05
        },
        seaEl: {
            value: 0
        },
        imgGain: {
            value: 1
        },
        imgKeep: {
            value: .6
        }
    },
    vertexShader: `varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec3 vDir;uniform float uTime;uniform vec3 uBase;uniform vec3 uNebula;uniform vec3 uCore;\n  uniform sampler2D tSky;uniform sampler2D tSkyAvg;uniform float uSkyOn;uniform float uSkyPano;uniform float uSkyAspect;uniform float uPanoRepeat;uniform float imgAz;uniform float imgSpan;uniform float imgEl;uniform float imgFeather;uniform float panoTop;uniform float panoBottom;uniform float seaEl;uniform float imgGain;uniform float imgKeep;\n  vec3 nightImage(vec3 dir){\n    float az=atan(dir.x,-dir.z),el=asin(clamp(dir.y,-1.,1.));\n    if(uSkyPano>.5){\n      float x=(az-imgAz)/6.2831853+.5,tp=(el-seaEl-panoBottom)/max(panoTop-panoBottom,.01),tt=clamp(tp,.002,.998);\n      float u=fract(x),repeatN=max(1.,uPanoRepeat);\n      if(repeatN>1.5){float a=fract((x+.5/repeatN)*repeatN);u=mod(floor((x+.5/repeatN)*repeatN),2.)>.5?1.-a:a;}\n      vec3 img=texture2D(tSky,vec2(u,tt)).rgb;\n      vec3 edge=texture2D(tSkyAvg,vec2(.5,tp>.5?.985:.015)).rgb;\n      return mix(edge,img,smoothstep(0.,.12,tp)*(1.-smoothstep(.88,1.,tp)))*imgGain;\n    }\n    float du=mod(az-imgAz+3.1415927,6.2831853)-3.1415927,vspan=imgSpan/max(uSkyAspect,.01),u=du/imgSpan+.5,v=(el-seaEl-imgEl)/vspan+.5;\n    vec3 avg=texture2D(tSkyAvg,vec2(.5,clamp(v,.01,.99))).rgb,img=texture2D(tSky,vec2(clamp(u,0.,1.),clamp(v,0.,1.))).rgb;\n    float fu=max(imgFeather/imgSpan,.001),fv=max(imgFeather/vspan,.001);\n    return mix(avg,img,smoothstep(0.,fu,u)*(1.-smoothstep(1.-fu,1.,u))*smoothstep(0.,fv,v)*(1.-smoothstep(1.-fv,1.,v)))*imgGain;\n  }\n  float h(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}\n  float n(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}\n  float fbm(vec3 p){float v=0.0,a=.52;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec3(1.7,2.1,.8);a*=.50;}return v;}\n  \n  float gStarTemp;\n  float starDust(vec2 uv,vec2 scale,float threshold,float maxRadius,float salt){vec2 q=uv*scale,gid=floor(q),gf=fract(q)-.5;float seed=h(vec3(gid,salt));vec2 off=(vec2(h(vec3(gid,salt+4.0)),h(vec3(gid,salt+9.0)))-.5)*.84;float size=mix(.028,maxRadius,pow(h(vec3(gid,salt+17.0)),3.2));float soft=max(.010,size*.32);vec2 dv=gf-off;float core=smoothstep(size,size-soft,length(dv));float big=smoothstep(maxRadius*.55,maxRadius*.92,size);float flare=big*(smoothstep(size*3.6,0.0,abs(dv.x))*smoothstep(size*.30,0.0,abs(dv.y))+smoothstep(size*3.6,0.0,abs(dv.y))*smoothstep(size*.30,0.0,abs(dv.x)))*.62;gStarTemp=h(vec3(gid,salt+29.0));return (core+flare)*step(threshold,seed);}\n  void main(){vec3 skyDir=normalize(vDir),p=skyDir;float cz=cos(-.48),sz=sin(-.48);p.xy=mat2(cz,-sz,sz,cz)*p.xy;\nfloat cx=cos(.05),sx=sin(.05);\np.yz=mat2(cx,-sx,sx,cx)*p.yz;float drift=uTime*.0015;float along=atan(p.z,p.x);float cloud=fbm(p*5.4+vec3(drift,0.0,0.0));float fine=fbm(p*19.0+vec3(-drift*.7,1.4,2.0));float micro=fbm(p*47.0+vec3(.0,2.7,-drift));float warp=(cloud-.5)*.070+.016*sin(along*7.0+p.z*4.0);float signedBand=p.y+warp;float d=abs(signedBand);float halo=smoothstep(.180,.014,d);float milk=smoothstep(.062,.005,d);float bulge=exp(-pow(sin((along-.72)*.5)*2.0,2.0)/.15);float broken=.28+.72*smoothstep(.28,.72,micro);float laneA=smoothstep(.025,.004,abs(signedBand-.018-.014*sin(along*9.0+cloud*3.2)))*broken;float laneB=smoothstep(.019,.003,abs(signedBand+.032+.012*sin(along*13.0-fine*2.6)))*(.30+.70*fine);float lanes=clamp(laneA*.70+laneB*.50,0.0,.86)*halo;vec2 uv=vec2(along/6.2831853+.5,asin(clamp(p.y,-1.0,1.0))/3.1415926+.5);float ridge=1.0-abs(fbm(p*8.6+vec3(cloud*1.7,-drift*1.3,fine*1.1))*2.0-1.0);ridge=pow(clamp(ridge,0.0,1.0),2.6);float clump=smoothstep(.34,.86,fbm(p*3.2+vec3(5.2,1.4,-2.3)));float density=clamp(halo*(.30+.70*cloud)+milk*.38+bulge*milk*.18,0.0,1.0);density=clamp(density*(.55+.75*clump),0.0,1.0);float dustA=starDust(uv,vec2(760.0,380.0),.9950-density*.300,.125,7.0);float tA=gStarTemp;float dustB=starDust(uv,vec2(510.0,255.0),.9968-density*.150,.108,23.0);float tB=gStarTemp;float dustC=starDust(uv,vec2(335.0,167.5),.99900-density*.050,.090,41.0);float farDust=starDust(uv,vec2(690.0,345.0),.99860-.00030*smoothstep(.34,.74,micro),.072,61.0);float visibility=1.0-lanes;float glow=halo*(.032+.115*cloud+.046*fine)+milk*(.048+.095*bulge)+halo*ridge*(.070+.080*cloud);float ray=bulge*milk*(.45+.55*smoothstep(.30,.76,fine));float deepA=smoothstep(.36,.78,fbm(p*2.7+vec3(3.1,-1.7,.6)));float deepB=smoothstep(.43,.82,fbm(p*4.1+vec3(-2.4,4.8,1.9)));float outer=1.0-smoothstep(.12,.34,d);vec3 cool=uNebula*vec3(.92,.70,1.18),warm=uCore*vec3(1.10,.92,.72);vec3 deepCool=vec3(.030,.022,.062),deepViolet=vec3(.048,.020,.062);vec3 col=uBase*(.94+.014*micro)+deepCool*deepA*(.42+.52*outer)+deepViolet*deepB*.34+cool*glow*visibility+mix(uCore,warm,bulge)*ray*.185;vec3 tepid=mix(vec3(.72,.84,1.25),vec3(1.28,1.02,.74),smoothstep(.30,.86,tA));vec3 tepidB=mix(vec3(.80,.88,1.22),vec3(1.24,1.00,.78),smoothstep(.30,.86,tB));col+=(cool*tepid*dustA*.72+uCore*tepidB*dustB*.88+warm*dustC*1.08)*visibility+mix(deepCool,cool,.32)*farDust*.075;if(uSkyOn>.5){vec3 img=nightImage(skyDir);vec3 light=max(col-uBase*.94,vec3(0.));vec3 withImage=1.-(1.-clamp(img,0.,1.))*(1.-clamp(light,0.,1.));col=mix(col,withImage,clamp(imgKeep,0.,1.));}col+=(h(vec3(gl_FragCoord.xy,uTime))-.5)/520.0;gl_FragColor=vec4(col,1.0);}`,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false
});
const galaxySky = new THREE.Mesh(new THREE.SphereGeometry(46, 48, 32), galaxyMaterial);
galaxySky.name = "distant-memory-galaxy";
galaxySky.renderOrder = -100;
scene.add(galaxySky);
const riverPivot = new THREE.Group;
riverPivot.name = "river-yaw-pivot";
scene.add(riverPivot);
const YAW_AXIS = new THREE.Vector3(0, 1, 0);
const yawTune = (() => {
    try {
        return JSON.parse(localStorage.getItem("memoryTreeYaw") || "{}") || {};
    } catch (e) {
        return {};
    }
})();
function applyYaw() {
    galaxySky.rotation.y = (+yawTune.sky || 0) * Math.PI / 180;
    riverPivot.rotation.y = (+yawTune.river || 0) * Math.PI / 180;
}
applyYaw();
window.__cam = camera;
const controls = new OrbitControls(camera, canvas);
window.__ctrl = controls;
controls.enableDamping = true;
controls.dampingFactor = .07;
controls.autoRotate = true;
controls.autoRotateSpeed = .55;
controls.enablePan = true;
let currentTreeCenterY = .25;
const hemi = new THREE.HemisphereLight("#ead7f2", "#120719", .13);
scene.add(hemi);
const key = new THREE.DirectionalLight("#ffe7f3", 2.6);
key.position.set(-6, 7, 7);
scene.add(key);
const rim = new THREE.DirectionalLight("#8d66dc", 1.35);
rim.position.set(6, 2, -6);
scene.add(rim);
const backFill = new THREE.DirectionalLight("#ffd7e8", .55);
backFill.position.set(6, 4, -7);
scene.add(backFill);
const core = new THREE.PointLight("#ff9fd2", .12, 7, 2);
core.position.set(0, .5, 2.2);
scene.add(core);
const ringLight = new THREE.PointLight("#f7cce8", 0, 0, 1.2);
scene.add(ringLight);
const beam = new THREE.SpotLight("#ffe7f3", 0, 0, .55, .85, 1.1);
beam.position.set(-6, 7, 7);
scene.add(beam);
beam.target.position.set(0, 2, 0);
scene.add(beam.target);
const clawdGroup = new THREE.Group, clawdBaseColor = new THREE.Color("#c97968"), clawdOrangeMat = new THREE.MeshStandardMaterial({
    color: clawdBaseColor,
    emissive: "#d28fb9",
    emissiveIntensity: .09,
    roughness: .76,
    metalness: 0
}), clawdEyeMat = new THREE.MeshBasicMaterial({
    color: "#171116"
}), clawdBody = new THREE.Mesh(new THREE.BoxGeometry(1.02, .54, .28), clawdOrangeMat), clawdArms = [], clawdLegs = [], clawdEyes = [];
clawdBody.position.set(0, .42, 0);
clawdGroup.add(clawdBody);
[ -1, 1 ].forEach(side => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.2, .16, .22), clawdOrangeMat);
    arm.position.set(side * .61, .43, 0);
    clawdGroup.add(arm);
    clawdArms.push({
        mesh: arm,
        side: side
    });
});
[ -.36, -.12, .12, .36 ].forEach((x, i) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.105, .34, .2), clawdOrangeMat);
    leg.position.set(x, .03, 0);
    clawdGroup.add(leg);
    clawdLegs.push({
        mesh: leg,
        i: i
    });
});
[ -.22, .22 ].forEach(x => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(.1, .2, .04), clawdEyeMat);
    eye.position.set(x, .49, .164);
    clawdGroup.add(eye);
    clawdEyes.push(eye);
});
const clawdTune = {
    bodyW: .76,
    bodyH: 1.06,
    depth: 1.65,
    leg: .62,
    eyeW: .7,
    eyeH: .85,
    eyeGap: 1.3,
    eyeY: -.04,
    size: .56,
    x: .78,
    y: -2.28
};
function applyClawdTune() {
    const w = +clawdTune.bodyW, h = +clawdTune.bodyH, d = +clawdTune.depth, l = +clawdTune.leg;
    clawdBody.scale.set(w, h, d);
    clawdBody.position.y = .42 + .54 * (h - 1) * .5;
    clawdArms.forEach(a => {
        a.mesh.scale.set(1, h, d);
        a.mesh.position.x = a.side * (.51 * w + .1);
        a.mesh.userData.baseY = .43 + .54 * (h - 1) * .48;
    });
    clawdLegs.forEach((v, i) => {
        v.mesh.scale.set(1, l, d);
        v.mesh.position.x = [ -.36, -.12, .12, .36 ][i] * w;
        v.mesh.userData.baseY = .03 - .17 * (l - 1);
    });
    clawdEyes.forEach((eye, i) => {
        eye.scale.set(+clawdTune.eyeW, +clawdTune.eyeH, 1);
        eye.position.x = (i ? 1 : -1) * .22 * w * +clawdTune.eyeGap;
        eye.position.y = .49 + .42 * (h - 1) + +clawdTune.eyeY;
        eye.position.z = .164 * d;
    });
    clawdGroup.scale.setScalar(+clawdTune.size);
    clawdGroup.position.x = +clawdTune.x;
    clawdGroup.position.y = +clawdTune.y;
}
clawdGroup.name = "tree-clawd";
clawdGroup.position.z = .48;
applyClawdTune();
scene.add(clawdGroup);
const clawdAccessoryMats = [], clawdOutfits = {}, clawdOutfitRoot = new THREE.Group;
clawdOutfitRoot.name = "clawd-outfits";
clawdGroup.add(clawdOutfitRoot);
function clawdAccessoryMat(color, emissiveIntensity = .055) {
    const m = new THREE.MeshStandardMaterial({
        color: color,
        emissive: "#d28fb9",
        emissiveIntensity: emissiveIntensity,
        roughness: .72,
        metalness: 0
    });
    clawdAccessoryMats.push(m);
    return m;
}
const clawdRedMat = clawdAccessoryMat("#e54f66"), clawdDarkMat = clawdAccessoryMat("#17121d", .025), clawdBrownMat = clawdAccessoryMat("#56352d"), clawdGoldAccMat = clawdAccessoryMat("#d9ad68"), clawdTearMat = clawdAccessoryMat("#377be2");
function outfitGroup(name) {
    const g = new THREE.Group;
    g.name = "clawd-outfit-" + name;
    clawdOutfitRoot.add(g);
    clawdOutfits[name] = g;
    return g;
}
function outfitBox(g, size, pos, mat, rz = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    m.position.set(...pos);
    m.rotation.z = rz;
    g.add(m);
    return m;
}
clawdOutfits.plain = outfitGroup("plain");
{
    const g = outfitGroup("heart"), s = .095, z = .19;
    [ [ -2, 1 ], [ -1, 2 ], [ 0, 1 ], [ 1, 2 ], [ 2, 1 ], [ -1, 0 ], [ 0, -1 ], [ 1, 0 ] ].forEach(([x, y]) => outfitBox(g, [ s, s, .1 ], [ x * s - .38, .83 + y * s, z ], clawdRedMat));
}
{
    const g = outfitGroup("detective");
    outfitBox(g, [ .88, .1, .34 ], [ 0, .77, 0 ], clawdDarkMat);
    outfitBox(g, [ .54, .25, .3 ], [ 0, .92, 0 ], clawdBrownMat);
    outfitBox(g, [ .58, .065, .315 ], [ 0, .85, .005 ], clawdGoldAccMat);
    const monocle = new THREE.Mesh(new THREE.RingGeometry(.1, .135, 8), clawdGoldAccMat);
    monocle.position.set(.22, .49, .305);
    g.add(monocle);
    outfitBox(g, [ .025, .4, .025 ], [ .28, .28, .305 ], clawdGoldAccMat, -.1);
}
{
    const g = outfitGroup("tear"), drop = new THREE.Mesh(new THREE.OctahedronGeometry(.105, 0), clawdTearMat);
    drop.position.set(.36, .35, .31);
    drop.scale.set(.72, 1.35, .4);
    drop.rotation.z = -.14;
    g.add(drop);
    outfitBox(g, [ .055, .14, .06 ], [ .33, .48, .305 ], clawdTearMat, -.18);
}
Object.keys(outfitNames).forEach(outfitGroup);
const clawdWardrobe = createClawdWardrobe({
    groups: clawdOutfits,
    legacy: [ clawdBody, ...clawdArms.map(a => a.mesh), ...clawdLegs.map(l => l.mesh), ...clawdEyes ],
    scale: 1.02 * clawdTune.bodyW / 2,
    baseY: .03 - .17 * (clawdTune.leg - 1) - .17 * clawdTune.leg,
    status: document.getElementById("clawdWardrobeStatus"),
    specialButton: document.getElementById("clawdSpecialBtn")
});
function buildKetchupBottle() {
    const g = new THREE.Group;
    g.name = "clawd-ketchup-bottle";
    const mat = (c, e = .06) => new THREE.MeshStandardMaterial({
        color: c,
        emissive: c,
        emissiveIntensity: e,
        roughness: .62,
        metalness: 0
    });
    const red = mat("#d9342b", .1), redHi = mat("#f0584c", .12), label = mat("#ffd36b", .1), cap = mat("#fff4e6", .08);
    const box = (sz, pos, m) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(...sz), m);
        b.position.set(...pos);
        b.castShadow = true;
        g.add(b);
        return b;
    };
    box([ .34, .56, .3 ], [ 0, .28, 0 ], red);
    box([ .08, .4, .02 ], [ -.09, .32, .155 ], redHi);
    box([ .36, .14, .32 ], [ 0, .24, 0 ], label);
    box([ .24, .1, .22 ], [ 0, .61, 0 ], red);
    box([ .15, .14, .15 ], [ 0, .72, 0 ], cap);
    g.userData.tip = box([ .06, .12, .06 ], [ 0, .85, 0 ], cap);
    return g;
}
function attachKetchupToOmurice() {
    const host = clawdOutfits.omurice;
    if (!host) return false;
    const arms = [];
    host.traverse(o => {
        if (o.isMesh && /^Arm/.test(o.name)) arms.push(o);
    });
    if (arms.length < 2) return false;
    const right = arms.reduce((a, b) => b.position.x > a.position.x ? b : a);
    if (!right.getObjectByName("clawd-ketchup-bottle")) {
        const bottle = buildKetchupBottle();
        bottle.position.set(.1, .16, .34);
        bottle.rotation.z = -.28;
        right.add(bottle);
    }
    return roundOmurice(host);
}
function roundOmurice(host) {
    let egg = null, rice = null, plate = null;
    host.traverse(o => {
        if (!o.isMesh) return;
        if (/^Food.?omelette/i.test(o.name)) egg = o; else if (/^Food.?rice/i.test(o.name)) rice = o; else if (/^Food.?plate/i.test(o.name)) plate = o;
    });
    if (!egg || !rice || !plate) return false;
    const parent = egg.parent;
    if (parent.getObjectByName("clawd-round-omelette")) return true;
    const bb = o => {
        o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox.clone();
        b.min.add(o.position);
        b.max.add(o.position);
        return b;
    };
    const mk = (geo, mat, name) => {
        const m = new THREE.Mesh(geo, mat);
        m.name = name;
        m.castShadow = true;
        m.receiveShadow = true;
        parent.add(m);
        return m;
    };
    const eb = bb(egg), rb = bb(rice), pb = bb(plate), ec = eb.getCenter(new THREE.Vector3), es = eb.getSize(new THREE.Vector3);
    const e = mk(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), egg.material, "clawd-round-omelette");
    e.scale.set(es.x / 2, es.y, es.z / 2);
    e.position.set(ec.x, eb.min.y, ec.z);
    const rc = rb.getCenter(new THREE.Vector3), rs = rb.getSize(new THREE.Vector3);
    const r = mk(new THREE.CylinderGeometry(1, 1, 1, 40), rice.material, "clawd-round-rice");
    r.scale.set(rs.x / 2 * 1.03, rs.y, rs.z / 2 * 1.03);
    r.position.copy(rc);
    const pc = pb.getCenter(new THREE.Vector3), ps = pb.getSize(new THREE.Vector3);
    const pl = mk(new THREE.CylinderGeometry(1, .88, 1, 48), plate.material, "clawd-round-plate");
    pl.scale.set(ps.x / 2, ps.y, ps.z / 2);
    pl.position.copy(pc);
    egg.visible = rice.visible = plate.visible = false;
    return true;
}
const ketchupHearts = [], KETCHUP_HEART = [ "XX.XX", "XXXXX", "XXXXX", ".XXX.", "..X.." ], ketchupHeartGeo = new THREE.BoxGeometry(1, 1, 1);
let ketchupSpecialSeen = 0, ketchupBurstReq = 0, ketchupNextIdle = 0, ketchupSqueeze = 0, ketchupHold = null;
const ketchupBtn = document.getElementById("clawdKetchupBtn");
if (ketchupBtn) ketchupBtn.onclick = () => {
    ketchupBurstReq = performance.now();
};
function spawnKetchupHeart(host, bottle, big, side = 0) {
    const tip = bottle.userData.tip;
    if (!tip) return;
    const g = new THREE.Group;
    g.name = "clawd-ketchup-puff";
    const mat = new THREE.MeshStandardMaterial({
        color: "#e8343a",
        emissive: "#ff4a5a",
        emissiveIntensity: .35,
        roughness: .5,
        transparent: true,
        opacity: 1,
        depthWrite: false
    });
    const px = big ? .052 : .04;
    KETCHUP_HEART.forEach((row, r) => [ ...row ].forEach((c, col) => {
        if (c !== "X") return;
        const b = new THREE.Mesh(ketchupHeartGeo, mat);
        b.scale.set(px * .94, px * .94, px * .6);
        b.position.set((col - 2) * px, (2 - r) * px, 0);
        g.add(b);
    }));
    const p = tip.getWorldPosition(new THREE.Vector3);
    host.worldToLocal(p);
    g.position.copy(p);
    g.scale.setScalar(.01);
    host.add(g);
    const dir = side || (Math.random() < .5 ? -1 : 1);
    ketchupHearts.push({
        g: g,
        mat: mat,
        born: performance.now(),
        life: big ? 2e3 : 1700,
        x0: p.x,
        y0: p.y,
        z0: p.z,
        drift: dir * (.28 + Math.random() * .25),
        phase: Math.random() * 6.28,
        rise: big ? .95 : .75
    });
    ketchupSqueeze = performance.now();
}
(function ketchupLoop() {
    requestAnimationFrame(ketchupLoop);
    try {
        const now = performance.now(), host = clawdOutfits.omurice, bottle = host?.getObjectByName("clawd-ketchup-bottle");
        const on = !!(host && host.visible && bottle && clawdWardrobe.ready);
        if (ketchupBtn && ketchupBtn.hidden === on) ketchupBtn.hidden = !on;
        if (on) {
            if (ketchupBurstReq !== ketchupSpecialSeen) {
                ketchupSpecialSeen = ketchupBurstReq;
                for (let i = 0; i < 5; i++) setTimeout(() => {
                    if (host.visible) spawnKetchupHeart(host, bottle, i === 2, i % 2 ? -1 : 1);
                }, 120 + i * 380);
            }
            if (!ketchupNextIdle) ketchupNextIdle = now + 4e3;
            if (now > ketchupNextIdle && ketchupHearts.length === 0) {
                spawnKetchupHeart(host, bottle, false);
                ketchupNextIdle = now + 6e3 + Math.random() * 4e3;
            }
            const sq = Math.max(0, 1 - (now - ketchupSqueeze) / 220);
            bottle.scale.set(1 + sq * .12, 1 - sq * .18, 1 + sq * .12);
        }
        const hostQ = host ? host.getWorldQuaternion(new THREE.Quaternion).invert() : null, faceQ = hostQ ? hostQ.multiply(camera.getWorldQuaternion(new THREE.Quaternion)) : null;
        for (let i = ketchupHearts.length - 1; i >= 0; i--) {
            const h = ketchupHearts[i];
            if (faceQ) h.g.quaternion.copy(faceQ);
            const k = Math.min(1, ((ketchupHold ?? now) - h.born) / h.life);
            if (k >= 1 || !on) {
                h.g.removeFromParent();
                h.mat.dispose();
                ketchupHearts.splice(i, 1);
                continue;
            }
            const grow = k < .16 ? k / .16 * 1.15 : k < .28 ? 1.15 - (k - .16) / .12 * .15 : 1, shrink = k > .72 ? 1 - (k - .72) / .28 * .55 : 1;
            h.g.scale.setScalar(Math.max(.01, grow * shrink));
            h.g.position.set(h.x0 + h.drift * k + Math.sin(k * 6 + h.phase) * .05, h.y0 + h.rise * (1 - Math.pow(1 - k, 1.6)), h.z0 + .06 * k);
            h.mat.opacity = k > .58 ? Math.max(0, 1 - (k - .58) / .42) : 1;
        }
    } catch (e) {}
})();
{
    const ketchupTimer = setInterval(() => {
        try {
            if (attachKetchupToOmurice()) clearInterval(ketchupTimer);
        } catch (e) {}
    }, 400);
}
window.__ketchup = () => {
    const h = clawdOutfits.omurice;
    let bottle = 0, sauce = null, round = false;
    h?.traverse(o => {
        if (o.name === "clawd-ketchup-bottle") bottle++;
        if (o.isMesh && /^Food.?ketchup/i.test(o.name)) sauce = o.visible;
        if (o.name === "clawd-round-omelette") round = true;
    });
    return {
        bottle: bottle,
        sauceVisible: sauce,
        round: round,
        puffs: ketchupHearts.length
    };
};
window.__ketchupHold = v => {
    ketchupHold = v ? performance.now() : null;
};
let clawdOutfit = localStorage.getItem("memoryTreeClawdOutfit") || "plain";
const clawdOutfitTuneDefaults = {
    angle: 58,
    face: 0,
    radius: .92,
    y: 0,
    scale: 1
};
let clawdPlacement = {
    ...clawdOutfitTuneDefaults
};
try {
    clawdPlacement = {
        ...clawdOutfitTuneDefaults,
        ...JSON.parse(localStorage.getItem("memoryTreeClawdOrbit") || "{}")
    };
} catch (e) {}
let clawdPlacementCurrent = {
    ...clawdPlacement
};
function outfitTuneFor() {
    return clawdPlacement;
}
function saveClawdOutfitTunes() {
    localStorage.setItem("memoryTreeClawdOrbit", JSON.stringify(clawdPlacement));
}
function applyCurrentOutfitTune() {}
function syncOutfitTuneControls() {
    const tune = clawdPlacement;
    document.querySelectorAll("[data-outfit-tune]").forEach(input => {
        const key = input.dataset.outfitTune;
        input.value = tune[key];
        const output = input.nextElementSibling;
        if (output) output.value = Number(tune[key]).toFixed(2);
        input.disabled = false;
    });
    const reset = document.getElementById("clawdOutfitReset");
    if (reset) reset.disabled = false;
}
function applyClawdOutfit(name, save = true) {
    if (!clawdOutfits[name]) name = "plain";
    clawdOutfit = name;
    Object.entries(clawdOutfits).forEach(([key, g]) => g.visible = key === name);
    clawdWardrobe.select(name);
    document.querySelectorAll("[data-clawd-outfit]").forEach(b => b.classList.toggle("on", b.dataset.clawdOutfit === name));
    applyCurrentOutfitTune();
    syncOutfitTuneControls();
    if (save) localStorage.setItem("memoryTreeClawdOutfit", name);
    if (save) requestAnimationFrame(() => playClawdMotion("dress"));
}
document.querySelectorAll("[data-clawd-outfit]").forEach(b => b.onclick = () => applyClawdOutfit(b.dataset.clawdOutfit));
document.querySelectorAll("[data-outfit-tune]").forEach(input => input.oninput = () => {
    const key = input.dataset.outfitTune;
    clawdPlacement[key] = Number(input.value);
    const output = input.nextElementSibling;
    if (output) output.value = Number(input.value).toFixed(2);
    applyCurrentOutfitTune();
    saveClawdOutfitTunes();
});
document.getElementById("clawdOutfitReset").onclick = () => {
    clawdPlacement = {
        ...clawdOutfitTuneDefaults
    };
    applyCurrentOutfitTune();
    syncOutfitTuneControls();
    saveClawdOutfitTunes();
};
applyClawdOutfit(clawdOutfit, false);
const clawdHotspot = document.getElementById("clawdHotspot"), clawdSpeech = document.getElementById("clawdSpeech");
let clawdSpeechTimer = 0;
let clawdMotion = {
    type: "idle",
    start: 0,
    duration: 0
};
function playClawdMotion(type, duration) {
    const durations = {
        hello: 1050,
        waiting: 1e9,
        happy: 1250,
        sad: 1450,
        dress: 760,
        curious: 1100,
        pet: 2400,
        special: 2400
    };
    clawdMotion = {
        type: type,
        start: performance.now(),
        duration: duration || durations[type] || 900
    };
}
let clawdPetTimer = 0, clawdPetPressed = false, clawdPetOrigin = null;
function cancelClawdPet() {
    clearTimeout(clawdPetTimer);
    clawdPetTimer = 0;
    clawdPetOrigin = null;
}
document.getElementById("clawdPetBtn").onclick = () => playClawdMotion("pet");
document.getElementById("clawdSpecialBtn").onclick = () => playClawdMotion("special");
clawdHotspot.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    cancelClawdPet();
    clawdPetPressed = false;
    clawdPetOrigin = {
        x: e.clientX,
        y: e.clientY
    };
    clawdPetTimer = setTimeout(() => {
        clawdPetPressed = true;
        playClawdMotion("pet");
    }, 420);
});
clawdHotspot.addEventListener("pointermove", e => {
    if (clawdPetOrigin && Math.hypot(e.clientX - clawdPetOrigin.x, e.clientY - clawdPetOrigin.y) > 12) cancelClawdPet();
});
for (const event of [ "pointerup", "pointerleave", "pointercancel" ]) clawdHotspot.addEventListener(event, cancelClawdPet);
clawdHotspot.onclick = () => {
    if (clawdPetPressed) {
        clawdPetPressed = false;
        return;
    }
    playClawdMotion("hello");
    if (visitorModeOn && !visitorClawdVisible) renderClawdReply(lastClawdReplyText || "Clawd 正在树下等你。");
    clearTimeout(clawdSpeechTimer);
    clawdSpeech.classList.add("on");
    clawdSpeechTimer = setTimeout(() => clawdSpeech.classList.remove("on"), 5200);
};
clawdHotspot.onmouseenter = () => {
    if (clawdMotion.type === "idle") playClawdMotion("curious");
};
clawdHotspot.ondblclick = e => {
    e.preventDefault();
    playClawdMotion("happy");
};
(function clawdIdle(t) {
    requestAnimationFrame(clawdIdle);
    if (!Number.isFinite(t)) return;
    const targetAngle = (+clawdPlacement.angle || 0) * Math.PI / 180, currentAngle = (+clawdPlacementCurrent.angle || 0) * Math.PI / 180;
    const angleDelta = Math.atan2(Math.sin(targetAngle - currentAngle), Math.cos(targetAngle - currentAngle));
    clawdPlacementCurrent.angle = (currentAngle + angleDelta * .1) * 180 / Math.PI;
    const targetFace = (+clawdPlacement.face || 0) * Math.PI / 180, currentFace = (+clawdPlacementCurrent.face || 0) * Math.PI / 180;
    const faceDelta = Math.atan2(Math.sin(targetFace - currentFace), Math.cos(targetFace - currentFace));
    clawdPlacementCurrent.face = (currentFace + faceDelta * .12) * 180 / Math.PI;
    for (const key of [ "radius", "y", "scale" ]) clawdPlacementCurrent[key] += (+clawdPlacement[key] - clawdPlacementCurrent[key]) * .1;
    const s = t * .001, age = t - clawdMotion.start, k = Math.max(0, Math.min(1, age / Math.max(1, clawdMotion.duration)));
    if (clawdMotion.type !== "waiting" && clawdMotion.type !== "idle" && k >= 1) clawdMotion = {
        type: "idle",
        start: t,
        duration: 0
    };
    let dx = 0, dy = Math.sin(s * 1.7) * .009, rz = Math.sin(s * 1.25) * .007, sx = 1, sy = 1, armLift = 0, legBounce = 0;
    if (clawdMotion.type === "waiting") {
        dx = Math.sin(s * 2.35) * .026;
        rz = Math.sin(s * 2.35) * .045;
        dy += Math.sin(s * 4.7) * .008;
        armLift = .035 + .018 * Math.sin(s * 4.7);
    } else if (clawdMotion.type === "happy") {
        const pulse = Math.sin(k * Math.PI), quick = Math.sin(k * Math.PI * 3);
        dy += pulse * .18;
        rz = quick * .045;
        sx = 1 + pulse * .07;
        sy = 1 - pulse * .055;
        armLift = pulse * .13;
        legBounce = pulse * .055;
    } else if (clawdMotion.type === "sad") {
        const sink = Math.sin(k * Math.PI), wobble = Math.sin(k * Math.PI * 2);
        dy -= sink * .055;
        rz = wobble * .025;
        sy = 1 - sink * .09;
        sx = 1 + sink * .035;
        armLift = -sink * .025;
    } else if (clawdMotion.type === "hello") {
        const wave = Math.sin(k * Math.PI * 4) * (1 - k), pulse = Math.sin(k * Math.PI);
        dy += pulse * .045;
        rz = wave * .025;
        armLift = pulse * .055;
    } else if (clawdMotion.type === "dress") {
        const pop = Math.sin(k * Math.PI), twirl = Math.sin(k * Math.PI * 2) * (1 - k);
        dy += pop * .09;
        rz = twirl * .16;
        sx = 1 + pop * .12;
        sy = 1 + pop * .12;
        armLift = pop * .08;
    } else if (clawdMotion.type === "pet") {
        const p = Math.sin(k * Math.PI);
        sy = 1 - p * .06;
        sx = 1 + p * .03;
        rz = Math.sin(k * Math.PI * 6) * p * .04;
    } else if (clawdMotion.type === "curious") {
        const peek = Math.sin(k * Math.PI), tilt = Math.sin(k * Math.PI * 2);
        dx += peek * .055;
        dy += peek * .025;
        rz = tilt * .055;
        sy = 1 - peek * .035;
    }
    const orbitAngle = (+clawdPlacementCurrent.angle || 0) * Math.PI / 180, orbitRadius = +clawdPlacementCurrent.radius || .92;
    clawdGroup.position.x = Math.sin(orbitAngle) * orbitRadius + dx;
    clawdGroup.position.y = +clawdTune.y + (+clawdPlacementCurrent.y || 0) + dy;
    clawdGroup.position.z = Math.cos(orbitAngle) * orbitRadius;
    clawdGroup.rotation.y = (+clawdPlacementCurrent.face || 0) * Math.PI / 180;
    clawdGroup.rotation.z = rz;
    const baseScale = +clawdTune.size * (+clawdPlacementCurrent.scale || 1);
    clawdGroup.scale.set(baseScale * sx, baseScale * sy, baseScale);
    clawdArms.forEach((a, i) => a.mesh.position.y = a.mesh.userData.baseY + Math.sin(s * 1.55 + i * Math.PI) * .01 + armLift * (clawdMotion.type === "hello" ? i ? 1 : .25 : 1));
    clawdLegs.forEach(l => l.mesh.position.y = l.mesh.userData.baseY + Math.sin(s * 2.1 + l.i * .8) * .004 + legBounce);
    const blink = s % 5.4 > .1 ? 1 : .1;
    clawdEyes.forEach(e => e.scale.y = +clawdTune.eyeH * blink);
    if (clawdWardrobe.update(clawdMotion, t)) {
        clawdGroup.position.x = Math.sin(orbitAngle) * orbitRadius;
        clawdGroup.position.y = +clawdTune.y + (+clawdPlacementCurrent.y || 0);
        clawdGroup.rotation.z = 0;
        clawdGroup.scale.setScalar(baseScale);
    }
    if (clawdUserOff && clawdGroup.visible) {
        clawdGroup.visible = false;
        clawdSpeech.classList.remove("on", "chatting");
    }
    const head = clawdGroup.localToWorld(new THREE.Vector3(0, clawdWardrobe.headY, 0)).project(camera), visible = clawdGroup.visible && head.z > -1 && head.z < 1;
    clawdHotspot.style.display = visible ? "block" : "none";
    if (visible) {
        const x = (head.x * .5 + .5) * innerWidth, y = (-head.y * .5 + .5) * innerHeight;
        clawdHotspot.style.left = x + "px";
        clawdHotspot.style.top = y + "px";
        clawdSpeech.style.left = x + "px";
        clawdSpeech.style.top = y - 35 + "px";
    }
})();
const savedArchiveLayout = localStorage.getItem("memoryTreeArchiveLayout"), queryArchiveLayout = new URLSearchParams(location.search).get("archiveLayout"), initialArchiveLayout = [ "ring", "waterfall", "river" ].includes(queryArchiveLayout) ? queryArchiveLayout : [ "ring", "waterfall", "river" ].includes(savedArchiveLayout) ? savedArchiveLayout : "ring";
const stars = (() => {
    const n = 1100, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        const r = 10 + Math.random() * 25, a = Math.random() * Math.PI * 2, y = -5 + Math.random() * 14;
        p[i * 3] = Math.cos(a) * r;
        p[i * 3 + 1] = y;
        p[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry;
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({
        color: "#ead5ff",
        size: .035,
        transparent: true,
        opacity: .7
    }));
})();
scene.add(stars);
if (initialArchiveLayout === "waterfall") {
    stars.visible = false;
}
const ring = new THREE.Group;
for (const [r, op, tube, color] of [ [ 2.8, .44, .01, "#f7cce8" ], [ 2.92, .075, .03, "#d79bc9" ] ]) {
    const c = new THREE.EllipseCurve(0, 0, r, r * .48, 0, Math.PI * 2), pts = c.getPoints(200).map(p => new THREE.Vector3(p.x, 0, p.y));
    const path = new THREE.CatmullRomCurve3(pts, true);
    ring.add(new THREE.Mesh(new THREE.TubeGeometry(path, 220, tube, 6, true), new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: op,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    })));
}
ring.rotation.set(.38, 0, .08);
ring.position.y = 2.6;
scene.add(ring);
const ring2 = ring.clone();
scene.add(ring2);
const flowCanvas = document.createElement("canvas");
flowCanvas.width = 64;
flowCanvas.height = 64;
const fx = flowCanvas.getContext("2d"), fg = fx.createRadialGradient(32, 32, 1, 32, 32, 31);
fg.addColorStop(0, "rgba(255,255,255,1)");
fg.addColorStop(.18, "rgba(255,239,251,.98)");
fg.addColorStop(.46, "rgba(247,166,223,.68)");
fg.addColorStop(1, "rgba(205,113,208,0)");
fx.fillStyle = fg;
fx.fillRect(0, 0, 64, 64);
const flowTex = new THREE.CanvasTexture(flowCanvas), ringStreams = [];
function addRingStream(host, n, size, baseSpeed, direction, bright) {
    const pos = new Float32Array(n * 3), colors = new Float32Array(n * 3), angles = new Float32Array(n), speeds = new Float32Array(n), radii = new Float32Array(n), waves = new Float32Array(n), palette = bright ? [ "#fff1cf", "#fff5fb", "#ffd7f1" ] : [ "#eec7eb", "#d8c6ff", "#f4a9db" ];
    for (let i = 0; i < n; i++) {
        angles[i] = Math.random() * Math.PI * 2;
        speeds[i] = baseSpeed * (.68 + Math.random() * .72) * direction;
        radii[i] = 2.64 + Math.random() * .56;
        waves[i] = Math.random() * Math.PI * 2;
        const c = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
        colors.set([ c.r, c.g, c.b ], i * 3);
    }
    const geo = new THREE.BufferGeometry;
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
        map: flowTex,
        size: size,
        vertexColors: true,
        transparent: true,
        opacity: bright ? .95 : .58,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        toneMapped: false
    }));
    pts.frustumCulled = false;
    host.add(pts);
    ringStreams.push({
        pts: pts,
        angles: angles,
        speeds: speeds,
        radii: radii,
        waves: waves
    });
}
function updateRingStreams(t) {
    for (const s of ringStreams) {
        const pa = s.pts.geometry.attributes.position;
        for (let i = 0; i < s.angles.length; i++) {
            const a = s.angles[i] + t * s.speeds[i], r = s.radii[i];
            pa.setXYZ(i, Math.cos(a) * r, Math.sin(a * 2.7 + s.waves[i]) * .045, Math.sin(a) * r * .48);
        }
        pa.needsUpdate = true;
    }
}
function riverCurveX(along) {
    return 2.15 * Math.sin(along * 1.72 - .28) + .62 * Math.sin(along * 4.15 + .78) - .28;
}
function riverWidth(along) {
    return .38 + .22 * (.5 + .5 * Math.sin(along * 3.8 + .45)) + .1 * (.5 + .5 * Math.sin(along * 8.3 - 1.1));
}
function riverSpread(along) {
    const u = (along + 1) * .5;
    return .12 + .88 * u * u * (3 - 2 * u);
}
function riverLaneX(along, lane) {
    const spread = riverSpread(along), w = riverWidth(along), phase = lane * 1.61;
    return riverCurveX(along) + lane * w * (3.25 + .54 * Math.sin(along * 2.45 + phase)) * spread + Math.sin(along * (1.55 + Math.abs(lane) * .34) + phase) * Math.abs(lane) * .82 * spread;
}
function riverLaneZ(along, lane) {
    const spread = riverSpread(along), phase = lane * 1.13;
    return along * 14.5 + Math.sin(along * (1.48 + Math.abs(lane) * .24) + phase) * Math.abs(lane) * 1.72 * spread;
}
function riverLaneWidth(along, lane) {
    const u = (along + 1) * .5, near = .56 + u * 1.3, w = riverWidth(along);
    return w * near * (Math.abs(lane) > 1 ? .76 : lane === 0 ? 1.2 : .92);
}
const riverMistGeo = (() => {
    const segments = 260, lanes = [ -2, -1, 0, 1, 2 ], pos = [], uv = [], colors = [], laneId = [], idx = [], palette = [ "#aeb9e8", "#c8b6df", "#f0cddd", "#e6b6ca", "#b9b5dc" ];
    for (const lane of lanes) {
        const base = pos.length / 3, c = new THREE.Color(palette[lane + 2]);
        for (let i = 0; i <= segments; i++) {
            const u = i / segments, along = u * 2 - 1, center = riverLaneX(along, lane), z = riverLaneZ(along, lane), w = riverLaneWidth(along, lane) * (Math.abs(lane) > 1 ? 1.72 : 1.94);
            pos.push(center - w, -2.455, z, center + w, -2.455, z);
            uv.push(u, 0, u, 1);
            colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
            laneId.push(lane + 2, lane + 2);
            if (i < segments) {
                const o = base + i * 2;
                idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
            }
        }
    }
    const g = new THREE.BufferGeometry;
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.setAttribute("laneId", new THREE.Float32BufferAttribute(laneId, 1));
    g.setIndex(idx);
    return g;
})();
const riverMistMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: {
            value: 0
        },
        uMist: {
            value: new THREE.Color("#c9a8ca")
        }
    },
    vertexShader: `attribute float laneId;varying vec2 vUv;varying vec3 vColor;varying float vLane;void main(){vUv=uv;vColor=color;vLane=laneId;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec2 vUv;varying vec3 vColor;varying float vLane;uniform float uTime;uniform vec3 uMist;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}float fbm(vec2 p){float v=0.0,a=.55;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.04+vec2(1.7,.9);a*=.48;}return v;}void main(){float q=vUv.y*2.0-1.0;float bank=1.0-abs(q);float edge=smoothstep(0.0,.68,bank);float endFade=smoothstep(.0,.24,vUv.x)*(1.0-smoothstep(.87,1.0,vUv.x));float drift=uTime*.008;float bend=.10*sin(vUv.x*18.0+vLane*1.7)+.055*sin(vUv.x*41.0-vLane);float broad=fbm(vec2(vUv.x*5.8-drift,vUv.y*2.1+vLane*3.7));float fine=fbm(vec2(vUv.x*15.0+drift*.7,vUv.y*5.8+vLane*5.1));float cloud=smoothstep(.34,.76,broad)*(.30+.70*fine);float filament=0.0;for(int j=0;j<3;j++){float fj=float(j);float track=-.48+fj*.48+bend+sin(vUv.x*(11.0+fj*3.0)+vLane+fj)*(.05+.025*fj);float d=abs(q-track);filament+=exp(-d*d/(.010+.006*fj));}float softGlow=exp(-q*q/.72)*(.30+.70*broad);float alpha=(cloud*.060+filament*.035+softGlow*.018)*edge*endFade;vec3 tint=mix(vColor,uMist,.24);vec3 col=tint*(.64+.36*fine)+vec3(.10,.06,.10)*filament;gl_FragColor=vec4(col,alpha);}`,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false
});
const memoryRiverMist = new THREE.Mesh(riverMistGeo, riverMistMaterial);
memoryRiverMist.name = "memory-river-mist";
memoryRiverMist.renderOrder = 1.8;
memoryRiverMist.visible = false;
scene.add(memoryRiverMist);
const ringDefaults = {
    x: 0,
    y: 2.25,
    size: 1.06,
    round: .76,
    tiltX: .34,
    tiltZ: .06,
    mode: "single",
    galaxyOn: true,
    galaxyBase: "#090512",
    galaxyNebula: "#7193d6",
    galaxyCore: "#f3eadf",
    treeGlow: 1,
    treeAlpha: 1,
    bloomGlow: .38,
    ringGlow: 1,
    starSize: 1,
    starBright: 1,
    seedSize: 1,
    fruitSize: 1,
    dewSize: 1,
    lightGlow: 1,
    ringSpeed: 1,
    flowSpeed: 1,
    twinkleSpeed: 1,
    fogDensity: .018,
    lightAzim: 131,
    lightHigh: 7,
    ringLightI: 0,
    fillLight: .62,
    backFillI: .55,
    beamGlow: 0,
    clawdShield: .45
};
let ringTune = {
    ...ringDefaults
};
try {
    ringTune = {
        ...ringDefaults,
        ...JSON.parse(localStorage.getItem("memoryTreeRingTune") || "{}")
    };
} catch {}
if (localStorage.getItem("memoryTreeIllustratedV1")) {
    Object.assign(ringTune, {
        treeGlow: 1,
        treeAlpha: 1,
        bloomGlow: .38,
        lightGlow: 1,
        fillLight: .13,
        ringLightI: 0,
        beamGlow: 0
    });
    localStorage.setItem("memoryTreeRingTune", JSON.stringify(ringTune));
    localStorage.removeItem("memoryTreeIllustratedV1");
}
try {
    if (!localStorage.getItem("memoryTreeLightingOxV1")) {
        if (+ringTune.fillLight === .13) {
            ringTune.fillLight = .45;
            localStorage.setItem("memoryTreeRingTune", JSON.stringify(ringTune));
        }
        localStorage.setItem("memoryTreeLightingOxV1", "1");
    }
} catch (e) {}
function applyRingTune() {
    const s = +ringTune.size, z = s * (+ringTune.round / .48);
    ring.position.set(+ringTune.x, +ringTune.y, 0);
    ring.scale.set(s, s, z);
    ring.rotation.set(+ringTune.tiltX, 0, +ringTune.tiltZ);
    ring2.position.copy(ring.position);
    ring2.scale.set(s * .94, s * .94, z * .94);
    ring2.rotation.set(- +ringTune.tiltX * .72, .38, +ringTune.tiltZ + .72);
    ring2.visible = ringTune.mode === "double";
    const b = document.getElementById("ringModeBtn");
    if (b) {
        b.textContent = ringTune.mode === "double" ? "星环：双环" : "星环：单环";
        b.classList.toggle("on", ringTune.mode === "double");
    }
    applyTreeGlow();
    applyExtraTune();
}
function applyTreeGlow() {
    const g = +ringTune.treeGlow || 1, alpha = (ringTune.treeAlpha === undefined ? 1 : +ringTune.treeAlpha) || 1;
    let tree = null;
    try {
        tree = active;
    } catch (e) {
        return;
    }
    if (!tree) return;
    tree.traverse(o => {
        if (o.isMesh && o.material && o.material.emissive !== undefined && o.material.emissiveIntensity !== undefined) {
            if (o.material.userData._baseE === undefined) o.material.userData._baseE = o.material.emissiveIntensity;
            if (o.material.userData._baseO === undefined) {
                o.material.userData._baseO = o.material.opacity;
                o.material.userData._baseT = o.material.transparent;
                o.material.userData._baseDW = o.material.depthWrite;
            }
            o.material.opacity = o.material.userData._baseO * alpha;
            o.material.transparent = o.material.userData._baseT || alpha < .995;
            o.material.depthWrite = alpha > .995 ? o.material.userData._baseDW : false;
            if (alpha < .995) {
                o.material.blending = THREE.CustomBlending;
                o.material.blendSrc = THREE.OneFactor;
                o.material.blendDst = THREE.OneMinusSrcAlphaFactor;
                o.material.blendEquation = THREE.AddEquation;
            } else o.material.blending = THREE.NormalBlending;
            o.material.needsUpdate = true;
            o.material.emissiveIntensity = o.material.userData._baseE * g;
        }
    });
}
setInterval(() => {
    applyTreeGlow();
    applyColorTune();
}, 3e3);
function applyExtraTune() {
    try {
        if (window.__bloomPass) window.__bloomPass.strength = +ringTune.bloomGlow;
        const rf = +ringTune.ringGlow || 1;
        [ ring, ring2 ].forEach(rg => rg && rg.traverse(o => {
            const m = o.material;
            if (!m || m.opacity === undefined) return;
            if (m.userData._baseOp === undefined) m.userData._baseOp = m.opacity;
            m.opacity = Math.min(1, m.userData._baseOp * rf);
        }));
        if (archivePointMaterial) {
            archivePointMaterial.uniforms.uScale.value = innerHeight * .64 * (+ringTune.starSize || 1);
            if (archivePointMaterial.uniforms.uBright) archivePointMaterial.uniforms.uBright.value = (+ringTune.starBright || 1) * (archiveLayoutMode === "river" ? .64 : 1);
        }
        lifecycleVisuals.forEach(v => {
            if (v.origScale) v.baseScale.copy(v.origScale).multiplyScalar(crownScaleFor(v.type));
        });
        const lf = +ringTune.lightGlow || 1;
        [ key, rim, core ].forEach(l => {
            if (!l) return;
            if (l.userData._baseI === undefined) l.userData._baseI = l.intensity;
            l.intensity = l.userData._baseI * lf;
        });
        hemi.intensity = ringTune.fillLight === undefined ? .13 : +ringTune.fillLight;
        backFill.intensity = ringTune.backFillI === undefined ? .55 : +ringTune.backFillI;
        ringLight.intensity = +ringTune.ringLightI || 0;
        ringLight.position.set(+ringTune.x || 0, (+ringTune.y || 2.25) + .1, 0);
        ringLight.color.set(ringTune.ringColor || "#f7cce8");
        const az = (+ringTune.lightAzim || 131) * Math.PI / 180, lh = ringTune.lightHigh === undefined ? 7 : +ringTune.lightHigh;
        beam.position.set(Math.cos(az) * 9.2, lh, Math.sin(az) * 9.2);
        beam.intensity = +ringTune.beamGlow || 0;
        applyColorTune();
    } catch (e) {}
}
function tintMat(m, hex, kc, ke) {
    if (!m) return;
    if (m.color) {
        if (m.userData._baseCol === undefined) m.userData._baseCol = m.color.clone();
        if (hex) m.color.copy(m.userData._baseCol).lerp(new THREE.Color(hex), kc); else m.color.copy(m.userData._baseCol);
    }
    if (m.emissive) {
        if (m.userData._baseEmi === undefined) m.userData._baseEmi = m.emissive.clone();
        if (hex) m.emissive.copy(m.userData._baseEmi).lerp(new THREE.Color(hex), ke); else m.emissive.copy(m.userData._baseEmi);
    }
}
function applyColorTune() {
    try {
        if (ringTune.skyColor) {
            scene.background = new THREE.Color(ringTune.skyColor);
            scene.fog.color.set(ringTune.skyColor);
        } else {
            scene.background = new THREE.Color("#090512");
            scene.fog.color.set("#090512");
        }
        galaxySky.visible = ringTune.galaxyOn !== false;
        galaxyMaterial.uniforms.uBase.value.set(ringTune.galaxyBase || "#090512").multiplyScalar(.2);
        galaxyMaterial.uniforms.uNebula.value.set(ringTune.galaxyNebula || "#7193d6").multiplyScalar(.78);
        galaxyMaterial.uniforms.uCore.value.set(ringTune.galaxyCore || "#f3eadf");
        riverMistMaterial.uniforms.uMist.value.set(ringTune.galaxyNebula || "#7193d6").lerp(new THREE.Color(ringTune.galaxyCore || "#f3eadf"), .66);
        const galaxyButton = document.getElementById("galaxyToggleBtn");
        if (galaxyButton) {
            galaxyButton.textContent = `银河颜色：${ringTune.galaxyOn === false ? "关闭" : "开启"}`;
            galaxyButton.classList.toggle("on", ringTune.galaxyOn !== false);
        }
        scene.fog.density = ringTune.fogDensity === undefined ? .018 : +ringTune.fogDensity;
        let tree = null;
        try {
            tree = active;
        } catch (e) {}
        if (tree) tree.traverse(o => {
            if (o.isMesh && o.material) tintMat(o.material, ringTune.treeColor, .92, .95);
        });
        [ ring, ring2 ].forEach(rg => rg && rg.traverse(o => {
            if (o.material) tintMat(o.material, ringTune.ringColor, .92, .92);
        }));
        const clawdReflect = new THREE.Color(ringTune.treeColor || "#d28fb9");
        clawdReflect.lerp(new THREE.Color(ringTune.ringColor || "#f7cce8"), .28);
        clawdReflect.lerp(new THREE.Color(ringTune.skyColor || "#090512"), .08);
        clawdOrangeMat.color.copy(clawdBaseColor).lerp(clawdReflect, .12);
        clawdOrangeMat.emissive.copy(clawdReflect);
        const _tg = +ringTune.treeGlow || 1, clawdTreeTerm = _tg <= 1 ? _tg * .035 : .035 + (_tg - 1) * .006;
        const clawdLightEnergy = clawdTreeTerm + (+ringTune.lightGlow || 1) * .024 + (+ringTune.fillLight || 0) * .035 + (+ringTune.backFillI || 0) * .012 + Math.min(30, +ringTune.ringLightI || 0) * .003;
        clawdOrangeMat.emissiveIntensity = Math.max(.025, Math.min(.12, clawdLightEnergy));
        clawdAccessoryMats.forEach(m => {
            m.emissive.copy(clawdReflect);
            m.emissiveIntensity = Math.max(.018, Math.min(.09, clawdLightEnergy * .72));
        });
        const kit = window.__birthKit;
        if (kit) {
            tintMat(kit.seedMat, ringTune.seedColor, .95, .95);
            tintMat(kit.fruitShellMat, ringTune.fruitColor, .95, .95);
            tintMat(kit.fruitCoreMat, ringTune.fruitColor, .85, 0);
            tintMat(kit.fruitCalyxMat, ringTune.fruitColor, .58, .58);
            tintMat(kit.dewMat, ringTune.dewColor, .95, .95);
            kit.dewGroup && kit.dewGroup.traverse(o => {
                if (o.isMesh && o.material && o.material !== kit.dewMat) tintMat(o.material, ringTune.dewColor, .95, .95);
            });
        }
        document.querySelectorAll(".safe-dew").forEach(el => el.style.setProperty("--dew-color", ringTune.dewColor || "#dedaff"));
    } catch (e) {}
}
document.querySelectorAll("[data-ringc]").forEach(el => {
    const k = el.dataset.ringc;
    if (ringTune[k]) el.value = ringTune[k];
    el.oninput = () => {
        ringTune[k] = el.value;
        applyRingTune();
        localStorage.setItem("memoryTreeRingTune", JSON.stringify(ringTune));
    };
});
document.querySelectorAll("[data-ringx]").forEach(b => {
    b.onclick = () => {
        delete ringTune[b.dataset.ringx];
        applyRingTune();
        localStorage.setItem("memoryTreeRingTune", JSON.stringify(ringTune));
    };
});
applyRingTune();
document.getElementById("ringBtn").onclick = () => document.getElementById("ringPanel").classList.toggle("on");
document.querySelectorAll("[data-ring]").forEach(el => {
    const k = el.dataset.ring;
    el.value = ringTune[k];
    el.nextElementSibling.value = (+el.value).toFixed(2);
    el.oninput = () => {
        ringTune[k] = +el.value;
        el.nextElementSibling.value = (+el.value).toFixed(2);
        applyRingTune();
        localStorage.setItem("memoryTreeRingTune", JSON.stringify(ringTune));
    };
});
document.getElementById("ringModeBtn").onclick = () => {
    ringTune.mode = ringTune.mode === "double" ? "single" : "double";
    applyRingTune();
    localStorage.setItem("memoryTreeRingTune", JSON.stringify(ringTune));
};
document.getElementById("galaxyToggleBtn").onclick = () => {
    ringTune.galaxyOn = ringTune.galaxyOn === false;
    applyColorTune();
    localStorage.setItem("memoryTreeRingTune", JSON.stringify(ringTune));
};
document.getElementById("waterfallModeBtn").onclick = () => setArchiveLayoutMode(archiveLayoutMode === "waterfall" ? "ring" : "waterfall");
document.getElementById("riverModeBtn").onclick = () => {
    pearlEnabled = false;
    rememberPearl();
    pearlBranch = false;
    if (active) active.visible = true;
    setArchiveLayoutMode("river");
};
document.getElementById("pearlRiverBtn").onclick = () => {
    pearlEnabled = true;
    rememberPearl();
    setArchiveLayoutMode("river");
    controls.target.set(0, -1.5, -2);
    camera.position.set(0, 6, 16);
};
let branchToggleBusy = false, branchToggleBusyAt = 0;
function treeClientLog(o) {
    try {
        fetch("/api/starmap/client-log", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(o),
            keepalive: true
        }).catch(() => {});
    } catch (e) {}
}
let branchSeq = 0, treeFrameNo = 0;
(function countFrames() {
    treeFrameNo++;
    requestAnimationFrame(countFrames);
})();
function toggleBranchTree(src) {
    const clickAt = performance.now(), seq = ++branchSeq;
    if (branchToggleBusy) {
        if (clickAt - branchToggleBusyAt < 8e3) {
            treeClientLog({
                ev: "branch-toggle-ignored-busy",
                busyMs: Math.round(clickAt - branchToggleBusyAt)
            });
            return;
        }
        treeClientLog({
            ev: "branch-toggle-unstuck",
            busyMs: Math.round(clickAt - branchToggleBusyAt)
        });
    }
    branchToggleBusy = true;
    branchToggleBusyAt = clickAt;
    const needRiver = !(archiveLayoutMode === "river" && pearlEnabled), firstBuild = needRiver && !wardrobePearl;
    const btns = [ document.getElementById("pearlBranchBtn"), document.getElementById("branchQuick") ].filter(Boolean);
    btns.forEach(b => {
        b.textContent = firstBuild ? "正在铺珠光河…" : "切换中…";
        b.classList.add("busy");
    });
    setTimeout(() => {
        let err = null;
        try {
            pearlBranch = !pearlBranch;
            pearlEnabled = true;
            if (active) active.visible = !pearlBranch;
            if (needRiver) setArchiveLayoutMode("river");
        } catch (e) {
            err = String(e && e.message || e);
            console.warn("branch toggle", e);
        } finally {
            btns.forEach(b => b.classList.remove("busy"));
            branchToggleBusy = false;
            try {
                syncWardrobePearl();
            } catch (e) {
                err = err || String(e);
            }
            const ms = Math.round(performance.now() - clickAt), want = pearlBranch, f0 = treeFrameNo;
            setTimeout(() => treeClientLog({
                ev: "branch-toggle",
                seq: seq,
                seqAtLog: branchSeq,
                stale: branchSeq !== seq,
                src: src,
                ms: ms,
                needRiver: needRiver,
                firstBuild: firstBuild,
                want: want,
                pearlBranch: pearlBranch,
                pearlEnabled: pearlEnabled,
                layout: archiveLayoutMode,
                treeLoaded: !!active,
                activeVisible: active ? active.visible : null,
                branchVisible: wardrobePearl ? wardrobePearl.branch.visible : null,
                frames500: treeFrameNo - f0,
                hidden: document.hidden,
                err: err
            }), 500);
        }
    }, 40);
}
{
    const b = document.getElementById("pearlBranchBtn");
    let pd = null, lastTap = 0;
    const fire = src => {
        lastTap = performance.now();
        toggleBranchTree(src);
    };
    b.addEventListener("pointerdown", e => {
        pd = {
            x: e.clientX,
            y: e.clientY,
            t: performance.now(),
            mx: 0
        };
    });
    b.addEventListener("pointermove", e => {
        if (pd) pd.mx = Math.max(pd.mx, Math.hypot(e.clientX - pd.x, e.clientY - pd.y));
    });
    b.addEventListener("pointerup", e => {
        const d = pd;
        pd = null;
        if (!d) return;
        const dist = Math.hypot(e.clientX - d.x, e.clientY - d.y), held = performance.now() - d.t;
        if (dist < 16 && held < 1200) fire("tap"); else treeClientLog({
            ev: "branch-tap-rejected",
            dist: Math.round(dist),
            held: Math.round(held)
        });
    });
    b.addEventListener("pointercancel", () => {
        const d = pd;
        pd = null;
        if (!d) return;
        const held = performance.now() - d.t;
        treeClientLog({
            ev: "branch-tap-cancel",
            moved: Math.round(d.mx),
            held: Math.round(held)
        });
        if (d.mx < 8 && held < 800) fire("cancel-rescue");
    });
    b.onclick = () => {
        if (performance.now() - lastTap < 800) return;
        toggleBranchTree("click");
    };
}
function rememberPearl() {
    localStorage.setItem("memoryTreeRiverStyle", pearlEnabled ? "pearl" : "classic");
    const u = new URL(location.href);
    u.searchParams.set("riverStyle", pearlEnabled ? "pearl" : "classic");
    history.replaceState({}, "", u);
}
document.getElementById("pearlQuick").onclick = () => document.getElementById("pearlRiverBtn").click();
document.getElementById("classicQuick").onclick = () => document.getElementById("riverModeBtn").click();
document.getElementById("branchQuick").onclick = () => document.getElementById("pearlBranchBtn").click();
function pearlPalDefault() {
    return [ "#fff3f7", "#ffc9dd", "#c9b6f2", "#9fc4f0", "#ffd6a4" ];
}
function pearlPalNames() {
    return [ "珠白", "粉", "淡紫", "岸边冷蓝", "暖金" ];
}
function applyPearlPal(p) {
    try {
        const a = JSON.parse(localStorage.getItem("memoryTreePearlPalette") || "null");
        if (Array.isArray(a) && a.length === 5) a.forEach((h, i) => p.palette[i].set(h));
    } catch (e) {}
}
function ensureWardrobePearl() {
    if (!wardrobePearl) {
        wardrobePearl = createWardrobePearl(camera, controls);
        applyPearlPal(wardrobePearl);
        riverPivot.add(wardrobePearl.root);
    }
    return wardrobePearl;
}
function syncWardrobePearl() {
    const on = pearlEnabled && archiveLayoutMode === "river";
    if (wardrobePearl) {
        wardrobePearl.root.visible = on;
        wardrobePearl.branch.visible = on && pearlBranch;
        wardrobePearl.branch.rotation.y = (+yawTune.branch || 0) * Math.PI / 180;
        for (const c of wardrobePearl.branch.children) if (c.isPoints) c.visible = false;
    }
    document.getElementById("pearlRiverBtn").classList.toggle("on", on);
    if (!branchToggleBusy) {
        document.getElementById("pearlBranchBtn").textContent = pearlBranch ? "切换主世界树" : "切换枝条树";
        document.getElementById("branchQuick").textContent = pearlBranch ? "切换主世界树" : "切换枝条树";
    }
    if (active) active.visible = !(pearlBranch && on);
    document.body.classList.toggle("branch-tree-mode", !!(pearlBranch && on));
    canvas.dataset.riverStyle = on ? "pearl" : "classic";
    if (on && wardrobePearl && archivePointMaterial?.uniforms?.uPearl?.value) {
        const st = wardrobePearl.state, u = archivePointMaterial.uniforms;
        u.uScale.value = innerHeight * .64 * (+ringTune.starSize || 1) * (st._memSize ?? PEARL_MEM_DEFAULT._memSize);
        u.uBright.value = (+ringTune.starBright || 1) * .64 * (st._memBright ?? PEARL_MEM_DEFAULT._memBright);
        if (u.uPearlK) u.uPearlK.value = st._memSize ?? PEARL_MEM_DEFAULT._memSize;
    }
}
const PEARL_MEM_DEFAULT = {
    _memSize: 1.8,
    _memBright: 1.05,
    _rippleA: .7,
    _rippleSize: .7,
    _rippleDuration: 1,
    _rippleAfter: 1
};
window.__pearlDbg = {
    get pearl() {
        return wardrobePearl;
    },
    info() {
        const u = archivePointMaterial?.uniforms, a = archivePointCloud?.geometry?.attributes?.pointSize;
        let mn = 1e9, mx = 0, sum = 0;
        if (a) for (let i = 0; i < a.count; i++) {
            const v = a.getX(i);
            mn = Math.min(mn, v);
            mx = Math.max(mx, v);
            sum += v;
        }
        return {
            uScale: u?.uScale?.value,
            uBright: u?.uBright?.value,
            uPearl: u?.uPearl?.value,
            n: a?.count,
            sizeMin: mn,
            sizeMax: mx,
            sizeAvg: a ? sum / a.count : 0,
            camDist: camera.position.distanceTo(controls.target),
            layout: archiveLayoutMode,
            pearlEnabled: pearlEnabled
        };
    }
};
function setArchivePreviewCount(count) {
    const url = new URL(location.href);
    if (count) url.searchParams.set("archivePreview", String(count)); else url.searchParams.delete("archivePreview");
    url.searchParams.delete("riverSelfTest");
    url.searchParams.delete("riverView");
    location.href = url.toString();
}
const activeArchivePreview = Math.min(1e4, Math.max(0, +new URLSearchParams(location.search).get("archivePreview") || 0));
const realMemoryBtn = document.getElementById("realMemoryBtn"), preview1000Btn = document.getElementById("preview1000Btn"), preview10000Btn = document.getElementById("preview10000Btn");
realMemoryBtn.classList.toggle("on", !activeArchivePreview);
preview1000Btn.classList.toggle("on", activeArchivePreview === 1e3);
preview10000Btn.classList.toggle("on", activeArchivePreview === 1e4);
realMemoryBtn.onclick = () => setArchivePreviewCount(0);
preview1000Btn.onclick = () => setArchivePreviewCount(1e3);
preview10000Btn.onclick = () => setArchivePreviewCount(1e4);
document.getElementById("centerRingBtn").onclick = () => {
    ringTune.x = 0;
    ringTune.y = currentTreeCenterY;
    document.querySelectorAll("[data-ring]").forEach(el => {
        const k = el.dataset.ring;
        if (k === "x" || k === "y") {
            el.value = ringTune[k];
            el.nextElementSibling.value = (+el.value).toFixed(2);
        }
    });
    applyRingTune();
    localStorage.setItem("memoryTreeRingTune", JSON.stringify(ringTune));
};
document.getElementById("resetViewBtn").onclick = () => {
    controls.target.set(0, .25, 0);
    camera.position.set(0, .8, 8.8);
    controls.update();
};
document.getElementById("pauseRotateBtn").onclick = e => {
    controls.autoRotate = !controls.autoRotate;
    e.currentTarget.textContent = controls.autoRotate ? "Ⅱ 暂停旋转" : "▶ 继续旋转";
};
const starSizePop = document.getElementById("starSizePop"), quickStarSize = document.getElementById("quickStarSize"), quickStarSizeOut = document.getElementById("quickStarSizeOut");
function syncQuickStarSize() {
    const value = +ringTune.starSize || 1;
    quickStarSize.value = value;
    quickStarSizeOut.value = value.toFixed(2);
}
syncQuickStarSize();
quickStarSize.oninput = () => {
    ringTune.starSize = +quickStarSize.value;
    quickStarSizeOut.value = (+quickStarSize.value).toFixed(2);
    const full = document.querySelector('[data-ring="starSize"]');
    if (full) {
        full.value = ringTune.starSize;
        full.nextElementSibling.value = ringTune.starSize.toFixed(2);
    }
    applyExtraTune();
    localStorage.setItem("memoryTreeRingTune", JSON.stringify(ringTune));
};
document.getElementById("quickStarSizeReset").onclick = () => {
    quickStarSize.value = 1;
    quickStarSize.oninput();
};
document.getElementById("starSizeBtn").onclick = () => {
    document.getElementById("ringPanel").classList.remove("on");
    syncQuickStarSize();
    starSizePop.classList.toggle("on");
};
document.getElementById("ringBtn").addEventListener("click", () => starSizePop.classList.remove("on"));
document.querySelector('[data-ring="starSize"]')?.addEventListener("input", syncQuickStarSize);
const treeChatBtn = document.getElementById("treeChatBtn");
treeChatBtn.hidden = true;
function setTreeChat() {}
let lastClawdReplyText = "Clawd 正在树下等你。", lastClawdRecalls = [];
function renderClawdReply(text) {
    clawdSpeech.textContent = visitorModeOn ? "Clawd 正在树下等你。" : String(text || "Clawd 正在树下等你。");
}
clawdSpeech.onclick = () => clawdSpeech.classList.remove("on", "chatting");
renderClawdReply(lastClawdReplyText);
let cinemaState = null, cinemaIdleTimer = 0, cinemaShotIndex = 0, cameraMoveToken = 0, cinemaCountdownTimer = 0;
const cinemaShots = [ {
    label: "全景",
    camera: new THREE.Vector3(0, .72, 9.25),
    target: new THREE.Vector3(0, .28, 0)
}, {
    label: "中景",
    camera: new THREE.Vector3(0, 1.02, 7.65),
    target: new THREE.Vector3(0, .58, 0)
}, {
    label: "树冠",
    camera: new THREE.Vector3(0, 1.58, 6.25),
    target: new THREE.Vector3(0, 1.28, 0)
} ];
function wakeCinemaControls() {
    if (!document.body.classList.contains("cinema")) return;
    document.body.classList.remove("cinema-idle");
    clearTimeout(cinemaIdleTimer);
    cinemaIdleTimer = setTimeout(() => document.body.classList.add("cinema-idle"), 2200);
}
function glideCinemaCamera(index) {
    if (!cinemaState) return;
    cinemaShotIndex = Math.max(0, Math.min(cinemaShots.length - 1, index));
    const shot = cinemaShots[cinemaShotIndex], fromCamera = camera.position.clone(), fromTarget = controls.target.clone();
    const token = ++cameraMoveToken, born = performance.now(), wasRotating = controls.autoRotate;
    controls.autoRotate = false;
    document.getElementById("cinemaShotBtn").textContent = "▣ " + shot.label;
    (function frame(now) {
        if (token !== cameraMoveToken || !cinemaState) return;
        const raw = Math.min(1, (now - born) / 920), k = raw * raw * (3 - 2 * raw);
        camera.position.lerpVectors(fromCamera, shot.camera, k);
        controls.target.lerpVectors(fromTarget, shot.target, k);
        controls.update();
        if (raw < 1) requestAnimationFrame(frame); else controls.autoRotate = wasRotating;
    })(performance.now());
    wakeCinemaControls();
}
function cancelCinemaCountdown() {
    clearInterval(cinemaCountdownTimer);
    cinemaCountdownTimer = 0;
    const el = document.getElementById("cinemaCountdown");
    el.classList.remove("on");
    el.textContent = "3";
    document.getElementById("cinemaPlayBtn").textContent = "⏱ 3秒开演";
}
function runCinemaCountdown() {
    if (cinemaCountdownTimer) {
        cancelCinemaCountdown();
        return;
    }
    if (lifeDemoRecord) {
        showLifeToast("生命周期演示正在进行");
        return;
    }
    const el = document.getElementById("cinemaCountdown"), btn = document.getElementById("cinemaPlayBtn");
    let n = 3;
    const paint = () => {
        el.textContent = String(n);
        el.classList.remove("on");
        void el.offsetWidth;
        el.classList.add("on");
    };
    paint();
    btn.textContent = "× 取消开演";
    document.body.classList.remove("cinema-idle");
    cinemaCountdownTimer = setInterval(() => {
        n--;
        if (n > 0) {
            paint();
            return;
        }
        cancelCinemaCountdown();
        lifeDemoGo = true;
        document.getElementById("lifeDemoBtn").click();
    }, 1e3);
}
function setCinemaMode(on) {
    const btn = document.getElementById("cinemaBtn");
    if (on) {
        if (cinemaState) return;
        cinemaState = {
            camera: camera.position.clone(),
            target: controls.target.clone(),
            autoRotate: controls.autoRotate,
            autoRotateSpeed: controls.autoRotateSpeed,
            enablePan: controls.enablePan
        };
        document.getElementById("memorySearch").classList.remove("on");
        document.getElementById("ringPanel").classList.remove("on");
        starSizePop.classList.remove("on");
        setTreeChat(false);
        setTreeSide(false);
        window.closeCard?.();
        document.body.appendChild(quickActionsEl);
        document.body.classList.add("cinema");
        cinemaShotIndex = 0;
        controls.target.copy(cinemaShots[0].target);
        camera.position.copy(cinemaShots[0].camera);
        controls.autoRotate = true;
        controls.autoRotateSpeed = .22;
        controls.enablePan = false;
        controls.update();
        document.getElementById("cinemaShotBtn").textContent = "▣ 全景";
        btn.textContent = "× 退出镜头";
        btn.setAttribute("aria-pressed", "true");
        wakeCinemaControls();
    } else {
        if (!cinemaState) return;
        cameraMoveToken++;
        cancelCinemaCountdown();
        clearTimeout(cinemaIdleTimer);
        document.body.classList.remove("cinema", "cinema-idle");
        camera.position.copy(cinemaState.camera);
        controls.target.copy(cinemaState.target);
        controls.autoRotate = cinemaState.autoRotate;
        controls.autoRotateSpeed = cinemaState.autoRotateSpeed;
        controls.enablePan = cinemaState.enablePan;
        controls.update();
        document.getElementById("pauseRotateBtn").textContent = controls.autoRotate ? "Ⅱ 暂停旋转" : "▶ 继续旋转";
        cinemaState = null;
        btn.textContent = "◉ 镜头模式";
        btn.setAttribute("aria-pressed", "false");
        {
            const showBody = document.querySelector('.pg[data-group="show"] .pg-body');
            if (showBody) showBody.appendChild(quickActionsEl); else treeSidePanel.appendChild(quickActionsEl);
        }
    }
}
document.getElementById("cinemaBtn").onclick = () => setCinemaMode(!cinemaState);
document.getElementById("cinemaShotBtn").onclick = () => glideCinemaCamera((cinemaShotIndex + 1) % cinemaShots.length);
document.getElementById("cinemaPlayBtn").onclick = runCinemaCountdown;
addEventListener("pointermove", wakeCinemaControls, {
    passive: true
});
addEventListener("keydown", e => {
    if (/INPUT|SELECT|TEXTAREA/.test(e.target?.tagName) || e.target?.isContentEditable) return;
    if (e.key === "Escape" && cinemaState) {
        setCinemaMode(false);
        return;
    }
    if (e.key.toLowerCase() === "m") {
        setCinemaMode(!cinemaState);
        return;
    }
    if (!cinemaState) return;
    if ([ "1", "2", "3" ].includes(e.key)) {
        glideCinemaCamera(+e.key - 1);
        return;
    }
    if (e.key.toLowerCase() === "d") {
        runCinemaCountdown();
        return;
    }
    if (e.code === "Space") {
        e.preventDefault();
        controls.autoRotate = !controls.autoRotate;
        showLifeToast(controls.autoRotate ? "镜头继续缓慢旋转" : "镜头已暂停");
    }
});
const manifest = [ {
    n: "23",
    file: "23-tree-gn.glb",
    name: "Tree GN·主世界树",
    mb: 23,
    source: "Sketchfab · TechArtBGN / Node_λrt",
    license: "CC BY"
} ];
let active = null, token = 0;
const loader = new GLTFLoader, cards = document.getElementById("cards"), load = document.getElementById("load");
const clean = o => {
    o.traverse(x => {
        if (x.geometry) x.geometry.dispose();
        if (x.material) {
            const a = Array.isArray(x.material) ? x.material : [ x.material ];
            a.forEach(m => m.dispose());
        }
    });
    scene.remove(o);
};
function analyzeBranchComps(source, prefix) {
    if (source.userData.__branchComps) return source.userData.__branchComps;
    const idx = source.index, pa = source.attributes.position;
    const invalid = new Set;
    for (let i = 0; i < pa.count; i++) if (!Number.isFinite(pa.getX(i)) || !Number.isFinite(pa.getY(i)) || !Number.isFinite(pa.getZ(i))) invalid.add(i);
    const faces = idx.count / 3, parent = new Int32Array(faces), weight = new Int32Array(faces);
    for (let i = 0; i < faces; i++) {
        parent[i] = i;
        weight[i] = 1;
    }
    const find = x => {
        while (parent[x] !== x) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    }, join = (a, b) => {
        a = find(a);
        b = find(b);
        if (a === b) return;
        if (weight[a] < weight[b]) [a, b] = [ b, a ];
        parent[b] = a;
        weight[a] += weight[b];
    }, owner = new Map;
    for (let f = 0; f < faces; f++) for (let k = 0; k < 3; k++) {
        const v = idx.getX(f * 3 + k);
        if (owner.has(v)) join(f, owner.get(v)); else owner.set(v, f);
    }
    const byRoot = new Map, compOf = new Int32Array(faces).fill(-1), v = new THREE.Vector3;
    for (let f = 0; f < faces; f++) {
        const r = find(f);
        if (!byRoot.has(r)) byRoot.set(r, {
            id: f,
            faces: [],
            min: new THREE.Vector3(Infinity, Infinity, Infinity),
            max: new THREE.Vector3(-Infinity, -Infinity, -Infinity)
        });
        const c = byRoot.get(r);
        c.faces.push(f);
        compOf[f] = c.id;
        for (let k = 0; k < 3; k++) {
            const vi = idx.getX(f * 3 + k);
            if (invalid.has(vi)) continue;
            v.fromBufferAttribute(pa, vi);
            c.min.min(v);
            c.max.max(v);
        }
    }
    const comps = [ ...byRoot.values() ];
    for (const c of comps) {
        c.key = prefix + ":" + c.id;
        c.diag = Number.isFinite(c.min.x) ? c.min.distanceTo(c.max) : 0;
        c.junk = c.faces.length < 18 || c.min.x > -.5 && c.max.x < 1.5 && c.min.y > -1.7 && c.max.y < .35 && c.min.z > 1.3 && c.max.z < 3.5;
    }
    const byId = new Map(comps.map(c => [ c.id, c ]));
    const table = {
        comps: comps,
        byId: byId,
        compOf: compOf,
        invalid: invalid,
        faces: faces,
        prefix: prefix
    };
    source.userData.__branchComps = table;
    return table;
}
function resetBranchStat() {
    window.__branchStat = {
        total: 0,
        alive: 0,
        auto: 0,
        hand: 0,
        kept: 0,
        thin: 0
    };
}
function pruneTreeGNGeometry(source, prefix) {
    const table = analyzeBranchComps(source, prefix || "0");
    const geo = source.clone(), idx = geo.index, pa = geo.attributes.position;
    if (!idx || !pa) return geo;
    for (const i of table.invalid) pa.setXYZ(i, 0, 0, 0);
    if (table.invalid.size) pa.needsUpdate = true;
    const remove = new Set;
    for (const c of table.comps) if (c.junk) c.faces.forEach(f => remove.add(f));
    const alive = table.comps.filter(c => !c.junk).sort((a, b) => a.diag - b.diag);
    const thin = Math.max(0, Math.min(.85, +window.BRANCH_UI?.thin || 0));
    const auto = Math.min(alive.length - 1, Math.round(alive.length * thin));
    for (let i = 0; i < auto; i++) alive[i].faces.forEach(f => remove.add(f));
    let hand = 0;
    const trunk = alive[alive.length - 1];
    for (const c of alive) {
        if (c === trunk || !window.BRANCH_CUTS?.has(c.key)) continue;
        if (!remove.has(c.faces[0])) hand++;
        c.faces.forEach(f => remove.add(f));
    }
    const s = window.__branchStat || (window.__branchStat = {
        total: 0,
        alive: 0,
        auto: 0,
        hand: 0,
        kept: 0
    });
    s.total += table.comps.length;
    s.alive += alive.length;
    s.auto += auto;
    s.hand += hand;
    s.thin = thin;
    s.kept += alive.filter(c => !remove.has(c.faces[0])).length;
    const kept = [], faceMap = [];
    for (let f = 0; f < table.faces; f++) {
        if (remove.has(f)) continue;
        const a = idx.getX(f * 3), b = idx.getX(f * 3 + 1), c = idx.getX(f * 3 + 2);
        const valid = [ a, b, c ].every(i => i >= 0 && i < pa.count && !table.invalid.has(i));
        if (valid) {
            kept.push(a, b, c);
            faceMap.push(f);
        }
    }
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(kept), 1));
    geo.userData.faceMap = new Uint32Array(faceMap);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
}
function beautifyTreeGNRoots(source) {
    const geo = source.clone(), pa = geo.attributes.position;
    if (!pa) return geo;
    for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
        if (z >= 1.15) continue;
        const radial = Math.hypot(x, y), depth = THREE.MathUtils.clamp((1.15 - z) / 2.85, 0, 1), ease = depth * depth * (3 - 2 * depth);
        const tip = THREE.MathUtils.smoothstep(radial, .75, 2.8), softFloor = -.34 - tip * .12, nz = Math.max(z, softFloor);
        pa.setXYZ(i, x, y, THREE.MathUtils.lerp(z, nz, ease * .72));
    }
    pa.needsUpdate = true;
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
}
let memoryBranchTipsWorld = [];
var LEAF_UI = {
    count: 72,
    size: 1,
    spin: 1,
    pair: .72
};
var lastTreeRoot = null, lastLeafSources = null, lastBranchSources = null, lastVineSources = null;
window.BRANCH_UI = {
    thin: +(localStorage.getItem("memoryTreeBranchThin") || 0) || 0
};
window.BRANCH_CUTS = new Set((() => {
    try {
        return JSON.parse(localStorage.getItem("memoryTreeBranchCuts") || "[]");
    } catch (e) {
        return [];
    }
})());
var branchCutHistory = [], branchPickMode = false, branchHoverKey = null, branchHoverMesh = null;
function saveBranchCuts() {
    localStorage.setItem("memoryTreeBranchCuts", JSON.stringify([ ...window.BRANCH_CUTS ]));
    localStorage.setItem("memoryTreeBranchDirty", "1");
}
function stashBranchCuts() {
    const now = [ ...window.BRANCH_CUTS ];
    if (!now.length) return;
    localStorage.setItem("memoryTreeBranchCutsPrev", JSON.stringify(now));
}
fetch("/api/starmap/branch-prune").then(r => r.json()).then(cfg => {
    if (localStorage.getItem("memoryTreeBranchDirty")) return;
    const localCuts = (() => {
        try {
            return JSON.parse(localStorage.getItem("memoryTreeBranchCuts") || "[]");
        } catch (e) {
            return [];
        }
    })();
    if (Array.isArray(cfg.cuts) && cfg.cuts.length === localCuts.length && cfg.cuts.every(k => localCuts.includes(k)) && (+cfg.thin || 0) === (+localStorage.getItem("memoryTreeBranchThin") || 0)) return;
    const cuts = Array.isArray(cfg.cuts) ? cfg.cuts : [];
    window.BRANCH_CUTS = new Set(cuts);
    if (typeof cfg.thin === "number") window.BRANCH_UI.thin = Math.max(0, Math.min(.85, cfg.thin));
    localStorage.setItem("memoryTreeBranchCuts", JSON.stringify(cuts));
    localStorage.setItem("memoryTreeBranchThin", String(window.BRANCH_UI.thin));
    document.querySelectorAll("#branchRows .rrow").forEach(d => d._sync && d._sync());
    if (lastBranchSources) rebuildBranches(true);
}).catch(() => {});
function cleanCrownLeaves(root, sources, branches) {
    lastTreeRoot = root;
    lastLeafSources = sources;
    lastBranchSources = branches;
    root.getObjectByName("clean-memory-leaves")?.traverse(o => {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
    });
    root.getObjectByName("clean-memory-leaves")?.removeFromParent();
    root.updateMatrixWorld(true);
    const inv = (new THREE.Matrix4).copy(root.matrixWorld).invert(), crownBox = new THREE.Box3;
    sources.forEach(mesh => {
        mesh.geometry.computeBoundingBox();
        crownBox.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
    });
    let seed = 230723;
    const rnd = () => {
        seed |= 0;
        seed = seed + 1831565813 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const candidates = [];
    for (const mesh of branches) {
        const geo = mesh.geometry, idx = geo.index, pa = geo.attributes.position;
        if (!idx) continue;
        const faces = idx.count / 3, parent = new Int32Array(faces);
        for (let i = 0; i < faces; i++) parent[i] = i;
        const find = x => {
            while (parent[x] !== x) {
                parent[x] = parent[parent[x]];
                x = parent[x];
            }
            return x;
        }, join = (a, b) => {
            a = find(a);
            b = find(b);
            if (a !== b) parent[b] = a;
        }, owner = new Map;
        for (let f = 0; f < faces; f++) for (let k = 0; k < 3; k++) {
            const vi = idx.getX(f * 3 + k);
            if (owner.has(vi)) join(f, owner.get(vi)); else owner.set(vi, f);
        }
        const comps = new Map;
        for (let f = 0; f < faces; f++) {
            const r = find(f);
            if (!comps.has(r)) comps.set(r, new Set);
            for (let k = 0; k < 3; k++) comps.get(r).add(idx.getX(f * 3 + k));
        }
        for (const ids of comps.values()) {
            let tip = null, best = -Infinity;
            for (const vi of ids) {
                const p = (new THREE.Vector3).fromBufferAttribute(pa, vi).applyMatrix4(mesh.matrixWorld);
                const score = Math.hypot(p.x, p.z) * 1.25 + p.y * .52;
                if (p.y > -.55 && score > best) {
                    best = score;
                    tip = p;
                }
            }
            if (tip) candidates.push(tip);
        }
    }
    memoryBranchTipsWorld = candidates.map(p => p.clone());
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [candidates[i], candidates[j]] = [ candidates[j], candidates[i] ];
    }
    const chosen = [], grid = new Set;
    for (const p of candidates) {
        const k = `${Math.round(p.x / .31)},${Math.round(p.y / .31)},${Math.round(p.z / .31)}`;
        if (grid.has(k)) continue;
        const ringGap = Math.abs(p.y - ring.position.y) < .28, starWindow = Math.abs(p.x) < .7 && p.y > .18 && p.y < 2.45;
        if (ringGap && rnd() < .44 || starWindow && rnd() < .4) continue;
        grid.add(k);
        chosen.push(p.clone().applyMatrix4(inv));
        if (chosen.length >= LEAF_UI.count) break;
    }
    const shape = new THREE.Shape;
    shape.moveTo(0, -.24);
    shape.bezierCurveTo(.082, -.11, .088, .075, 0, .275);
    shape.bezierCurveTo(-.088, .075, -.082, -.11, 0, -.24);
    const base = new THREE.ShapeGeometry(shape, 4), batches = [ [], [], [] ], matrix = new THREE.Matrix4, pos = new THREE.Vector3, rot = new THREE.Euler, scale = new THREE.Vector3;
    chosen.forEach(center => {
        const count = rnd() < LEAF_UI.pair ? 2 : 1;
        for (let j = 0; j < count; j++) {
            pos.copy(center).add(new THREE.Vector3((rnd() - .5) * .22, (rnd() - .5) * .2, (rnd() - .5) * .21));
            const spin = LEAF_UI.spin, baseA = Math.atan2(center.x, center.z);
            rot.set((rnd() - .5) * .82 * spin, (rnd() - .5) * .9 * spin, baseA + (rnd() - .5) * Math.PI * 2 * spin);
            const s = (1.48 + rnd() * .76) * LEAF_UI.size;
            scale.set(s * (.7 + rnd() * .23), s, 1);
            matrix.compose(pos, (new THREE.Quaternion).setFromEuler(rot), scale);
            const g = base.clone();
            g.applyMatrix4(matrix);
            batches[Math.floor(rnd() * batches.length)].push(g);
        }
    });
    const group = new THREE.Group, palette = [ "#b96f98", "#cf82a8", "#9173aa" ];
    batches.forEach((list, i) => {
        if (!list.length) return;
        const geo = mergeGeometries(list, false), mat = new THREE.MeshStandardMaterial({
            color: palette[i],
            emissive: "#55213c",
            emissiveIntensity: .28,
            roughness: .84,
            metalness: 0,
            transparent: true,
            opacity: .88,
            side: THREE.DoubleSide,
            depthWrite: true
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        group.add(mesh);
        list.forEach(g => g.dispose());
    });
    base.dispose();
    group.name = "clean-memory-leaves";
    root.add(group);
    return group;
}
let memoryFormGroups = {};
const formVisibility = {
    archive: true,
    star: true,
    seed: true,
    dew: true,
    fruit: true
}, memoryRecords = {
    archive: [],
    star: [],
    seed: [],
    dew: [],
    fruit: []
};
let allMemoryRecords = [], memoryFilterState = readMemoryQuery(), memorySearchResults = [], memorySearchCursor = -1;
const internallyOpenedStar = sessionStorage.getItem("memoryTreeLastOpenedStar");
const memoryPageReload = performance.getEntriesByType("navigation")[0]?.type === "reload";
if (memoryFilterState.star && (memoryPageReload || internallyOpenedStar === String(memoryFilterState.star))) {
    const cleanUrl = new URL(location.href);
    cleanUrl.searchParams.delete("star");
    history.replaceState({}, "", cleanUrl);
    memoryFilterState = {
        ...memoryFilterState,
        star: ""
    };
    sessionStorage.removeItem("memoryTreeLastOpenedStar");
}
let archiveLayoutMode = initialArchiveLayout;
function syncArchiveLayoutControls() {
    const b = document.getElementById("waterfallModeBtn");
    if (b) {
        b.textContent = `星环瀑布：${archiveLayoutMode === "waterfall" ? "开启" : "关闭"}`;
        b.classList.toggle("on", archiveLayoutMode === "waterfall");
    }
    const rb = document.getElementById("riverModeBtn");
    if (rb) {
        rb.textContent = "原版记忆河";
        rb.classList.toggle("on", archiveLayoutMode === "river" && !pearlEnabled);
    }
    stars.visible = archiveLayoutMode === "ring";
    memoryRiverMist.visible = false;
    if (archiveLayoutMode !== "river") clearRiverDecor();
    riverPanelVisible();
    riverSyncStat();
    canvas.dataset.archiveLayout = archiveLayoutMode;
    syncWardrobePearl();
}
function setArchiveLayoutMode(mode) {
    archiveLayoutMode = [ "waterfall", "river" ].includes(mode) ? mode : "ring";
    localStorage.setItem("memoryTreeArchiveLayout", archiveLayoutMode);
    const url = new URL(location.href);
    url.searchParams.set("archiveLayout", archiveLayoutMode);
    history.replaceState({}, "", url);
    syncArchiveLayoutControls();
    populateArchiveCloud();
    applyRingTune();
}
syncArchiveLayoutControls();
let archiveOrbitPaused = false, archiveOrbitAngle = 0, archivePointCloud = null, archivePointMaterial = null, archiveEnterBorn = 0, archiveWelcomeChecked = false, archiveBaseColors = null, archiveConstellationLines = null, archiveConstellationIndices = [], archivePulseBorn = 0;
const archiveSecondMatrix = new THREE.Matrix4, archiveTmpPoint = new THREE.Vector3;
let memoryHitMeshes = [];
const memoryHitGeo = new THREE.SphereGeometry(1, 10, 8), memoryHitMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false
});
function addMemoryHit(group, p, r, type, index) {
    const hit = new THREE.Mesh(memoryHitGeo.clone(), memoryHitMat.clone());
    hit.position.set(...p);
    hit.scale.setScalar(r);
    hit.userData = {
        memoryForm: type,
        memoryIndex: index,
        memoryData: memoryRecords[type][index % Math.max(1, memoryRecords[type].length)] || null
    };
    group.add(hit);
    memoryHitMeshes.push(hit);
    return hit;
}
let soloMode = false, soloType = "seed";
function applySoloVisibility() {
    Object.entries(memoryFormGroups).forEach(([k, g]) => {
        if (g) g.visible = soloMode ? k === soloType : formVisibility[k];
    });
    if (active) active.traverse(o => o.layers.set(0));
    Object.entries(memoryFormGroups).forEach(([k, g]) => g?.traverse(o => o.layers.set(soloMode && k === soloType ? 1 : 0)));
    ring.traverse(o => o.layers.set(soloMode && soloType === "archive" ? 1 : 0));
    ring2.traverse(o => o.layers.set(soloMode && soloType === "archive" ? 1 : 0));
    camera.layers.set(soloMode ? 1 : 0);
    stars.layers.enable(1);
    [ hemi, key, rim, backFill, core, ringLight, beam, beam.target ].forEach(light => light.layers.enable(1));
    ring.visible = !soloMode || soloType === "archive";
    ring2.visible = (!soloMode || soloType === "archive") && ringTune.mode === "double";
    document.querySelectorAll("[data-form]").forEach(btn => {
        const k = btn.dataset.form;
        btn.classList.toggle("solo", soloMode && k === soloType);
        btn.classList.toggle("off", soloMode ? k !== soloType : !formVisibility[k]);
    });
    document.querySelectorAll(".safe-dew").forEach(el => el.style.display = soloMode && soloType !== "dew" ? "none" : "");
    canvas.dataset.soloState = JSON.stringify(Object.fromEntries(Object.entries(memoryFormGroups).map(([k, g]) => [ k, {
        visible: !!g?.visible,
        children: g?.children?.length || 0
    } ])));
    const b = document.getElementById("soloModeBtn");
    b.classList.toggle("on", soloMode);
    b.textContent = soloMode ? "× 退出只看" : "◎ 只看";
}
document.querySelectorAll("[data-form]").forEach(btn => btn.onclick = () => {
    const k = btn.dataset.form;
    if (soloMode) soloType = k; else formVisibility[k] = !formVisibility[k];
    applySoloVisibility();
});
document.getElementById("soloModeBtn").onclick = () => {
    soloMode = !soloMode;
    applySoloVisibility();
};
function spreadRecords(list, count) {
    if (!list.length) return [];
    if (list.length <= count) return list.slice();
    return Array.from({
        length: count
    }, (_, i) => list[Math.round(i * (list.length - 1) / Math.max(1, count - 1))]);
}
function bindMemoryRecords() {
    memoryHitMeshes.forEach(hit => {
        const a = memoryRecords[hit.userData.memoryForm] || [], i = hit.userData.memoryIndex || 0;
        if (hit.userData.memoryForm === "star" && allMemoryRecords.length) {
            const has = i < a.length;
            hit.userData.memoryData = has ? a[i] : null;
            if (hit.userData.visual) hit.userData.visual.visible = has;
            return;
        }
        hit.userData.memoryData = a[i % Math.max(1, a.length)] || null;
    });
}
function populateArchiveCloud() {
    const group = memoryFormGroups.archive;
    if (!group || !memoryRecords.archive.length) return;
    if (archivePointCloud) {
        const ix = memoryHitMeshes.indexOf(archivePointCloud);
        if (ix >= 0) memoryHitMeshes.splice(ix, 1);
        archivePointCloud.removeFromParent();
        archivePointCloud.geometry.dispose();
        archivePointCloud.material.dispose();
    }
    const records = memoryRecords.archive.length > 1600 ? spreadRecords(memoryRecords.archive, 1600) : memoryRecords.archive, n = records.length, pos = new Float32Array(n * 3), colors = new Float32Array(n * 3), sizes = new Float32Array(n), glows = new Float32Array(n), angles = new Float32Array(n), ys = new Float32Array(n), radii = new Float32Array(n), rounds = new Float32Array(n), palette = [ "#ffc9e9", "#ead5ff", "#fff1c9", "#dcb7f3" ];
    for (let i = 0; i < n; i++) {
        const lane = i % 7 - 3, a = i / n * Math.PI * 2 + i % 11 * .006, r = 2.8 + lane * .075 + Math.sin(i * 1.73) * .018, round = .48 + (i * 3 % 5 - 2) * .014, y = lane * .022 + Math.sin(i * 2.17) * .035, importance = +(records[i]?.importance || 5), large = records[i]?.pinned || importance >= 9 || i % 41 === 0, medium = !large && (importance >= 7 || i % 9 === 0);
        angles[i] = a;
        radii[i] = r;
        rounds[i] = round;
        ys[i] = y;
        sizes[i] = large ? .145 : medium ? .092 : .043 + i % 4 * .006;
        glows[i] = large ? 1 : medium ? .72 : .38;
        pos.set([ Math.cos(a) * r, y, Math.sin(a) * r * round ], i * 3);
        const c = new THREE.Color(large ? "#fff2ce" : palette[i % palette.length]);
        colors.set([ c.r, c.g, c.b ], i * 3);
    }
    const geo = new THREE.BufferGeometry;
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("pointSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("glow", new THREE.BufferAttribute(glows, 1));
    archivePointMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uScale: {
                value: innerHeight * .62
            },
            uReveal: {
                value: 0
            }
        },
        vertexShader: `attribute float pointSize;attribute float glow;varying vec3 vColor;varying float vGlow;uniform float uScale;void main(){vColor=color;vGlow=glow;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=pointSize*uScale/max(1.0,-mv.z);gl_Position=projectionMatrix*mv;}`,
        fragmentShader: `varying vec3 vColor;varying float vGlow;uniform float uReveal;void main(){float d=length(gl_PointCoord-vec2(.5));if(d>.5)discard;float halo=1.0-smoothstep(.10,.50,d);float core=1.0-smoothstep(.02,.17,d);float alpha=(halo*(.34+vGlow*.34)+core*(.30+vGlow*.24))*uReveal;gl_FragColor=vec4(vColor*(1.0+core*(.42+vGlow*.48)),alpha);}`,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
    });
    archivePointCloud = new THREE.Points(geo, archivePointMaterial);
    archivePointCloud.name = "all-archived-memory-stars";
    archivePointCloud.frustumCulled = false;
    archivePointCloud.userData = {
        memoryForm: "archiveCloud",
        records: records,
        angles: angles,
        ys: ys,
        radii: radii,
        rounds: rounds
    };
    group.add(archivePointCloud);
    memoryHitMeshes.push(archivePointCloud);
    archiveEnterBorn = performance.now();
    if (!archiveWelcomeChecked) {
        archiveWelcomeChecked = true;
        scheduleArchiveWelcome(memoryRecords.archive.length);
    }
    raycaster.params.Points.threshold = .18;
}
const RIVER_PRESET = {
    linesPerCluster: 44,
    clusterInnerSpan: .92,
    halfWidth: 1060,
    wave1Amp: 470,
    wave1Cyc: 2.85,
    wobbleAmp: .05,
    lineJitter: 12,
    islandPush: 150,
    islandCore: .28,
    islandSpanT: .062
};
const RIVER_SCALE = 10.3 / 2120;
const RIVER_GROUND = -2.43;
const RIVER_PAL = [ "#fff3f7", "#ffc9dd", "#c9b6f2", "#9fc4f0" ];
var riverCache = null, riverDecor = null, riverFilaMat = null, riverDustMat = null, riverBedMat = null;
var RIVER_LOOK_BED = 9e4, RIVER_LOOK_DUST = 12e4, riverPreviewN = 0;
const rhash = i => {
    const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return v - Math.floor(v);
};
function riverGeom() {
    if (!riverCache) {
        const R = buildRiver(RIVER_PRESET), isle = riverCenter(R.params.islandT, R.params);
        riverCache = {
            R: R,
            ox: -isle.x * RIVER_SCALE,
            oz: -isle.z * RIVER_SCALE
        };
    }
    return riverCache;
}
function riverPick(i) {
    const {R: R, ox: ox, oz: oz} = riverGeom(), L = R.lines;
    let li = rhash(i * 3 + 11) * L.length | 0, line = L[Math.min(L.length - 1, li)], u = rhash(i * 5 + 29);
    for (let k = 0; k < 6; k++) {
        const idx = Math.min(line.pts.length - 2, u * (line.pts.length - 1) | 0);
        if (rhash(i * 7 + k * 131 + 3) <= line.pts[idx].fade * (.35 + .65 * line.strength)) break;
        li = rhash(i * 3 + 11 + k * 77) * L.length | 0;
        line = L[Math.min(L.length - 1, li)];
        u = rhash(i * 5 + 29 + k * 53);
    }
    const fi = u * (line.pts.length - 1), idx = Math.min(line.pts.length - 2, fi | 0);
    const a = line.pts[idx], b = line.pts[idx + 1], m = fi - idx;
    let tx = b.x - a.x, tz = b.z - a.z;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const g = j => rhash(i * 11 + j) + rhash(i * 13 + j * 3) + rhash(i * 17 + j * 7) - 1.5;
    const along = g(1) * .75 * 3.4, across = g(2) * .75 * .3;
    return {
        x: (a.x + (b.x - a.x) * m + tx * along - tz * across) * RIVER_SCALE + ox,
        y: RIVER_GROUND + (rhash(i * 19 + 5) - .5) * .05,
        z: (a.z + (b.z - a.z) * m + tz * along + tx * across) * RIVER_SCALE + oz,
        fade: a.fade,
        key: line.colorKey,
        core: Math.abs(line.u) < .34,
        t: a.t
    };
}
const RIVER_ROWS = [ [ "h", "河的走向" ], [ "halfWidth", "河宽", 300, 1600, 20, "geo" ], [ "wave1Amp", "弯道幅度", 0, 700, 10, "geo" ], [ "wave1Cyc", "弯道数量", .6, 3.2, .05, "geo" ], [ "h", "流束" ], [ "clusters", "流束条数", 4, 30, 1, "geo" ], [ "linesPerCluster", "每束密度", 3, 80, 1, "geo" ], [ "clusterInnerSpan", "流束宽度", .2, 1.4, .02, "geo" ], [ "wobbleAmp", "流束摆动", 0, .4, .01, "geo" ], [ "islandPush", "树下让开多少", 0, 400, 10, "geo" ], [ "h", "两端虚化" ], [ "taperMin", "两端收到多窄", .1, 1, .02, "geo" ], [ "farFadeSpan", "远端虚化长度", .1, .9, .02, "geo" ], [ "nearFadeStart", "近端虚化起点", .1, .95, .02, "geo" ], [ "h", "星尘密度" ], [ "_dust", "流束星尘", 0, 3e5, 1e4, "dens" ], [ "_bed", "河床星尘", 0, 26e4, 1e4, "dens" ], [ "_preview", "预览规模（0=按真实记忆数）", 0, 5e4, 500, "geo" ], [ "h", "光（零重建，随手拖）" ], [ "_fila", "丝线亮度", 0, .6, .005, "live" ], [ "_dust A", "流束亮度", 0, 3, .02, "live" ], [ "_bedA", "河床亮度", 0, 3, .02, "live" ] ];
const RIVER_UI = {
    _dust: 12e4,
    _bed: 9e4,
    _preview: 0,
    _fila: .075,
    "_dust A": .88,
    _bedA: .55
};
const RIVER_UI_BASE = {
    ...RIVER_UI
}, RIVER_PRESET_BASE = {
    ...RIVER_PRESET
}, RIVER_PAL_BASE = [ ...RIVER_PAL ];
function riverGet(k) {
    return k in RIVER_UI ? RIVER_UI[k] : k in RIVER_PRESET ? RIVER_PRESET[k] : RIVER_DEFAULTS[k];
}
function riverSet(k, v) {
    if (k in RIVER_UI) RIVER_UI[k] = v; else RIVER_PRESET[k] = v;
}
function riverApplyLive() {
    if (riverFilaMat) riverFilaMat.uniforms.uA.value = RIVER_UI._fila;
    if (riverDustMat) riverDustMat.uniforms.uA.value = RIVER_UI["_dust A"];
    if (riverBedMat) riverBedMat.uniforms.uA.value = RIVER_UI._bedA;
}
let riverRebuildTimer = null;
function riverRebuild(kind) {
    clearTimeout(riverRebuildTimer);
    riverRebuildTimer = setTimeout(() => {
        RIVER_LOOK_DUST = RIVER_UI._dust;
        RIVER_LOOK_BED = RIVER_UI._bed;
        riverPreviewN = RIVER_UI._preview;
        if (kind === "geo") riverCache = null;
        populateArchiveCloud();
        bindMemoryRecords();
        riverSyncStat();
    }, kind === "geo" ? 260 : 200);
}
function riverSyncStat() {
    const el = document.getElementById("riverStat");
    if (!el) return;
    let n = 0;
    try {
        n = archivePointCloud?.userData?.records?.length || 0;
    } catch (e) {
        return;
    }
    el.textContent = `记忆星 ${n} 颗${RIVER_UI._preview ? "（预览规模）" : "（= 实际记忆数）"} · 星尘 ${RIVER_LOOK_DUST + RIVER_LOOK_BED}`;
}
function buildRiverPanel() {
    const box = document.getElementById("riverRows");
    if (!box) return;
    box.innerHTML = "";
    for (const r of RIVER_ROWS) {
        if (r[0] === "h") {
            const h = document.createElement("h4");
            h.textContent = r[1];
            box.appendChild(h);
            continue;
        }
        const [k, label, mn, mx, st, kind] = r;
        const d = document.createElement("div");
        d.className = "rrow";
        d.innerHTML = `<label><span>${label}</span><b></b></label><input type="range" min="${mn}" max="${mx}" step="${st}">`;
        const inp = d.querySelector("input"), out = d.querySelector("b");
        const sync = () => {
            const v = riverGet(k);
            inp.value = v;
            out.textContent = Number.isInteger(v) ? v : (+v).toFixed(2);
        };
        inp.addEventListener("input", () => {
            const v = +inp.value;
            riverSet(k, v);
            out.textContent = Number.isInteger(v) ? v : v.toFixed(2);
            if (kind === "live") riverApplyLive(); else riverRebuild(kind);
        });
        d._sync = sync;
        sync();
        box.appendChild(d);
    }
    const sw = document.getElementById("riverSwatches");
    sw.className = "rsw";
    sw.innerHTML = "";
    RIVER_PAL.forEach((hex, i) => {
        const inp = document.createElement("input");
        inp.type = "color";
        inp.value = hex;
        inp.title = [ "珍珠白", "淡粉", "薰衣草紫", "冷蓝" ][i];
        inp.addEventListener("input", () => {
            RIVER_PAL[i] = inp.value;
            riverRebuild("dens");
        });
        sw.appendChild(inp);
    });
}
function riverPanelSync() {
    document.querySelectorAll("#riverRows .rrow").forEach(d => d._sync && d._sync());
    document.querySelectorAll("#riverSwatches input").forEach((inp, i) => inp.value = RIVER_PAL[i]);
}
function riverPanelVisible() {
    const el = document.getElementById("riverPanel");
    if (el) el.style.display = archiveLayoutMode === "river" && !pearlEnabled ? "block" : "none";
    const pp = document.getElementById("pearlPanel");
    if (pp) pp.style.display = archiveLayoutMode === "river" && pearlEnabled ? "block" : "none";
}
let pearlPanelTimer;
function buildPearlPanel() {
    const p = ensureWardrobePearl(), box = document.getElementById("pearlRows");
    box.innerHTML = "";
    for (const k in PEARL_MEM_DEFAULT) if (p.state[k] == null) p.state[k] = PEARL_MEM_DEFAULT[k];
    const rows = [ [ "_memSize", "记忆星大小", .3, 6, .05, "live" ], [ "_memBright", "记忆星亮度", .2, 4, .05, "live" ], [ "_rippleA", "涟漪亮度", 0, 3, .05, "live" ], [ "_rippleSize", "涟漪大小", .3, 3, .05, "live" ], [ "_rippleDuration", "涟漪时长倍率", .5, 2, .05, "live" ], [ "_rippleAfter", "消散后星光", 0, 2, .05, "live" ], [ "_riverA", "整体河流明暗", 0, 3, .02, "live" ], [ "_filaKnee", "压暗突兀亮丝", 0, 60, 1, "live" ], [ "_filaCap", "丝线分散（0=不限）", 0, 40, 1 ], [ "_filaRidge", "丝线集中度", .5, 4, .1 ], [ "halfWidth", "河宽", 300, 2200, 20 ], [ "wave1Amp", "弯道幅度", 0, 1200, 10 ], [ "wave1Cyc", "弯道数量", .6, 4, .05 ], [ "_filaN", "丝线数量", 0, 6e3, 100 ], [ "_fila", "丝线亮度", 0, .6, .005, "live" ], [ "_flowA", "流光亮度", 0, 4, .02, "live" ], [ "_dustA", "星尘亮度", 0, 4, .02, "live" ], [ "_mistA", "珠光雾面", 0, 3, .02, "live" ], [ "_bedA", "河床亮度", 0, 3, .02, "live" ], [ "_hazeA", "薄雾亮度", 0, 2, .02, "live" ], [ "_dust", "星尘数量", 0, 3e5, 5e3 ], [ "_flow", "流光数量", 0, 2e5, 5e3 ], [ "taperFar", "远端渐隐长度", .05, .49, .01 ], [ "taperNear", "近端渐隐起点", .51, .95, .01 ] ];
    for (const [k, label, min, max, step, live] of rows) {
        const row = document.createElement("div");
        row.className = "rrow";
        row.innerHTML = `<label><span>${label}</span><b>${+Number(p.state[k]).toFixed(3)}</b></label><input aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}" value="${p.state[k]}">`;
        const input = row.querySelector("input");
        input.oninput = () => {
            wardrobePearl.state[k] = +input.value;
            row.querySelector("b").textContent = input.value;
            if (live) wardrobePearl.applyLive(); else pearlDragRebuild();
        };
        if (!live) input.onchange = () => {
            wardrobePearl.state[k] = +input.value;
            rebuildPearl();
        };
        box.appendChild(row);
    }
    for (const [key, label, lo, hi, st] of [ [ "zFar", "星河长度(往远处)", 2e3, 24e3, 200 ], [ "zNear", "星河长度(往近处)", 600, 8e3, 100 ] ]) {
        const sign = key === "zFar" ? -1 : 1, cur = Math.round(Math.abs(+p.state[key]));
        const row = document.createElement("div");
        row.className = "rrow";
        row.innerHTML = `<label><span>${label}</span><b>${cur}</b></label><input aria-label="${label}" type="range" min="${lo}" max="${hi}" step="${st}" value="${Math.min(hi, Math.max(lo, cur))}">`;
        const inp = row.querySelector("input");
        const put = v => {
            wardrobePearl.state[key] = sign * Math.abs(+v);
        };
        inp.oninput = () => {
            put(inp.value);
            row.querySelector("b").textContent = inp.value;
            pearlDragRebuild();
        };
        inp.onchange = () => {
            put(inp.value);
            rebuildPearl();
        };
        box.appendChild(row);
    }
    {
        const cur = +p.state._memGather || 0, row = document.createElement("div");
        row.className = "rrow";
        row.innerHTML = `<label><span>记忆星聚拢(往树脚下)</span><b>${cur.toFixed(2)}</b></label><input aria-label="记忆星聚拢" type="range" min="0" max="1" step="0.02" value="${cur}">`;
        const inp = row.querySelector("input");
        let pend = false;
        const redo = () => {
            if (pend) return;
            pend = true;
            requestAnimationFrame(() => {
                pend = false;
                populateArchiveCloud();
                bindMemoryRecords();
            });
        };
        inp.oninput = () => {
            wardrobePearl.state._memGather = +inp.value;
            row.querySelector("b").textContent = (+inp.value).toFixed(2);
            redo();
        };
        box.appendChild(row);
    }
    const replay = document.createElement("button");
    replay.textContent = "重播选中星星的涟漪";
    replay.onclick = () => {
        if (archiveConstellationIndices.length && document.getElementById("memCard").classList.contains("show")) {
            archivePulseBorn = performance.now();
        } else {
            replay.textContent = "先点开一颗记忆星";
            setTimeout(() => replay.textContent = "重播选中星星的涟漪", 1600);
        }
    };
    box.appendChild(replay);
    const sw = document.getElementById("pearlSwatches");
    sw.innerHTML = "";
    sw.style.display = "block";
    const palSave = () => {
        try {
            localStorage.setItem("memoryTreePearlPalette", JSON.stringify(wardrobePearl.palette.map(c => "#" + c.getHexString())));
        } catch (e) {}
    };
    const palH = document.createElement("div");
    palH.className = "pearl-pal-h";
    palH.textContent = "河的颜色";
    sw.appendChild(palH);
    const palGrid = document.createElement("div");
    palGrid.className = "pearl-pal";
    sw.appendChild(palGrid);
    const pickers = [];
    pearlPalNames().forEach((name, i) => {
        const l = document.createElement("label"), input = document.createElement("input");
        input.type = "color";
        input.value = "#" + p.palette[i].getHexString();
        input.oninput = () => {
            wardrobePearl.palette[i].set(input.value);
            palSave();
        };
        l.append(input, name);
        palGrid.appendChild(l);
        pickers.push(input);
    });
    const palRow = document.createElement("div");
    palRow.className = "pearl-pal-row";
    const tintL = document.createElement("label"), tint = document.createElement("input");
    tint.type = "color";
    tint.value = "#f2a6cf";
    tint.id = "pearlTint";
    tintL.append("整体换色 ", tint);
    tint.oninput = () => {
        const th = {};
        new THREE.Color(tint.value).getHSL(th);
        pearlPalDefault().forEach((hx, i) => {
            const o = {};
            new THREE.Color(hx).getHSL(o);
            wardrobePearl.palette[i].setHSL(th.h, o.s + (th.s - o.s) * .8, o.l);
            pickers[i].value = "#" + wardrobePearl.palette[i].getHexString();
        });
        palSave();
    };
    const palReset = document.createElement("button");
    palReset.type = "button";
    palReset.textContent = "恢复原色";
    palReset.onclick = () => {
        pearlPalDefault().forEach((hx, i) => {
            wardrobePearl.palette[i].set(hx);
            pickers[i].value = hx;
        });
        try {
            localStorage.removeItem("memoryTreePearlPalette");
        } catch (e) {}
    };
    palRow.append(tintL, palReset);
    sw.appendChild(palRow);
}
let pearlDragPending = false;
function pearlDragRebuild() {
    if (pearlDragPending) return;
    pearlDragPending = true;
    requestAnimationFrame(() => {
        pearlDragPending = false;
        rebuildPearl(false, true);
    });
}
function rebuildPearl(reset = false, preview = false) {
    clearTimeout(pearlPanelTimer);
    const old = ensureWardrobePearl(), state = reset ? {} : {
        ...old.state
    }, colors = reset ? null : old.palette.map(c => c.getHex());
    const next = createWardrobePearl(camera, controls, state, {
        preview: preview
    });
    if (colors) colors.forEach((c, i) => next.palette[i].setHex(c)); else applyPearlPal(next);
    wardrobePearl = next;
    riverPivot.add(next.root);
    old.dispose();
    syncWardrobePearl();
    populateArchiveCloud();
    if (preview) {
        archiveEnterBorn = performance.now() - 5e3;
        return;
    }
    bindMemoryRecords();
    buildPearlPanel();
}
document.getElementById("riverControlsQuick").onclick = () => {
    if (archiveLayoutMode !== "river") setArchiveLayoutMode("river");
    if (pearlEnabled) buildPearlPanel();
    riverPanelVisible();
    setTreeSide(true);
    document.getElementById(pearlEnabled ? "pearlPanel" : "riverPanel").scrollIntoView({
        block: "start"
    });
};
document.getElementById("pearlReset").onclick = () => rebuildPearl(true);
document.getElementById("pearlCopy").onclick = async () => {
    const p = ensureWardrobePearl(), out = {
        ...p.state,
        _palette: p.palette.map(c => "#" + c.getHexString())
    }, txt = JSON.stringify(out, null, 2);
    try {
        await navigator.clipboard.writeText(txt);
        document.getElementById("pearlCopy").textContent = "已复制✓";
        setTimeout(() => document.getElementById("pearlCopy").textContent = "复制参数", 1500);
    } catch (e) {
        prompt("复制参数", txt);
    }
};
const originalTreeToggle = treeSideToggle.onclick;
treeSideToggle.onclick = () => {
    if (pearlEnabled && archiveLayoutMode === "river") buildPearlPanel();
    originalTreeToggle();
};
const YAW_ROWS = [ [ "sky", "背景朝向" ], [ "river", "河流朝向" ], [ "branch", "枝条树朝向" ] ];
function saveYaw() {
    try {
        localStorage.setItem("memoryTreeYaw", JSON.stringify(yawTune));
    } catch (e) {}
}
function buildYawPanel() {
    const boxes = {
        sky: document.getElementById("yawRows"),
        river: document.getElementById("yawRiverRows"),
        branch: document.getElementById("yawBranchRows")
    };
    if (Object.values(boxes).some(x => !x)) return;
    Object.values(boxes).forEach(x => {
        x.innerHTML = "";
    });
    for (const [k, label] of YAW_ROWS) {
        const v = +yawTune[k] || 0, row = document.createElement("div");
        row.className = "rrow";
        row.innerHTML = `<label><span>${label}</span><b>${v}°</b></label><input aria-label="${label}" type="range" min="-180" max="180" step="1" value="${v}">`;
        const inp = row.querySelector("input");
        inp.oninput = () => {
            yawTune[k] = +inp.value;
            row.querySelector("b").textContent = inp.value + "°";
            applyYaw();
        };
        inp.onchange = saveYaw;
        boxes[k].appendChild(row);
    }
}
buildYawPanel();
window.__yaw = {
    tune: yawTune,
    apply: applyYaw
};
const MUSIC_SOURCES = [ [ "synth", "合成版 · 空灵", "" ], [ "synth-forest", "合成版 · 森林小精灵", "" ], [ "calm-ambient-1", "Calm Ambient 1", "The Cynic Project · CC0" ], [ "calm-ambient-2", "Calm Ambient 2", "The Cynic Project · CC0" ], [ "calm-piano-1", "Calm Piano 1", "The Cynic Project · CC0" ] ];
const musicSaved = (() => {
    try {
        return JSON.parse(localStorage.getItem("memoryTreeAmbient") || "{}") || {};
    } catch (e) {
        return {};
    }
})();
const treeAmbient = createTreeAmbient({
    ...AMBIENT_DEFAULTS,
    ...musicSaved.params || {}
});
let musicSource = MUSIC_SOURCES.some(x => x[0] === musicSaved.source) ? musicSaved.source : "synth";
const trackPlayer = (() => {
    let ctx = null, gain = null, el = null, analyser = null, playing = false;
    return {
        get playing() {
            return playing;
        },
        async start(name) {
            if (!el) {
                el = new Audio;
                el.loop = true;
                el.preload = "auto";
                const C = window.AudioContext || window.webkitAudioContext;
                ctx = new C;
                const node = ctx.createMediaElementSource(el);
                gain = ctx.createGain();
                gain.gain.value = 0;
                analyser = ctx.createAnalyser();
                analyser.fftSize = 1024;
                node.connect(gain);
                gain.connect(analyser);
                analyser.connect(ctx.destination);
            }
            const url = "/static/audio/tree-bgm/" + name + ".mp3";
            if (!el.src.endsWith(url)) el.src = url;
            if (ctx.state !== "running") await ctx.resume();
            await el.play();
            playing = true;
            const t = ctx.currentTime;
            gain.gain.cancelScheduledValues(t);
            gain.gain.setValueAtTime(gain.gain.value, t);
            gain.gain.linearRampToValueAtTime(treeAmbient.params.volume, t + 2);
        },
        stop() {
            if (!el || !playing) return;
            playing = false;
            const t = ctx.currentTime;
            gain.gain.cancelScheduledValues(t);
            gain.gain.setValueAtTime(gain.gain.value, t);
            gain.gain.linearRampToValueAtTime(0, t + 1.2);
            setTimeout(() => {
                if (!playing) el.pause();
            }, 1300);
        },
        setVolume(v) {
            if (gain && playing) gain.gain.setTargetAtTime(v, ctx.currentTime, .15);
        },
        level() {
            if (!analyser) return 0;
            const a = new Float32Array(analyser.fftSize);
            analyser.getFloatTimeDomainData(a);
            let s = 0;
            for (const x of a) s += x * x;
            return Math.sqrt(s / a.length);
        },
        get element() {
            return el;
        }
    };
})();
const musicPlaying = () => treeAmbient.playing || trackPlayer.playing;
function saveMusic() {
    try {
        localStorage.setItem("memoryTreeAmbient", JSON.stringify({
            on: musicPlaying(),
            params: treeAmbient.params,
            source: musicSource
        }));
    } catch (e) {}
}
function syncMusicUI() {
    const on = musicPlaying(), b = document.getElementById("treeMusicBtn"), t = document.getElementById("musicToggle");
    if (b) {
        b.textContent = on ? "♪ 音乐：开" : "♪ 音乐：关";
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", String(on));
    }
    if (t) t.textContent = on ? "■ 停止" : "▶ 播放";
    const src = MUSIC_SOURCES.find(x => x[0] === musicSource), credit = document.getElementById("musicCredit");
    if (credit) credit.textContent = musicSource === "synth" ? "合成版 · 空灵：慢、留白多，远处的笛声和很远的星星。浏览器现场生成，没有版权问题。" : musicSource === "synth-forest" ? "合成版 · 森林小精灵：有拍子的琶音和小旋律，轻快。浏览器现场生成，没有版权问题。" : `「${src[1]}」${src[2]} · 公有领域，来源见 static/audio/tree-bgm/CREDITS.md`;
    document.querySelectorAll("#musicRows .rrow").forEach(r => {
        const synthOnly = r.dataset.synthOnly === "1";
        r.style.opacity = synthOnly && !musicSource.startsWith("synth") ? ".35" : "1";
        const i = r.querySelector("input");
        if (i) i.disabled = synthOnly && !musicSource.startsWith("synth");
    });
}
function stopAllMusic() {
    treeAmbient.stop();
    trackPlayer.stop();
}
async function startMusic() {
    try {
        if (musicSource.startsWith("synth")) {
            treeAmbient.set("style", musicSource === "synth-forest" ? "forest" : "lonely");
            await treeAmbient.start();
        } else await trackPlayer.start(musicSource);
    } catch (e) {
        console.warn("ambient", e);
    }
}
async function toggleMusic() {
    if (musicPlaying()) stopAllMusic(); else await startMusic();
    syncMusicUI();
    saveMusic();
}
document.getElementById("treeMusicBtn").onclick = () => {
    const pop = document.getElementById("musicPop");
    if (pop) pop.classList.toggle("on"); else toggleMusic();
};
document.getElementById("musicToggle").onclick = toggleMusic;
{
    const sel = document.getElementById("musicSource");
    for (const [k, label, by] of MUSIC_SOURCES) {
        const o = document.createElement("option");
        o.value = k;
        o.textContent = by ? `${label}（${by.replace(" · CC0", "")}）` : label;
        sel.appendChild(o);
    }
    sel.value = musicSource;
    sel.onchange = async () => {
        const was = musicPlaying();
        stopAllMusic();
        musicSource = sel.value;
        if (was) await startMusic();
        syncMusicUI();
        saveMusic();
    };
}
{
    const box = document.getElementById("musicRows");
    for (const [k, label, mn, mx, st, synthOnly] of [ [ "volume", "音量", 0, 1, .01, 0 ], [ "arp", "琶音（合成版）", 0, 1, .02, 1 ], [ "melody", "旋律（合成版）", 0, 1, .02, 1 ], [ "sparkle", "星星音（合成版）", 0, 1, .02, 1 ], [ "echo", "回声（合成版）", 0, 1, .02, 1 ], [ "motion", "段落变化（合成版，低=一直有旋律）", 0, 1, .02, 1 ], [ "pad", "底音（合成版）", 0, 1, .02, 1 ], [ "tempo", "快慢（合成版）", .5, 1.6, .05, 1 ], [ "brightness", "明暗（合成版）", 0, 1, .02, 1 ] ]) {
        const v = treeAmbient.params[k], row = document.createElement("div");
        row.className = "rrow";
        row.dataset.synthOnly = synthOnly ? "1" : "0";
        row.innerHTML = `<label><span>${label}</span><b>${(+v).toFixed(2)}</b></label><input aria-label="${label}" type="range" min="${mn}" max="${mx}" step="${st}" value="${v}">`;
        const inp = row.querySelector("input");
        inp.oninput = () => {
            treeAmbient.set(k, +inp.value);
            if (k === "volume") trackPlayer.setVolume(+inp.value);
            row.querySelector("b").textContent = (+inp.value).toFixed(2);
        };
        inp.onchange = saveMusic;
        box.appendChild(row);
    }
}
syncMusicUI();
if (musicSaved.on) {
    const kick = () => {
        removeEventListener("pointerdown", kick, true);
        if (!musicPlaying()) toggleMusic();
    };
    addEventListener("pointerdown", kick, true);
}
window.__ambient = treeAmbient;
window.__music = {
    track: trackPlayer,
    get source() {
        return musicSource;
    },
    playing: musicPlaying
};
buildRiverPanel();
window.__river = {
    UI: RIVER_UI,
    PRESET: RIVER_PRESET,
    PAL: RIVER_PAL,
    live: riverApplyLive,
    rebuild: riverRebuild,
    sync: riverPanelSync
};
window.__pearl = () => wardrobePearl;
window.__pearlState = () => wardrobePearl ? {
    zFar: wardrobePearl.state.zFar,
    zNear: wardrobePearl.state.zNear,
    halfWidth: wardrobePearl.state.halfWidth
} : null;
window.__starSpan = () => {
    const c = archivePointCloud;
    if (!c) return null;
    const p = c.geometry.getAttribute("position");
    let mx = 0, n = p.count;
    for (let i = 0; i < n; i++) {
        const d = Math.hypot(p.getX(i), p.getZ(i));
        if (d > mx) mx = d;
    }
    return {
        n: n,
        maxDist: +mx.toFixed(2),
        gather: wardrobePearl ? +wardrobePearl.state._memGather : null
    };
};
document.getElementById("riverReset").onclick = () => {
    Object.assign(RIVER_UI, RIVER_UI_BASE);
    for (const k of Object.keys(RIVER_PRESET)) if (!(k in RIVER_PRESET_BASE)) delete RIVER_PRESET[k];
    Object.assign(RIVER_PRESET, RIVER_PRESET_BASE);
    RIVER_PAL_BASE.forEach((h, i) => RIVER_PAL[i] = h);
    riverPanelSync();
    riverApplyLive();
    riverRebuild("geo");
};
document.getElementById("riverCopy").onclick = async () => {
    const out = {};
    for (const k of Object.keys(RIVER_PRESET)) if (RIVER_PRESET[k] !== RIVER_PRESET_BASE[k]) out[k] = RIVER_PRESET[k];
    for (const k of Object.keys(RIVER_UI)) if (RIVER_UI[k] !== RIVER_UI_BASE[k]) out[k] = RIVER_UI[k];
    if (RIVER_PAL.some((h, i) => h !== RIVER_PAL_BASE[i])) out._palette = [ ...RIVER_PAL ];
    const txt = JSON.stringify(out, null, 2);
    const btn = document.getElementById("riverCopy");
    try {
        await navigator.clipboard.writeText(txt);
        btn.textContent = "已复制✓";
    } catch (e) {
        prompt("手动复制：", txt);
    }
    setTimeout(() => btn.textContent = "复制参数", 1500);
};
riverPanelVisible();
const LEAF_ROWS = [ [ "count", "叶子数量", 0, 72, 1 ], [ "size", "叶子大小", .3, 2, .05 ], [ "spin", "朝向随机度（0=齐齐朝外）", 0, 1, .02 ], [ "pair", "成双概率", 0, 1, .05 ] ];
const LEAF_BASE = {
    ...LEAF_UI
};
let leafTimer = null;
function leafRebuild() {
    clearTimeout(leafTimer);
    leafTimer = setTimeout(() => {
        if (lastTreeRoot && lastBranchSources) cleanCrownLeaves(lastTreeRoot, lastLeafSources, lastBranchSources);
    }, 200);
}
function buildLeafPanel() {
    const box = document.getElementById("leafRows");
    if (!box) return;
    box.innerHTML = "";
    for (const [k, label, mn, mx, st] of LEAF_ROWS) {
        const d = document.createElement("div");
        d.className = "rrow";
        d.innerHTML = `<label><span>${label}</span><b></b></label><input type="range" min="${mn}" max="${mx}" step="${st}">`;
        const inp = d.querySelector("input"), out = d.querySelector("b");
        d._sync = () => {
            inp.value = LEAF_UI[k];
            out.textContent = Number.isInteger(LEAF_UI[k]) ? LEAF_UI[k] : (+LEAF_UI[k]).toFixed(2);
        };
        inp.addEventListener("input", () => {
            LEAF_UI[k] = +inp.value;
            out.textContent = Number.isInteger(LEAF_UI[k]) ? LEAF_UI[k] : LEAF_UI[k].toFixed(2);
            leafRebuild();
        });
        d._sync();
        box.appendChild(d);
    }
}
buildLeafPanel();
document.getElementById("leafReset").onclick = () => {
    Object.assign(LEAF_UI, LEAF_BASE);
    document.querySelectorAll("#leafRows .rrow").forEach(d => d._sync && d._sync());
    leafRebuild();
};
let branchTimer = null;
function rebuildBranches(full) {
    if (!lastTreeRoot || !lastBranchSources) return;
    resetBranchStat();
    lastBranchSources.forEach((o, ix) => {
        const raw = o.userData.rawGeo;
        if (!raw) return;
        const pruned = pruneTreeGNGeometry(raw, String(ix)), next = beautifyTreeGNRoots(pruned), old = o.geometry;
        next.userData.faceMap = pruned.userData.faceMap;
        pruned.dispose();
        o.geometry = next;
        if (o.userData.halo) o.userData.halo.geometry = next;
        if (old && old !== raw) old.dispose();
    });
    lastTreeRoot.updateMatrixWorld(true);
    if (!full) return;
    cleanCrownLeaves(lastTreeRoot, lastLeafSources, lastBranchSources);
    buildMemoryForms(lastTreeRoot, lastVineSources || []);
    applySoloVisibility();
    branchSyncStat();
}
window.__treeDbg = {
    get branches() {
        return lastBranchSources;
    },
    get vines() {
        return lastVineSources;
    },
    vinePaths: v => extractVinePaths(v)
};
function branchSyncStat() {
    const el = document.getElementById("branchStat"), s = window.__branchStat;
    if (!el || !s) return;
    const hand = window.BRANCH_CUTS?.size || 0;
    el.textContent = `枝条 ${s.kept}/${s.alive} 根 · 滑块砍 ${s.auto} 根，手砍 ${hand} 根`;
    const undo = document.getElementById("branchUndo");
    if (undo) undo.disabled = !branchCutHistory.length;
}
const branchHiMat = new THREE.MeshBasicMaterial({
    color: "#ffd68a",
    transparent: true,
    opacity: .92,
    depthTest: false,
    toneMapped: false,
    side: THREE.DoubleSide
});
let branchHiMesh = null;
function clearBranchHover() {
    if (branchHiMesh) {
        branchHiMesh.removeFromParent();
        branchHiMesh.geometry.dispose();
        branchHiMesh = null;
    }
    branchHoverKey = null;
    branchHoverMesh = null;
}
function branchCompAt(clientX, clientY) {
    if (!lastBranchSources) return null;
    const rect = canvas.getBoundingClientRect();
    pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(lastBranchSources, false)[0];
    if (!hit || hit.faceIndex == null) return null;
    const table = hit.object.userData.rawGeo?.userData.__branchComps, fm = hit.object.geometry.userData.faceMap;
    if (!table || !fm) return null;
    const comp = table.byId.get(table.compOf[fm[hit.faceIndex]]);
    return comp ? {
        mesh: hit.object,
        comp: comp,
        table: table
    } : null;
}
function isTrunkComp(table, comp) {
    if (!table.__trunk) {
        const alive = table.comps.filter(c => !c.junk);
        table.__trunk = alive.reduce((a, b) => b.diag > a.diag ? b : a, alive[0]);
    }
    return table.__trunk === comp;
}
function highlightBranch(pick) {
    if (pick && isTrunkComp(pick.table, pick.comp)) pick = null;
    window.__branchHover = pick ? pick.comp.key : null;
    if (!pick) {
        clearBranchHover();
        return;
    }
    if (branchHoverKey === pick.comp.key) return;
    clearBranchHover();
    const raw = pick.mesh.userData.rawGeo, idx = raw.index, src = raw.attributes.position, pos = [];
    const v = new THREE.Vector3;
    for (const f of pick.comp.faces) for (let k = 0; k < 3; k++) {
        const vi = idx.getX(f * 3 + k);
        v.fromBufferAttribute(src, vi);
        if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) v.set(0, 0, 0);
        pos.push(v.x, v.y, v.z);
    }
    const g = new THREE.BufferGeometry;
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    branchHiMesh = new THREE.Mesh(g, branchHiMat);
    branchHiMesh.renderOrder = 998;
    branchHiMesh.frustumCulled = false;
    branchHiMesh.position.copy(pick.mesh.position);
    branchHiMesh.quaternion.copy(pick.mesh.quaternion);
    branchHiMesh.scale.copy(pick.mesh.scale);
    pick.mesh.parent.add(branchHiMesh);
    branchHoverKey = pick.comp.key;
    branchHoverMesh = pick.mesh;
}
function cutBranchAt(clientX, clientY) {
    const pick = branchCompAt(clientX, clientY);
    if (!pick) return false;
    if (isTrunkComp(pick.table, pick.comp)) {
        showLifeToast("这是树干，砍了树就没了");
        return true;
    }
    window.BRANCH_CUTS.add(pick.comp.key);
    branchCutHistory.push(pick.comp.key);
    saveBranchCuts();
    clearBranchHover();
    rebuildBranches(false);
    branchSyncStat();
    clearTimeout(branchTimer);
    branchTimer = setTimeout(() => rebuildBranches(true), 900);
    return true;
}
function setBranchPickMode(on) {
    branchPickMode = !!on;
    const b = document.getElementById("branchPickBtn");
    if (b) {
        b.textContent = `✂ 手动剪枝：${branchPickMode ? "开启" : "关闭"}`;
        b.classList.toggle("on", branchPickMode);
    }
    canvas.style.cursor = branchPickMode ? "crosshair" : "";
    if (!branchPickMode) clearBranchHover();
}
function buildBranchPanel() {
    const box = document.getElementById("branchRows");
    if (!box) return;
    box.innerHTML = "";
    const d = document.createElement("div");
    d.className = "rrow";
    d.innerHTML = `<label><span>疏枝（0＝原样，越大砍得越狠）</span><b></b></label><input type="range" min="0" max=".85" step=".01">`;
    const inp = d.querySelector("input"), out = d.querySelector("b");
    d._sync = () => {
        inp.value = window.BRANCH_UI.thin;
        out.textContent = (+window.BRANCH_UI.thin).toFixed(2);
    };
    const apply = full => {
        clearTimeout(branchTimer);
        branchTimer = setTimeout(() => rebuildBranches(full), full ? 60 : 140);
    };
    inp.addEventListener("input", () => {
        window.BRANCH_UI.thin = +inp.value;
        out.textContent = (+inp.value).toFixed(2);
        apply(false);
    });
    inp.addEventListener("change", () => {
        localStorage.setItem("memoryTreeBranchThin", String(window.BRANCH_UI.thin));
        localStorage.setItem("memoryTreeBranchDirty", "1");
        apply(true);
    });
    d._sync();
    box.appendChild(d);
}
buildBranchPanel();
document.getElementById("branchReset").onclick = () => {
    window.BRANCH_UI.thin = 0;
    localStorage.removeItem("memoryTreeBranchThin");
    localStorage.setItem("memoryTreeBranchDirty", "1");
    document.querySelectorAll("#branchRows .rrow").forEach(d => d._sync && d._sync());
    rebuildBranches(true);
};
document.getElementById("branchPickBtn").onclick = () => setBranchPickMode(!branchPickMode);
document.getElementById("branchUndo").onclick = () => {
    const k = branchCutHistory.pop();
    if (!k) return;
    window.BRANCH_CUTS.delete(k);
    saveBranchCuts();
    rebuildBranches(true);
};
document.getElementById("branchClearCuts").onclick = () => {
    stashBranchCuts();
    window.BRANCH_CUTS.clear();
    branchCutHistory = [];
    saveBranchCuts();
    rebuildBranches(true);
    branchSaveMsg("全长回来了。想反悔点「找回上一版」");
};
document.getElementById("branchRestorePrev").onclick = () => {
    let prev = [];
    try {
        prev = JSON.parse(localStorage.getItem("memoryTreeBranchCutsPrev") || "[]");
    } catch (e) {}
    if (!prev.length) {
        branchSaveMsg("回收站是空的，没有上一版");
        return;
    }
    stashBranchCuts();
    window.BRANCH_CUTS = new Set(prev);
    branchCutHistory = [];
    saveBranchCuts();
    rebuildBranches(true);
    branchSaveMsg(`找回来了：${prev.length} 根`);
};
function branchSaveMsg(text) {
    const el = document.getElementById("branchSaveMsg");
    if (el) el.textContent = text;
}
document.getElementById("branchSaveBtn").onclick = async () => {
    const btn = document.getElementById("branchSaveBtn");
    btn.disabled = true;
    branchSaveMsg("正在保存…");
    try {
        const r = await fetch("/api/starmap/branch-prune", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                cuts: [ ...window.BRANCH_CUTS ],
                thin: window.BRANCH_UI.thin
            })
        });
        const j = await r.json();
        if (!j.ok) throw new Error("save failed");
        localStorage.removeItem("memoryTreeBranchDirty");
        branchSaveMsg(`已定稿：手砍 ${j.cuts} 根，滑块 ${(+j.thin).toFixed(2)}。换设备打开也是这棵。`);
    } catch (e) {
        branchSaveMsg("没存上，再点一次试试");
    }
    btn.disabled = false;
};
document.getElementById("branchRevertBtn").onclick = async () => {
    branchSaveMsg("正在取回定稿…");
    try {
        const cfg = await (await fetch("/api/starmap/branch-prune")).json();
        const cuts = Array.isArray(cfg.cuts) ? cfg.cuts : [];
        if (!cuts.length && window.BRANCH_CUTS.size) {
            branchSaveMsg("服务器上还没有定稿，按下去会把你砍的清空——拦住了。先点「保存成定稿」");
            return;
        }
        stashBranchCuts();
        window.BRANCH_CUTS = new Set(cuts);
        branchCutHistory = [];
        window.BRANCH_UI.thin = typeof cfg.thin === "number" ? Math.max(0, Math.min(.85, cfg.thin)) : 0;
        localStorage.setItem("memoryTreeBranchCuts", JSON.stringify(cuts));
        localStorage.setItem("memoryTreeBranchThin", String(window.BRANCH_UI.thin));
        localStorage.removeItem("memoryTreeBranchDirty");
        document.querySelectorAll("#branchRows .rrow").forEach(d => d._sync && d._sync());
        rebuildBranches(true);
        branchSaveMsg("已回到上次定稿");
    } catch (e) {
        branchSaveMsg("取不回来，检查一下网络");
    }
};
function clearRiverDecor() {
    if (!riverDecor) return;
    riverDecor.removeFromParent();
    riverDecor.traverse(o => {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
    });
    riverDecor = null;
}
function buildRiverDecor(group) {
    clearRiverDecor();
    const {R: R, ox: ox, oz: oz} = riverGeom();
    riverDecor = new THREE.Group;
    riverDecor.name = "memory-river-decor";
    riverDecor.userData.noPick = true;
    group.add(riverDecor);
    const pos = [], col = [], alp = [], tmp = new THREE.Color, PAL = RIVER_PAL.map(h => new THREE.Color(h));
    for (const line of R.lines) {
        const c0 = PAL[line.colorKey], tn = .72 + .5 * line.strength;
        for (let i = 0; i < line.pts.length - 1; i++) {
            const a = line.pts[i], b = line.pts[i + 1], y = RIVER_GROUND + line.u * 7919 % 1 * .012;
            pos.push(a.x * RIVER_SCALE + ox, y, a.z * RIVER_SCALE + oz, b.x * RIVER_SCALE + ox, y, b.z * RIVER_SCALE + oz);
            const fl = .2 + .8 * Math.pow(.5 + .5 * Math.sin(a.t * 37.1 + line.u * 13.7), 1.6);
            const w = a.fade * (.4 + .6 * line.strength) * fl;
            tmp.copy(c0).multiplyScalar(tn);
            col.push(tmp.r, tmp.g, tmp.b, tmp.r, tmp.g, tmp.b);
            alp.push(w, w * .98);
        }
    }
    const fg = new THREE.BufferGeometry;
    fg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    fg.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    fg.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alp, 1));
    riverFilaMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        toneMapped: false,
        uniforms: {
            uA: {
                value: .075
            },
            uTime: {
                value: 0
            }
        },
        vertexShader: "attribute float aAlpha;varying vec3 vC;varying float vA;varying float vT;uniform float uA;void main(){vC=color;vA=aAlpha*uA;vT=position.z;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader: "varying vec3 vC;varying float vA;varying float vT;uniform float uTime;void main(){float flow=.72+.28*sin(vT*1.7-uTime*.6);gl_FragColor=vec4(vC,vA*flow);}"
    });
    riverDecor.add(new THREE.LineSegments(fg, riverFilaMat));
    {
        const bn = RIVER_LOOK_BED, bp = new Float32Array(bn * 3), bc = new Float32Array(bn * 3), bs = new Float32Array(bn);
        for (let i = 0; i < bn; i++) {
            const line = R.lines[rhash(i * 5 + 3) * R.lines.length | 0], fi = rhash(i * 7 + 19) * (line.pts.length - 1);
            const idx = Math.min(line.pts.length - 2, fi | 0), a = line.pts[idx], b = line.pts[idx + 1], m = fi - idx;
            let tx = b.x - a.x, tz = b.z - a.z;
            const tl = Math.hypot(tx, tz) || 1;
            tx /= tl;
            tz /= tl;
            const g = j => rhash(i * 23 + j) + rhash(i * 29 + j * 3) + rhash(i * 31 + j * 7) - 1.5;
            const al = g(1) * 2.6 * 32, ac = g(2) * 1.15 * 32;
            bp.set([ (a.x + (b.x - a.x) * m + tx * al - tz * ac) * RIVER_SCALE + ox, RIVER_GROUND + (rhash(i * 37 + 9) - .5) * .06, (a.z + (b.z - a.z) * m + tz * al + tx * ac) * RIVER_SCALE + oz ], i * 3);
            tmp.copy(PAL[line.colorKey]).lerp(PAL[2], .3).multiplyScalar((.34 + rhash(i * 41 + 13) * .26) * a.fade);
            bc.set([ tmp.r, tmp.g, tmp.b ], i * 3);
            bs[i] = .003 + rhash(i * 43 + 17) * .004;
        }
        const bg = new THREE.BufferGeometry;
        bg.setAttribute("position", new THREE.BufferAttribute(bp, 3));
        bg.setAttribute("color", new THREE.BufferAttribute(bc, 3));
        bg.setAttribute("pointSize", new THREE.BufferAttribute(bs, 1));
        riverBedMat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexColors: true,
            toneMapped: false,
            uniforms: {
                uScale: {
                    value: innerHeight * .64
                },
                uA: {
                    value: .55
                }
            },
            vertexShader: "attribute float pointSize;varying vec3 vC;uniform float uScale;void main(){vC=color;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=max(1.0,pointSize*uScale/max(.001,-mv.z));gl_Position=projectionMatrix*mv;}",
            fragmentShader: "varying vec3 vC;uniform float uA;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vC,pow(1.0-d*2.0,2.0)*uA);}"
        });
        riverDecor.add(new THREE.Points(bg, riverBedMat));
    }
    const dn = RIVER_LOOK_DUST, dp = new Float32Array(dn * 3), dc = new Float32Array(dn * 3), ds = new Float32Array(dn);
    for (let i = 0; i < dn; i++) {
        const line = R.lines[rhash(i * 2 + 7) * R.lines.length | 0], fi = rhash(i * 3 + 13) * (line.pts.length - 1);
        const idx = Math.min(line.pts.length - 2, fi | 0), a = line.pts[idx], b = line.pts[idx + 1], m = fi - idx;
        let tx = b.x - a.x, tz = b.z - a.z;
        const tl = Math.hypot(tx, tz) || 1;
        tx /= tl;
        tz /= tl;
        const g = j => rhash(i * 11 + j) + rhash(i * 13 + j * 3) + rhash(i * 17 + j * 7) - 1.5;
        const al = g(1) * .9 * 3.4, ac = g(2) * .9 * .3;
        dp.set([ (a.x + (b.x - a.x) * m + tx * al - tz * ac) * RIVER_SCALE + ox, RIVER_GROUND + (rhash(i * 19 + 3) - .5) * .05, (a.z + (b.z - a.z) * m + tz * al + tx * ac) * RIVER_SCALE + oz ], i * 3);
        tmp.copy(PAL[line.colorKey]).lerp(PAL[0], .42).multiplyScalar((.55 + rhash(i * 23 + 5) * .35) * a.fade);
        dc.set([ tmp.r, tmp.g, tmp.b ], i * 3);
        ds[i] = .0035 + rhash(i * 29 + 11) * .005;
    }
    const dg = new THREE.BufferGeometry;
    dg.setAttribute("position", new THREE.BufferAttribute(dp, 3));
    dg.setAttribute("color", new THREE.BufferAttribute(dc, 3));
    dg.setAttribute("pointSize", new THREE.BufferAttribute(ds, 1));
    riverDustMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        toneMapped: false,
        uniforms: {
            uScale: {
                value: innerHeight * .64
            },
            uA: {
                value: .88
            }
        },
        vertexShader: "attribute float pointSize;varying vec3 vC;uniform float uScale;void main(){vC=color;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=max(1.0,pointSize*uScale/max(.001,-mv.z));gl_Position=projectionMatrix*mv;}",
        fragmentShader: "varying vec3 vC;uniform float uA;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vC,pow(1.0-d*2.0,2.0)*uA);}"
    });
    riverDecor.add(new THREE.Points(dg, riverDustMat));
}
populateArchiveCloud = function() {
    const group = memoryFormGroups.archive;
    if (!group || !memoryRecords.archive.length) return;
    if (archivePointCloud) {
        const ix = memoryHitMeshes.indexOf(archivePointCloud);
        if (ix >= 0) memoryHitMeshes.splice(ix, 1);
        archivePointCloud.removeFromParent();
        archivePointCloud.geometry.dispose();
        archivePointCloud.material.dispose();
    }
    if (archiveConstellationLines) {
        archiveConstellationLines.removeFromParent();
        archiveConstellationLines.geometry.dispose();
        archiveConstellationLines.material.dispose();
        archiveConstellationLines = null;
    }
    archiveConstellationIndices = [];
    const requestedPreview = riverPreviewN || Math.min(5e4, Math.max(0, +new URLSearchParams(location.search).get("archivePreview") || 0));
    const logicalRecords = requestedPreview ? Array.from({
        length: requestedPreview
    }, (_, i) => memoryRecords.archive[i % memoryRecords.archive.length]) : archiveLayoutMode !== "river" && memoryRecords.archive.length > 1e4 ? spreadRecords(memoryRecords.archive, 1e4) : memoryRecords.archive.slice();
    const records = pearlEnabled && archiveLayoutMode === "river" ? allMemoryRecords.filter(r => r.id && r.stage !== "removed") : logicalRecords;
    const n = records.length, pos = new Float32Array(n * 3), colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n), glows = new Float32Array(n), phases = new Float32Array(n), linkOrders = new Float32Array(n), riverFades = new Float32Array(n);
    riverFades.fill(1);
    const angles = new Float32Array(n), ys = new Float32Array(n), radii = new Float32Array(n), rounds = new Float32Array(n);
    const baseX = new Float32Array(n), baseY = new Float32Array(n), baseZ = new Float32Array(n), groundFlags = new Uint8Array(n);
    const flowKinds = new Uint8Array(n), flowOffsets = new Float32Array(n), flowTargets = new Float32Array(n), riverLanes = new Float32Array(n);
    const palette = [ "#f4ddeb", "#ead8f2", "#f7e8ee", "#decfea", "#f1d5e4" ], riverPalette = [ "#f8edf4", "#eadcf2", "#d9d5ef", "#f1d1df", "#c9c8e1" ];
    const laneCount = Math.min(31, Math.max(7, Math.ceil(n / 420) | 1)), laneMid = (laneCount - 1) / 2;
    const hash = i => {
        const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
        return v - Math.floor(v);
    };
    for (let i = 0; i < n; i++) {
        const lane = i % laneCount - laneMid, a = i * 2.399963229728653 % (Math.PI * 2), r = 2.8 + lane * .036 + Math.sin(i * 1.73) * .012;
        const round = .48 + (i * 3 % 7 - 3) * .009, y = lane * .012 + Math.sin(i * 2.17) * .018, age = n > 1 ? i / (n - 1) : 0;
        const importance = +(records[i]?.importance || 5), large = records[i]?.pinned || importance >= 9 || i % 41 === 0;
        const medium = !large && (importance >= 7 || i % 9 === 0);
        angles[i] = a;
        radii[i] = r;
        rounds[i] = round;
        ys[i] = y;
        sizes[i] = large ? .145 : medium ? .092 : archiveLayoutMode === "waterfall" || archiveLayoutMode === "river" ? .034 + i % 4 * .003 : .05 + i % 4 * .004;
        glows[i] = large ? 1 : medium ? .72 : .38;
        phases[i] = i * 2.399963 % 6.28318;
        linkOrders[i] = -1;
        if (archiveLayoutMode === "waterfall") {
            const role = i % 20;
            if (role < 6) {
                const ringA = i * 2.399963229728653 % (Math.PI * 2), ringR = 2.8 + (hash(i + 13) - .5) * .16;
                flowKinds[i] = 0;
                baseX[i] = Math.cos(ringA) * ringR;
                baseY[i] = (hash(i + 29) - .5) * .055;
                baseZ[i] = Math.sin(ringA) * ringR * .48;
                sizes[i] *= .92;
            } else if (role < 16) {
                const showerArcs = [ {
                    a: .26,
                    w: 1.02
                }, {
                    a: 1.42,
                    w: 1.16
                }, {
                    a: 2.74,
                    w: .94
                }, {
                    a: 4.08,
                    w: 1.12
                }, {
                    a: 5.46,
                    w: 1.04
                } ], arc = showerArcs[Math.floor(i / 20) % showerArcs.length];
                const showerA = arc.a + (hash(i + 7) - .5) * arc.w, showerR = 2.8 + (hash(i + 13) - .5) * .24;
                flowKinds[i] = 1;
                baseX[i] = Math.cos(showerA) * showerR;
                baseY[i] = (hash(i + 23) - .5) * .035;
                baseZ[i] = Math.sin(showerA) * showerR * .48;
                flowOffsets[i] = hash(i + 47);
                flowTargets[i] = -2.42 + hash(i + 61) * .38;
            } else {
                const groundPatches = [ .22, 1.48, 2.82, 4.12, 5.38 ], ga = groundPatches[Math.floor(i / 20) % groundPatches.length] + (hash(i + 5) - .5) * .52, gr = .28 + hash(i + 19) * 1.42;
                flowKinds[i] = 2;
                baseX[i] = Math.cos(ga) * gr;
                baseY[i] = -2.42 + hash(i + 41) * .055;
                baseZ[i] = Math.sin(ga) * gr * .56;
                groundFlags[i] = 1;
                sizes[i] *= 1.18;
                glows[i] = Math.min(1, glows[i] + .1);
            }
            pos.set([ baseX[i], baseY[i], baseZ[i] ], i * 3);
        } else if (archiveLayoutMode === "river") {
            const q = pearlEnabled ? ensureWardrobePearl().pick(records[i].id) : riverPick(i);
            flowKinds[i] = 3;
            flowOffsets[i] = q.t;
            flowTargets[i] = 0;
            riverLanes[i] = q.key;
            riverFades[i] = q.fade;
            baseX[i] = q.x;
            baseY[i] = q.y;
            baseZ[i] = q.z;
            groundFlags[i] = 1;
            sizes[i] *= large ? .42 : medium ? .48 : .58;
            glows[i] = Math.min(1, glows[i] + (q.core ? .1 : 0));
            pos.set([ baseX[i], baseY[i], baseZ[i] ], i * 3);
        } else pos.set([ Math.cos(a) * r, y, Math.sin(a) * r * round ], i * 3);
        const c = new THREE.Color(large ? "#fff2ed" : archiveLayoutMode === "river" ? RIVER_PAL[riverLanes[i] | 0] : palette[i % palette.length]);
        const bright = large ? 1.18 : medium ? 1.04 : .86;
        colors.set([ c.r * bright, c.g * bright, c.b * bright ], i * 3);
    }
    const geo = new THREE.BufferGeometry;
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("pointSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("glow", new THREE.BufferAttribute(glows, 1));
    geo.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
    geo.setAttribute("linkOrder", new THREE.BufferAttribute(linkOrders, 1));
    geo.setAttribute("riverFade", new THREE.BufferAttribute(riverFades, 1));
    archiveBaseColors = Float32Array.from(colors);
    archivePointMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uPearl: {
                value: archiveLayoutMode === "river" && pearlEnabled ? 1 : 0
            },
            uPearlK: {
                value: 1
            },
            uScale: {
                value: innerHeight * .64 * (+ringTune.starSize || 1)
            },
            uReveal: {
                value: 0
            },
            uTime: {
                value: 0
            },
            uRippleDuration: {
                value: 1
            },
            uRippleAfter: {
                value: 1
            },
            uPulseAge: {
                value: 99
            },
            uBright: {
                value: (+ringTune.starBright || 1) * (archiveLayoutMode === "river" ? .64 : 1)
            }
        },
        vertexShader: `attribute float pointSize;attribute float glow;attribute float phase;attribute float linkOrder;attribute float riverFade;varying vec3 vColor;varying float vGlow;varying float vTw;varying float vStar;varying float vRiverFade;uniform float uPearl;uniform float uPearlK;uniform float uScale;uniform float uTime;uniform float uPulseAge;uniform float uRippleDuration;uniform float uRippleAfter;void main(){float br=.90+.10*sin(uTime*.28+phase);float wave=uPulseAge-linkOrder*.11;float life=clamp(wave/1.05,0.0,1.0);float pulse=linkOrder<0.0?0.0:sin(life*3.1415926)*step(0.0,wave)*step(wave,1.05);pulse=pow(pulse,1.35);float settleAt=uPearl>.5?(linkOrder<.5?3.28:3.05+linkOrder*.11)*uRippleDuration:1.05+linkOrder*.11;vStar=linkOrder<0.0?0.0:smoothstep(settleAt,settleAt+.55,uPulseAge)*(uPearl>.5?uRippleAfter:1.0);vColor=color+vec3(pulse*.54+vStar*.28);vGlow=glow+pulse*.48+vStar*.24;vTw=br+pulse*.88+vStar*.16;vRiverFade=riverFade;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=pointSize*uScale*(br+pulse*1.15+vStar*.22)/max(1.0,-mv.z);if(uPearl>.5)gl_PointSize=clamp(gl_PointSize,2.0*uPearlK,(linkOrder<0.0?4.0:10.0)*uPearlK);gl_Position=projectionMatrix*mv;}`,
        fragmentShader: `varying vec3 vColor;varying float vGlow;varying float vTw;varying float vStar;varying float vRiverFade;uniform float uPearl;uniform float uReveal;uniform float uBright;void main(){vec2 p=abs(gl_PointCoord-.5);float d=length(p);float soft=pow(smoothstep(.5,0.0,d),1.6);float core=pow(smoothstep(.22,0.0,d),1.25);float vertical=(1.0-smoothstep(.018,.075,p.x))*smoothstep(.50,.055,p.y);float horizontal=(1.0-smoothstep(.018,.075,p.y))*smoothstep(.50,.055,p.x);float star=max(core,max(vertical,horizontal));float roundA=soft*(.64+vGlow*.26)+core*.22;float starA=soft*.22+star*(.76+vGlow*.18);float a=mix(roundA,starA,max(clamp(vStar,0.0,1.0),uPearl))*vTw*uReveal*uBright*vRiverFade;if(a<.01)discard;gl_FragColor=vec4(vColor*(.94+mix(core,star,clamp(vStar,0.0,1.0))*(.30+vGlow*.18)),a);}`,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        depthTest: archiveLayoutMode !== "ring",
        blending: THREE.AdditiveBlending,
        toneMapped: false
    });
    archivePointCloud = new THREE.Points(geo, archivePointMaterial);
    archivePointCloud.name = "all-archived-memory-stars";
    archivePointCloud.frustumCulled = false;
    archivePointCloud.renderOrder = 2.3;
    archivePointCloud.userData = {
        memoryForm: "archiveCloud",
        records: records,
        angles: angles,
        ys: ys,
        radii: radii,
        rounds: rounds,
        baseX: baseX,
        baseY: baseY,
        baseZ: baseZ,
        groundFlags: groundFlags,
        flowKinds: flowKinds,
        flowOffsets: flowOffsets,
        flowTargets: flowTargets,
        riverLanes: riverLanes,
        layout: archiveLayoutMode,
        flowPrevP: new Float32Array(n)
    };
    group.add(archivePointCloud);
    memoryHitMeshes.push(archivePointCloud);
    if (archiveLayoutMode === "river" && !pearlEnabled) buildRiverDecor(group); else clearRiverDecor();
    if (archiveLayoutMode === "river" && pearlEnabled) ensureWardrobePearl();
    syncWardrobePearl();
    try {
        riverSyncStat();
    } catch (e) {}
    canvas.dataset.archiveRenderCount = String(n);
    canvas.dataset.archiveLogicalCount = String(records.length);
    canvas.dataset.archivePreview = requestedPreview ? "true" : "false";
    archiveEnterBorn = performance.now();
    if (!archiveWelcomeChecked) {
        archiveWelcomeChecked = true;
        scheduleArchiveWelcome(memoryRecords.archive.length);
    }
    raycaster.params.Points.threshold = .22;
};
function pickChainStars(list) {
    return list.filter(s => s.pinned || (+s.importance || 0) >= 9).sort((a, b) => +!!b.pinned - +!!a.pinned || (+b.importance || 0) - (+a.importance || 0) || String(b.created || "").localeCompare(String(a.created || ""))).slice(0, 24);
}
window.__chainDbg = () => ({
    ids: memoryRecords.star.map(r => String(r.id)),
    records: memoryRecords.star.map(r => +r.importance || 0),
    hits: memoryHitMeshes.filter(h => h.userData.memoryForm === "star").map(h => [ h.userData.memoryIndex, !!h.userData.memoryData, h.userData.visual ? h.userData.visual.visible : null ])
});
function classifyMemories(data) {
    const all = (data.galaxies || []).flatMap(g => (g.stars || []).map(s => ({
        ...s,
        domain: s.domain || g.label || "",
        galaxy: g.label,
        color: g.color
    }))).filter(s => s.name);
    all.sort((a, b) => String(b.created || "").localeCompare(String(a.created || "")));
    if (!all.length) return;
    allMemoryRecords = all;
    const key = s => String(s.id || `${s.name}|${s.created || ""}`);
    let seeds, fruits, dews, stars, archive;
    if (all.some(s => s.stage)) {
        const live = all.filter(s => s.stage !== "removed");
        seeds = live.filter(s => s.stage === "seed");
        fruits = live.filter(s => s.stage === "fruit");
        const sf = new Set([ ...seeds, ...fruits ].map(key));
        const settledLive = live.filter(s => !sf.has(key(s)));
        dews = settledLive.slice(0, 6);
        const dewIds = new Set(dews.map(key));
        const rest = settledLive.filter(s => !dewIds.has(key(s)));
        stars = pickChainStars(rest);
        const starIds = new Set(stars.map(key));
        archive = rest.filter(s => !starIds.has(key(s)));
    } else {
        const newest = Date.parse(all[0].created || "") || Date.now(), newCut = newest - 14 * 864e5;
        seeds = all.filter(s => (Date.parse(s.created || "") || 0) >= newCut).slice(0, 4);
        const seedIds = new Set(seeds.map(key));
        fruits = all.filter(s => !seedIds.has(key(s)) && (s.pinned || (+s.importance || 0) >= 8)).sort((a, b) => +b.pinned - +a.pinned || (+b.importance || 0) - (+a.importance || 0)).slice(0, 3);
        const fruitIds = new Set(fruits.map(key));
        const ordinary = all.filter(s => !seedIds.has(key(s)) && !fruitIds.has(key(s)));
        dews = ordinary.slice(0, 6);
        const dewIds = new Set(dews.map(key));
        const settled = ordinary.filter(s => !dewIds.has(key(s)));
        stars = pickChainStars(settled);
        const starIds = new Set(stars.map(key));
        archive = settled.filter(s => !starIds.has(key(s)));
    }
    memoryRecords.seed = seeds;
    memoryRecords.fruit = fruits;
    memoryRecords.dew = [];
    memoryRecords.star = stars;
    memoryRecords.archive = archive.length ? archive : all;
    scheduleCrownReconcile();
    bindMemoryRecords();
    populateArchiveCloud();
    document.getElementById("memoryCount").textContent = activeArchivePreview ? `${activeArchivePreview === 1e3 ? "千星" : "万星"}规模模拟 ${activeArchivePreview} · 每颗均可点击（循环映射真实记忆）` : `树冠 ${memoryRecords.seed.length + memoryRecords.dew.length + memoryRecords.fruit.length} · 星链 ${memoryRecords.star.length} · 星环 ${memoryRecords.archive.length} / 全部 ${all.length}`;
    initMemorySearch();
    applyCandidateFilter();
    if (memoryFilterState.star) requestAnimationFrame(() => {
        if (!openRecordById(memoryFilterState.star)) setTimeout(() => {
            if (!openRecordById(memoryFilterState.star)) showLifeToast("没有找到这段记忆，请检查链接或记忆库连接");
        }, 2600);
    });
}
const memorySamples = {
    star: [ [ "那天的晚风", "我们沿着同一条路，慢慢走了很久。" ], [ "被记住的一句话", "有些话很轻，却一直亮到现在。" ] ],
    seed: [ [ "刚刚种下", "一颗还没有讲完的新记忆，正在树梢发芽。" ], [ "明天再续", "先把这一点小小的期待埋进时间里。" ] ],
    dew: [ [ "寻常的一天", "没有大事发生，但回头看时仍然觉得温柔。" ], [ "清晨的消息", "醒来以后，第一眼看到的是熟悉的名字。" ] ],
    fruit: [ [ "很重要的那一天", "它在漫长时间里凝成了果实，不会轻易熄灭。" ], [ "共同完成的事", "我们一起让原本只存在于想象里的东西落了地。" ] ]
};
const memoryPopup = document.getElementById("memoryPopup"), raycaster = new THREE.Raycaster, pointer = new THREE.Vector2, blossomEffects = [];
let lifecycleVisuals = [], popupTimer = 0, popupSwitchTimer = 0, popupRecordId = null, popupSwitchToken = 0, pointerStart = null;
function crownScaleFor(type) {
    const t = ringTune || {};
    return type === "seed" ? +t.seedSize || 1 : type === "fruit" || type === "fruitCore" ? +t.fruitSize || 1 : type === "dew" ? +t.dewSize || 1 : 1;
}
function trackLifecycle(mesh, type, delay, baseScale, from) {
    mesh.userData.lifecycleType = type;
    lifecycleVisuals.push({
        mesh: mesh,
        type: type,
        delay: delay,
        born: performance.now(),
        origScale: baseScale.clone(),
        baseScale: baseScale.clone().multiplyScalar(crownScaleFor(type)),
        basePos: mesh.position.clone(),
        from: from?.clone() || mesh.position.clone()
    });
    mesh.scale.setScalar(.001);
}
function parentsVisible(o) {
    for (let n = o; n; n = n.parent) if (!n.visible) return false;
    return true;
}
function bloomAt(hit) {
    const wp = hit.getWorldPosition(new THREE.Vector3), group = new THREE.Group, petalShape = new THREE.Shape;
    petalShape.moveTo(0, 0);
    petalShape.bezierCurveTo(.055, .025, .065, .11, 0, .17);
    petalShape.bezierCurveTo(-.065, .11, -.055, .025, 0, 0);
    const geo = new THREE.ShapeGeometry(petalShape, 6), mat = new THREE.MeshBasicMaterial({
        color: "#ffd8ee",
        transparent: true,
        opacity: .92,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5, petal = new THREE.Mesh(geo, mat);
        petal.rotation.z = a;
        petal.userData.fall = {
            vx: Math.cos(a) * .13,
            vy: .1 + Math.sin(a) * .05,
            spin: (i % 2 ? 1 : -1) * (.9 + i * .11)
        };
        group.add(petal);
    }
    const heart = new THREE.Sprite(new THREE.SpriteMaterial({
        map: flowTex,
        color: "#fff3cf",
        transparent: true,
        opacity: .96,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    }));
    heart.scale.set(.16, .16, 1);
    group.add(heart);
    group.position.copy(wp);
    group.quaternion.copy(camera.quaternion);
    group.scale.setScalar(.08);
    scene.add(group);
    blossomEffects.push({
        group: group,
        geo: geo,
        mat: mat,
        heart: heart,
        born: performance.now()
    });
}
function activateLinkedFromRecord(rec) {
    if (!archivePointCloud || !rec) return;
    const selfId = String(rec.id || rec.bucket_id || ""), records = archivePointCloud.userData.records || [];
    const selfIdx = records.findIndex(r => String(r?.id || r?.bucket_id || "") === selfId);
    if (selfIdx >= 0) {
        activateArchiveConstellation(selfIdx);
        return;
    }
    const want = new Set(worldtreeEdges && selfId && worldtreeEdges[selfId] || []), hit = [];
    if (want.size) records.forEach((r, i) => {
        const rid = String(r?.id || r?.bucket_id || "");
        if (rid && want.has(rid)) hit.push(i);
    });
    archiveConstellationSelf = -1;
    archiveConstellationIndices = hit;
    archivePointCloud.userData.constellationReal = hit.length > 0;
    archivePointCloud.userData.constellationWhy = hit.length && worldtreeWhy && worldtreeWhy[selfId] || null;
    const crownLit = triggerLinkedCrown(selfId);
    canvas.dataset.constellation = JSON.stringify({
        star: selfId,
        real: hit.length > 0 || crownLit > 0,
        n: hit.length,
        crownLit: crownLit,
        external: true,
        edgesLoaded: !!worldtreeEdges,
        why: (archivePointCloud.userData.constellationWhy || []).map(w => w.title).slice(0, 3)
    });
    const colorA = archivePointCloud.geometry.attributes.color, linkA = archivePointCloud.geometry.attributes.linkOrder;
    for (let i = 0; i < colorA.count; i++) {
        colorA.setXYZ(i, archiveBaseColors[i * 3], archiveBaseColors[i * 3 + 1], archiveBaseColors[i * 3 + 2]);
        linkA.setX(i, -1);
    }
    hit.forEach((i, k) => {
        colorA.setXYZ(i, Math.min(2.2, archiveBaseColors[i * 3] * 1.72), Math.min(2.2, archiveBaseColors[i * 3 + 1] * 1.72), Math.min(2.2, archiveBaseColors[i * 3 + 2] * 1.72));
        linkA.setX(i, k);
    });
    colorA.needsUpdate = true;
    linkA.needsUpdate = true;
    archivePulseBorn = performance.now();
    if (archiveConstellationLines) {
        archiveConstellationLines.removeFromParent();
        archiveConstellationLines.geometry.dispose();
        archiveConstellationLines.material.dispose();
        archiveConstellationLines = null;
    }
    updateArchiveLOD(true);
}
window.__openCrown = (form, i) => {
    const h = memoryHitMeshes.find(x => x.userData.memoryForm === form && x.userData.memoryIndex === i);
    if (h) openMemory(h);
    return !!h;
};
function openMemory(hit) {
    const type = hit.userData.memoryForm, index = hit.userData.memoryIndex || 0, record = hit.userData.memoryData, samples = memorySamples[type] || memorySamples.star, sample = samples[index % samples.length], names = {
        archive: "ARCHIVED MEMORY · 星环",
        star: "SETTLED MEMORY · 星链",
        seed: "NEW MEMORY · 种子",
        dew: "ORDINARY DAY · 露珠",
        fruit: "IMPORTANT MEMORY · 果实"
    };
    const s = record || {
        id: "sample-" + type + "-" + index,
        name: sample[0],
        preview: sample[1]
    };
    openCard(s, type, names[type] || "");
    if (type === "archive") activateArchiveConstellation(index); else {
        bloomAt(hit);
        if (record) activateLinkedFromRecord(record);
    }
}
function escMem(t) {
    return (t || "").replace(/[&<>"]/g, m => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
    }[m]));
}
function parseMem(c) {
    if (typeof c !== "string") return {
        plain: ""
    };
    const s = c.trim();
    if (s.startsWith("{")) {
        try {
            const o = JSON.parse(s);
            return {
                facts: o.core_facts || o.facts || null,
                plain: !o.core_facts && !o.facts ? s : null
            };
        } catch (e) {
            return {
                plain: c
            };
        }
    }
    return {
        plain: c
    };
}
function renderMemBody(text, partial) {
    if (visitorModeOn) {
        document.getElementById("cBody").innerHTML = "<div>" + safeMemoryText("text") + "</div>";
        return;
    }
    const p = parseMem(text);
    let out = p.facts && p.facts.length ? p.facts.map(f => `<div class="c-fact">${escMem(f)}</div>`).join("") : `<div>${escMem(p.plain || "（这颗记忆还没有正文）")}</div>`;
    if (partial) out += '<div class="c-loading">取全文中…</div>';
    document.getElementById("cBody").innerHTML = out;
}
let currentCardId = null, currentCardRecord = null, currentCardType = "", currentCardEn = "", cardSwitchTimer = 0, cardSwitchToken = 0;
function isRealMemId(id) {
    return id && !String(id).startsWith("sample-") && id !== "birthtest";
}
function paintCard(s, type, en) {
    currentCardId = s.id;
    currentCardRecord = s;
    currentCardType = type;
    currentCardEn = en;
    document.getElementById("cTitle").textContent = visitorModeOn ? safeMemoryText("title") : s.name && String(s.name).trim() ? s.name : "一颗记忆";
    document.getElementById("cEn").textContent = visitorModeOn ? "PRIVATE MEMORY" : en || "";
    document.getElementById("cDate").textContent = visitorModeOn ? safeMemoryText("date") : ((s.created || "").slice(0, 10).replace(/-/g, ".") || "日期未记") + (s.importance ? ` · 重要度 ${s.importance}/10` : "");
    document.getElementById("cTag").textContent = visitorModeOn ? safeMemoryText("tag") : s.galaxy || s.domain || "记忆";
    const col = s.color || "#f2a2cc";
    document.getElementById("cBloom").innerHTML = `<circle cx="16" cy="16" r="5" fill="${col}"/>` + [ 0, 72, 144, 216, 288 ].map(a => `<ellipse cx="16" cy="8" rx="3.4" ry="6" fill="${col}" opacity=".45" transform="rotate(${a} 16 16)"/>`).join("");
    if (s.contentFull) {
        renderMemBody(s.contentFull, false);
    } else if (isRealMemId(s.id)) {
        renderMemBody(s.preview || s.content || "", true);
        const openedId = String(s.id);
        fetch("/api/starmap/star/" + encodeURIComponent(openedId)).then(r => r.json()).then(j => {
            if (j && j.content) {
                s.contentFull = j.content;
                if (currentCardId === openedId) renderMemBody(j.content, false);
            } else if (currentCardId === openedId) renderMemBody(s.preview || s.content || "", false);
        }).catch(() => {
            if (currentCardId === openedId) renderMemBody(s.preview || s.content || "", false);
        });
    } else {
        renderMemBody(s.preview || s.content || "", false);
    }
    document.getElementById("cBody").scrollTop = 0;
    renderConstellationList(s.id);
}
function renderConstellationList(selfId) {
    const box = document.getElementById("cLinked");
    if (!box) return;
    box.innerHTML = "";
    if (!worldtreeEdges || !selfId || !worldtreeEdges[selfId]) {
        box.style.display = "none";
        return;
    }
    const want = worldtreeEdges[selfId] || [];
    const named = [];
    Object.values(memoryRecords).forEach(list => list.forEach(r => {
        const rid = String(r && r.id || "");
        if (rid && want.includes(rid) && !named.some(x => x.id === rid)) named.push({
            id: rid,
            name: r.name || "一段记忆"
        });
    }));
    if (!named.length) {
        box.style.display = "none";
        return;
    }
    const why = (worldtreeWhy && worldtreeWhy[selfId] || []).slice(0, 2).map(w => w.title);
    box.style.display = "";
    box.innerHTML = '<div class="c-linked-h">和它一起亮起的 ' + named.length + " 颗</div>" + named.map((x, i) => '<button class="c-linked-b" data-goto="' + x.id + '">✦ ' + escMem(visitorModeOn ? "关联记忆 " + String(i + 1).padStart(2, "0") : x.name) + "</button>").join("") + (why.length ? '<div class="c-linked-w">' + (visitorModeOn ? "关联的理由已隐藏" : "因为一起构成了：" + why.map(t => escMem(t)).join("；")) + "</div>" : "");
    box.querySelectorAll("[data-goto]").forEach(b => b.onclick = () => openRecordById(b.dataset.goto));
}
function openCard(s, type, en) {
    const card = document.getElementById("memCard"), switching = card.classList.contains("show") && currentCardId && currentCardId !== s.id;
    clearTimeout(cardSwitchTimer);
    const token = ++cardSwitchToken;
    currentCardId = s.id;
    card.classList.remove("switching");
    paintCard(s, type, en);
    if (switching) {
        requestAnimationFrame(() => {
            if (token === cardSwitchToken) card.classList.add("switching");
        });
        cardSwitchTimer = setTimeout(() => {
            if (token === cardSwitchToken) card.classList.remove("switching");
        }, 240);
    }
    if (isRealMemId(s.id)) {
        memoryFilterState = updateMemoryUrl({
            star: String(s.id)
        });
        sessionStorage.setItem("memoryTreeLastOpenedStar", String(s.id));
    }
    document.getElementById("memScrim").classList.add("show");
    card.classList.add("show");
}
window.closeCard = () => {
    currentCardId = null;
    clearTimeout(cardSwitchTimer);
    cardSwitchToken++;
    document.getElementById("memScrim").classList.remove("show");
    document.getElementById("memCard").classList.remove("show", "switching");
    if (memoryFilterState.star) {
        const cleanUrl = new URL(location.href);
        cleanUrl.searchParams.delete("star");
        history.replaceState({}, "", cleanUrl);
        memoryFilterState = {
            ...memoryFilterState,
            star: ""
        };
    }
    sessionStorage.removeItem("memoryTreeLastOpenedStar");
};
function candidateRecordLocation(id) {
    const wanted = String(id || "");
    for (const [type, records] of Object.entries(memoryRecords)) {
        const index = records.findIndex(record => String(record?.id || "") === wanted);
        if (index >= 0) return {
            type: type,
            index: index,
            record: records[index]
        };
    }
    return null;
}
function focusWorldPoint(point) {
    if (point) {
        controls.target.lerp(point, .72);
        controls.update();
    }
}
function openRecordById(id) {
    if (archivePointCloud && parentsVisible(archivePointCloud)) {
        const recs = archivePointCloud.userData.records || [], idx = recs.findIndex(r => String(r?.id || r?.bucket_id || "") === String(id));
        if (idx >= 0) {
            const point = (new THREE.Vector3).fromBufferAttribute(archivePointCloud.geometry.attributes.position, idx);
            archivePointCloud.updateMatrixWorld(true);
            point.applyMatrix4(archivePointCloud.matrixWorld);
            focusWorldPoint(point);
            openMemory({
                userData: {
                    memoryForm: "archive",
                    memoryIndex: idx,
                    memoryData: recs[idx]
                },
                getWorldPosition: v => v.copy(point)
            });
            return true;
        }
    }
    const found = candidateRecordLocation(id);
    if (!found) return false;
    if (found.type === "archive" && archivePointCloud) {
        const positions = archivePointCloud.geometry.attributes.position, point = (new THREE.Vector3).fromBufferAttribute(positions, found.index);
        archivePointCloud.updateMatrixWorld(true);
        point.applyMatrix4(archivePointCloud.matrixWorld);
        focusWorldPoint(point);
        openMemory({
            userData: {
                memoryForm: "archive",
                memoryIndex: found.index,
                memoryData: found.record
            },
            getWorldPosition: v => v.copy(point)
        });
        return true;
    }
    const hit = memoryHitMeshes.find(object => String(object.userData?.memoryData?.id || "") === String(id));
    if (hit) {
        focusWorldPoint(hit.getWorldPosition(new THREE.Vector3));
        openMemory(hit);
        return true;
    }
    return false;
}
function applyCandidateFilter() {
    if (!archivePointCloud || !archiveBaseColors) return;
    const colors = archivePointCloud.geometry.attributes.color, records = archivePointCloud.userData.records || [];
    for (let i = 0; i < colors.count; i++) {
        const dim = memoryMatches(records[i], memoryFilterState) ? 1 : .065;
        colors.setXYZ(i, archiveBaseColors[i * 3] * dim, archiveBaseColors[i * 3 + 1] * dim, archiveBaseColors[i * 3 + 2] * dim);
    }
    colors.needsUpdate = true;
}
function escapeSearchText(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
function renderMemorySearch() {
    memorySearchResults = allMemoryRecords.filter(record => memoryMatches(record, memoryFilterState));
    if (memorySearchCursor >= memorySearchResults.length) memorySearchCursor = memorySearchResults.length - 1;
    document.getElementById("memorySearchSummary").textContent = `找到 ${memorySearchResults.length} / ${allMemoryRecords.length} 条`;
    document.getElementById("memoryResults").innerHTML = memorySearchResults.length ? memorySearchResults.slice(0, 80).map((record, index) => `<button class="memory-result${index === memorySearchCursor ? " active" : ""}" data-memory-id="${escapeSearchText(record.id)}"><b>${escapeSearchText(visitorModeOn ? safeMemoryText("title") : record.name || "一颗记忆")}</b><small>${escapeSearchText(visitorModeOn ? "日期与标签已隐藏" : String(record.created || "日期未记").slice(0, 10) + " · " + (record.galaxy || record.domain || "未分类") + " · " + (record.importance || 5) + "/10")}</small></button>`).join("") : `<div class="memory-empty">没有找到这段星光</div>`;
}
function runMemorySearch() {
    memorySearchCursor = -1;
    memoryFilterState = {
        ...memoryFilterState,
        q: document.getElementById("memoryQuery").value.trim(),
        domain: document.getElementById("memoryDomain").value,
        minImportance: +document.getElementById("memoryImportance").value || 0,
        from: document.getElementById("memoryFrom").value,
        to: document.getElementById("memoryTo").value
    };
    memoryFilterState = updateMemoryUrl(memoryFilterState);
    applyCandidateFilter();
    renderMemorySearch();
}
function stepMemoryResult(direction) {
    if (!memorySearchResults.length) return;
    memorySearchCursor = (memorySearchCursor + direction + memorySearchResults.length) % memorySearchResults.length;
    const record = memorySearchResults[memorySearchCursor];
    openRecordById(record.id);
    renderMemorySearch();
    document.querySelector(".memory-result.active")?.scrollIntoView({
        block: "nearest"
    });
}
function saveCandidateImage() {
    document.getElementById("memorySearch").classList.remove("on");
    composer.render();
    const data = canvas.toDataURL("image/png");
    canvas.dataset.lastExportBytes = String(data.length);
    const link = document.createElement("a");
    link.href = data;
    link.download = `memory-arboretum-${(new Date).toISOString().slice(0, 10)}.png`;
    link.click();
}
function initMemorySearch() {
    const panel = document.getElementById("memorySearch"), query = document.getElementById("memoryQuery"), domain = document.getElementById("memoryDomain"), importance = document.getElementById("memoryImportance"), month = document.getElementById("memoryMonth"), from = document.getElementById("memoryFrom"), to = document.getElementById("memoryTo"), timeline = document.getElementById("memoryTimeline"), timelineStart = document.getElementById("memoryTimelineStart"), timelineCurrent = document.getElementById("memoryTimelineCurrent"), timelineEnd = document.getElementById("memoryTimelineEnd");
    const timelineMonths = memoryMonths(allMemoryRecords).slice().reverse();
    const selectedTimelineMonth = () => timelineMonths.find(value => {
        const range = monthRange(value);
        return range.from === from.value && range.to === to.value;
    }) || "";
    const syncTimeline = () => {
        const selected = selectedTimelineMonth();
        month.value = selected;
        timeline.min = "0";
        timeline.max = String(Math.max(0, timelineMonths.length - 1));
        timelineStart.textContent = timelineMonths[0] || "";
        timelineEnd.textContent = timelineMonths.at(-1) || "";
        timeline.value = String(Math.max(0, selected ? timelineMonths.indexOf(selected) : timelineMonths.length - 1));
        timelineCurrent.textContent = selected || (from.value || to.value ? "自定义" : "全部时间");
    };
    domain.innerHTML = '<option value="">全部星系</option>' + memoryDomains(allMemoryRecords).map((value, index) => `<option value="${escapeSearchText(value)}">${escapeSearchText(visitorModeOn ? "星系 " + String(index + 1).padStart(2, "0") : value)}</option>`).join("");
    month.innerHTML = '<option value="">全部月份</option>' + memoryMonths(allMemoryRecords).map((value, index) => `<option value="${value}">${visitorModeOn ? "月份 " + String(index + 1).padStart(2, "0") : value}</option>`).join("");
    query.value = memoryFilterState.q;
    domain.value = memoryFilterState.domain;
    importance.value = String(memoryFilterState.minImportance);
    from.value = memoryFilterState.from;
    to.value = memoryFilterState.to;
    syncTimeline();
    if (panel.dataset.bound !== "1") {
        panel.dataset.bound = "1";
        document.getElementById("memorySearchBtn").onclick = () => {
            panel.classList.toggle("on");
            if (panel.classList.contains("on")) query.focus();
        };
        let timer = 0;
        query.oninput = () => {
            clearTimeout(timer);
            timer = setTimeout(runMemorySearch, 140);
        };
        domain.onchange = runMemorySearch;
        importance.onchange = runMemorySearch;
        month.onchange = () => {
            const range = monthRange(month.value);
            from.value = range.from;
            to.value = range.to;
            syncTimeline();
            runMemorySearch();
        };
        timeline.oninput = () => {
            const value = timelineMonths[+timeline.value];
            if (!value) return;
            const range = monthRange(value);
            from.value = range.from;
            to.value = range.to;
            syncTimeline();
            runMemorySearch();
        };
        from.onchange = () => {
            syncTimeline();
            runMemorySearch();
        };
        to.onchange = () => {
            syncTimeline();
            runMemorySearch();
        };
        document.getElementById("memorySearchClear").onclick = () => {
            query.value = "";
            domain.value = "";
            importance.value = "0";
            month.value = "";
            from.value = "";
            to.value = "";
            syncTimeline();
            runMemorySearch();
        };
        document.getElementById("memoryPrev").onclick = () => stepMemoryResult(-1);
        document.getElementById("memoryNext").onclick = () => stepMemoryResult(1);
        document.getElementById("memoryCopy").onclick = e => {
            const old = e.currentTarget.textContent;
            if (visitorModeOn) {
                e.currentTarget.textContent = "访客模式已禁用";
                setTimeout(() => e.currentTarget.textContent = old, 1100);
                return;
            }
            copyMemoryUrl().catch(() => {});
            e.currentTarget.textContent = "已复制";
            setTimeout(() => e.currentTarget.textContent = old, 1e3);
        };
        document.getElementById("memoryExport").onclick = saveCandidateImage;
        document.getElementById("memoryResults").onclick = e => {
            const button = e.target.closest("[data-memory-id]");
            if (button) {
                memorySearchCursor = memorySearchResults.findIndex(record => String(record.id) === button.dataset.memoryId);
                openRecordById(button.dataset.memoryId);
                panel.classList.remove("on");
            }
        };
        addEventListener("keydown", e => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                panel.classList.add("on");
                query.focus();
            } else if (e.key === "Escape") panel.classList.remove("on"); else if (panel.classList.contains("on") && e.key === "ArrowDown") {
                e.preventDefault();
                stepMemoryResult(1);
            } else if (panel.classList.contains("on") && e.key === "ArrowUp") {
                e.preventDefault();
                stepMemoryResult(-1);
            }
        });
    }
    renderMemorySearch();
}
function refreshPrivacySurfaces() {
    if (currentCardRecord) paintCard(currentCardRecord, currentCardType, currentCardEn);
    if (allMemoryRecords.length) initMemorySearch();
    if (lastClawdReplyText) renderClawdReply(lastClawdReplyText, lastClawdRecalls);
    document.querySelectorAll(".safe-dew").forEach(dew => {
        if (!dew.dataset.privateTitle) dew.dataset.privateTitle = dew.title;
        dew.title = visitorModeOn ? "一滴记忆露珠" : dew.dataset.privateTitle;
    });
}
function nearestArchiveStar(clientX, clientY, rect) {
    if (!archivePointCloud || !parentsVisible(archivePointCloud)) return null;
    archivePointCloud.updateMatrixWorld(true);
    const positions = archivePointCloud.geometry.attributes.position, world = new THREE.Vector3, screen = new THREE.Vector3;
    let best = -1, bestD = Infinity;
    for (let i = 0; i < positions.count; i++) {
        world.fromBufferAttribute(positions, i).applyMatrix4(archivePointCloud.matrixWorld);
        screen.copy(world).project(camera);
        if (screen.z < -1 || screen.z > 1) continue;
        const sx = rect.left + (screen.x + 1) * .5 * rect.width, sy = rect.top + (1 - screen.y) * .5 * rect.height;
        const d = Math.hypot(clientX - sx, clientY - sy);
        if (d < bestD) {
            bestD = d;
            best = i;
        }
    }
    if (best < 0 || bestD > 22) return null;
    world.fromBufferAttribute(positions, best).applyMatrix4(archivePointCloud.matrixWorld);
    return {
        index: best,
        point: world.clone()
    };
}
let archiveHoverAt = 0;
canvas.addEventListener("pointermove", e => {
    const now = performance.now();
    if (now - archiveHoverAt < 80) return;
    archiveHoverAt = now;
    const hit = nearestArchiveStar(e.clientX, e.clientY, canvas.getBoundingClientRect());
    canvas.style.cursor = hit ? "pointer" : "";
    canvas.dataset.archiveHover = hit ? String(hit.index) : "";
}, {
    passive: true
});
let worldtreeEdges = null, worldtreeWhy = null;
fetch("/api/worldtree/edges").then(r => r.json()).then(d => {
    if (d && d.edges) {
        worldtreeEdges = d.edges;
        worldtreeWhy = d.why || {};
    }
}).catch(() => {});
let archiveConstellationSelf = -1;
function triggerLinkedCrown(selfId) {
    const want = new Set(worldtreeEdges && selfId && worldtreeEdges[selfId] || []);
    let n = 0;
    if (!want.size) return 0;
    const inCloud = new Set((archivePointCloud?.userData?.records || []).map(r => String(r?.id || r?.bucket_id || "")));
    const done = new Set;
    memoryHitMeshes.forEach(h => {
        if (h === archivePointCloud || h.userData?.memoryForm === "archiveCloud") return;
        const rid = String(h.userData?.memoryData?.id || "");
        if (!rid || rid === selfId || !want.has(rid) || inCloud.has(rid) || done.has(rid) || !parentsVisible(h)) return;
        done.add(rid);
        try {
            bloomAt(h);
            n++;
        } catch (e) {}
    });
    return n;
}
function activateArchiveConstellation(index) {
    if (!archivePointCloud) return;
    archiveConstellationSelf = index;
    const records = archivePointCloud.userData.records || [], selected = records[index], positions = archivePointCloud.geometry.attributes.position;
    let linked = null;
    const selfId = selected?.id || selected?.bucket_id || "";
    if (worldtreeEdges && selfId && worldtreeEdges[selfId]) {
        const want = new Set(worldtreeEdges[selfId]), hit = [];
        records.forEach((r, i) => {
            if (i === index) return;
            const rid = r?.id || r?.bucket_id || "";
            if (rid && want.has(rid)) hit.push(i);
        });
        if (hit.length) linked = hit;
    }
    archiveConstellationIndices = linked ? [ index, ...linked ] : [ index ];
    archivePointCloud.userData.constellationReal = !!linked;
    archivePointCloud.userData.constellationWhy = linked && worldtreeWhy && worldtreeWhy[selfId] || null;
    const crownLit = triggerLinkedCrown(selfId);
    canvas.dataset.constellation = JSON.stringify({
        star: selfId,
        real: !!linked || crownLit > 0,
        n: archiveConstellationIndices.length - 1,
        crownLit: crownLit,
        edgesLoaded: !!worldtreeEdges,
        why: (archivePointCloud.userData.constellationWhy || []).map(w => w.title).slice(0, 3)
    });
    const colorA = archivePointCloud.geometry.attributes.color;
    const linkA = archivePointCloud.geometry.attributes.linkOrder;
    for (let i = 0; i < colorA.count; i++) {
        colorA.setXYZ(i, archiveBaseColors[i * 3], archiveBaseColors[i * 3 + 1], archiveBaseColors[i * 3 + 2]);
        linkA.setX(i, -1);
    }
    archiveConstellationIndices.forEach((i, k) => {
        const lift = i === archiveConstellationSelf ? 2.45 : 1.72;
        colorA.setXYZ(i, Math.min(2.2, archiveBaseColors[i * 3] * lift), Math.min(2.2, archiveBaseColors[i * 3 + 1] * lift), Math.min(2.2, archiveBaseColors[i * 3 + 2] * lift));
        linkA.setX(i, k);
    });
    colorA.needsUpdate = true;
    linkA.needsUpdate = true;
    archivePulseBorn = performance.now();
    if (archiveConstellationLines) {
        archiveConstellationLines.removeFromParent();
        archiveConstellationLines.geometry.dispose();
        archiveConstellationLines.material.dispose();
    }
    archiveConstellationLines = null;
    updateArchiveLOD(true);
}
function updateArchiveConstellationLines() {
    if (!archiveConstellationLines || !archivePointCloud || archiveConstellationIndices.length < 2) return;
    const source = archivePointCloud.geometry.attributes.position, target = archiveConstellationLines.geometry.attributes.position;
    for (let k = 1; k < archiveConstellationIndices.length; k++) {
        const a = archiveConstellationIndices[0], b = archiveConstellationIndices[k], o = (k - 1) * 6;
        target.array[o] = source.getX(a);
        target.array[o + 1] = source.getY(a);
        target.array[o + 2] = source.getZ(a);
        target.array[o + 3] = source.getX(b);
        target.array[o + 4] = source.getY(b);
        target.array[o + 5] = source.getZ(b);
    }
    target.needsUpdate = true;
}
const rippleGroup = new THREE.Group;
rippleGroup.name = "pearl-ripples";
scene.add(rippleGroup);
const rippleGeo = new THREE.PlaneGeometry(2, 2), rippleTmp = new THREE.Vector3;
const rippleVS = "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}";
const rippleFS = `varying vec2 vUv;uniform float uR;uniform float uA;uniform vec3 uColor;uniform float uSeed;\nvoid main(){\n vec2 p=vUv*2.0-1.0;float angle=atan(p.y,p.x);\n float r=length(p)*(1.0+.018*sin(angle*3.0+uSeed)+.01*sin(angle*5.0-uSeed));\n float d=r-uR;float aa=max(fwidth(r),.002);float w=.006+.004*uR+aa*.85;\n float crest=exp(-pow(d/w,2.0));\n float veil=exp(-pow((d+.022)/(.019+aa),2.0))*.11;\n float glint=.78+.22*sin(angle*2.0+uSeed+uR*2.0);\n float fade=1.0-smoothstep(.84,.99,r);\n float a=(crest*glint+veil)*uA*fade;\n gl_FragColor=vec4(uColor,a);\n}`;
let rippleKey = "", rippleBorn = 0, ripples = [];
function rippleClear() {
    ripples.forEach(r => {
        r.mesh.removeFromParent();
        r.mesh.material.dispose();
    });
    ripples = [];
}
function updateRipples(now) {
    const onRiver = archiveLayoutMode === "river" && pearlEnabled;
    const waterOn = dayOn && +dayState.reflReal > .001;
    const cardOpen = document.getElementById("memCard")?.classList.contains("show");
    const on = !!(archivePointCloud && (onRiver || waterOn) && archiveConstellationIndices.length && cardOpen);
    const key = on ? archiveConstellationIndices.join(",") + "|" + archivePulseBorn + "|" + (onRiver ? "r" : "w") : "";
    if (key !== rippleKey) {
        rippleClear();
        rippleKey = key;
        rippleBorn = archivePulseBorn || now;
        const _pa0 = archivePointCloud?.geometry.attributes.position;
        const nearWater = idx => {
            if (onRiver) return true;
            if (!_pa0 || idx >= _pa0.count) return false;
            rippleTmp.fromBufferAttribute(_pa0, idx);
            archivePointCloud.localToWorld(rippleTmp);
            return Math.abs(rippleTmp.y - (+dayState.waterY || -2.5)) < .45;
        };
        if (on) archiveConstellationIndices.filter(nearWater).forEach((idx, k) => {
            const selected = idx === archiveConstellationSelf;
            for (let j = 0; j < (selected ? 2 : 1); j++) {
                const material = new THREE.ShaderMaterial({
                    vertexShader: rippleVS,
                    fragmentShader: rippleFS,
                    transparent: true,
                    depthWrite: false,
                    side: THREE.DoubleSide,
                    blending: THREE.AdditiveBlending,
                    toneMapped: false,
                    extensions: {
                        derivatives: true
                    },
                    uniforms: {
                        uR: {
                            value: 0
                        },
                        uA: {
                            value: 0
                        },
                        uSeed: {
                            value: idx * 2.39996
                        },
                        uColor: {
                            value: new THREE.Color(selected ? 16773083 : 14605311)
                        }
                    }
                });
                const mesh = new THREE.Mesh(rippleGeo, material);
                mesh.rotation.x = -Math.PI / 2;
                mesh.renderOrder = 2.4;
                mesh.visible = false;
                rippleGroup.add(mesh);
                ripples.push({
                    mesh: mesh,
                    idx: idx,
                    delay: selected ? j * .38 : .7 + k * .11,
                    dur: selected ? 2.9 : 2.35,
                    max: selected ? 1.02 : .64,
                    peak: selected ? j ? .3 : .64 : .3
                });
            }
        });
    }
    const age = (now - rippleBorn) / 1e3, st = wardrobePearl?.state || {}, pa = archivePointCloud?.geometry.attributes.position;
    for (const r of ripples) {
        const speed = st._rippleDuration ?? 1;
        const p = (age - r.delay * speed) / (r.dur * speed);
        if (p < 0 || p >= 1 || !pa || r.idx >= pa.count) {
            r.mesh.visible = false;
            continue;
        }
        rippleTmp.fromBufferAttribute(pa, r.idx);
        archivePointCloud.localToWorld(rippleTmp);
        r.mesh.position.copy(rippleTmp);
        r.mesh.position.y += .008;
        r.mesh.visible = true;
        r.mesh.scale.setScalar(r.max * (st._rippleSize ?? 1));
        const u = r.mesh.material.uniforms;
        u.uR.value = .085 + .86 * (1 - Math.pow(1 - p, 1.7));
        u.uA.value = r.peak * (st._rippleA ?? 1) * Math.sin(Math.min(1, p / .12) * Math.PI / 2) * Math.pow(1 - p, 1.4);
    }
    if (archivePointMaterial?.uniforms.uRippleDuration) {
        archivePointMaterial.uniforms.uRippleDuration.value = st._rippleDuration ?? 1;
        archivePointMaterial.uniforms.uRippleAfter.value = st._rippleAfter ?? 1;
    }
    canvas.dataset.rippleState = JSON.stringify({
        active: on,
        visible: ripples.filter(r => r.mesh.visible).length,
        settled: on && age >= 3.28 * (st._rippleDuration ?? 1),
        duration: st._rippleDuration ?? 1,
        after: st._rippleAfter ?? 1
    });
}
(function rippleLoop() {
    requestAnimationFrame(rippleLoop);
    try {
        updateRipples(performance.now());
    } catch (e) {}
})();
function landRipple(pos) {
    const born = performance.now(), rs = [];
    window.__landDbg = {
        n: (window.__landDbg?.n || 0) + 1,
        pos: [ +pos.x.toFixed(2), +pos.y.toFixed(2), +pos.z.toFixed(2) ],
        screen: (() => {
            const s = pos.clone().project(camera);
            return [ +s.x.toFixed(2), +s.y.toFixed(2) ];
        })()
    };
    for (let j = 0; j < 3; j++) {
        const material = new THREE.ShaderMaterial({
            vertexShader: rippleVS,
            fragmentShader: rippleFS,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            extensions: {
                derivatives: true
            },
            uniforms: {
                uR: {
                    value: 0
                },
                uA: {
                    value: 0
                },
                uSeed: {
                    value: j * 2.39996 + 1
                },
                uColor: {
                    value: new THREE.Color(16773083)
                }
            }
        });
        const m = new THREE.Mesh(rippleGeo, material);
        m.rotation.x = -Math.PI / 2;
        m.renderOrder = 2.4;
        m.position.copy(pos);
        m.position.y += .008;
        m.visible = false;
        rippleGroup.add(m);
        rs.push({
            m: m,
            delay: j * .38,
            dur: 2.9,
            peak: j ? .3 : .64
        });
    }
    (function step() {
        const st = wardrobePearl?.state || {}, age = (performance.now() - born) / 1e3;
        let alive = false;
        for (const r of rs) {
            const p = (age - r.delay) / r.dur;
            if (p < 0) {
                alive = true;
                continue;
            }
            if (p >= 1) {
                r.m.visible = false;
                continue;
            }
            alive = true;
            r.m.visible = true;
            r.m.scale.setScalar(1.02 * (st._rippleSize ?? 1));
            const u = r.m.material.uniforms;
            u.uR.value = .085 + .86 * (1 - Math.pow(1 - p, 1.7));
            u.uA.value = r.peak * (st._rippleA ?? 1) * Math.sin(Math.min(1, p / .12) * Math.PI / 2) * Math.pow(1 - p, 1.4);
        }
        if (alive) requestAnimationFrame(step); else rs.forEach(r => {
            r.m.removeFromParent();
            r.m.material.dispose();
        });
    })();
}
function riverLandingPoint(record) {
    if (!(archiveLayoutMode === "river" && pearlEnabled && archivePointCloud)) return null;
    const p = ensureWardrobePearl(), v = new THREE.Vector3, toW = q => archivePointCloud.localToWorld(v.set(q.x, q.y, q.z)).clone();
    const id = String(record && record.id || "");
    if (id && id !== "birthtest") return toW(p.pick(id));
    let best = null, bd = 1e9, any = null, ad = 1e9;
    for (let k = 0; k < 80; k++) {
        const w = toW(p.pick("birth-land-" + k)), d = Math.hypot(w.x, w.z);
        if (d < .6) continue;
        if (d < ad) {
            ad = d;
            any = w;
        }
        const s = w.clone().project(camera);
        if (s.z > 1 || Math.abs(s.x) > .85 || s.y < -.9 || s.y > .85) continue;
        if (d < bd) {
            bd = d;
            best = w;
        }
    }
    return best || any;
}
window.__ripples = () => ({
    key: rippleKey,
    n: ripples.length,
    visible: ripples.filter(r => r.mesh.visible).length
});
window.__archiveUD = () => archivePointCloud ? archivePointCloud.userData : null;
window.__openArchive = i => {
    if (!archivePointCloud) return false;
    const ud = archivePointCloud.userData;
    openMemory({
        userData: {
            memoryForm: "archive",
            memoryIndex: i,
            memoryData: ud.records[i]
        }
    });
    return true;
};
canvas.addEventListener("pointerdown", e => {
    pointerStart = {
        x: e.clientX,
        y: e.clientY
    };
    archiveOrbitPaused = true;
});
let branchHoverTick = 0;
canvas.addEventListener("pointermove", e => {
    if (!branchPickMode || e.pointerType === "touch") return;
    const now = performance.now();
    if (now - branchHoverTick < 70) return;
    branchHoverTick = now;
    highlightBranch(branchCompAt(e.clientX, e.clientY));
});
canvas.addEventListener("pointerleave", () => {
    if (branchPickMode) clearBranchHover();
});
function crownMemoryAt(x, y) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(memoryHitMeshes.filter(o => o !== archivePointCloud && parentsVisible(o)), false)[0] || null;
}
canvas.addEventListener("pointerup", e => {
    archiveOrbitPaused = false;
    if (performance.now() - (window.__treeTapConsumedAt || 0) < 120) {
        pointerStart = null;
        return;
    }
    if (!pointerStart || Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 8) {
        pointerStart = null;
        return;
    }
    pointerStart = null;
    if (branchPickMode && cutBranchAt(e.clientX, e.clientY)) return;
    const rect = canvas.getBoundingClientRect();
    const crownHit = crownMemoryAt(e.clientX, e.clientY);
    if (crownHit) {
        openMemory(crownHit.object);
        return;
    }
    const archiveHit = nearestArchiveStar(e.clientX, e.clientY, rect);
    if (archiveHit) {
        const records = archivePointCloud.userData.records || [], i = archiveHit.index;
        openMemory({
            userData: {
                memoryForm: "archive",
                memoryIndex: i,
                memoryData: records[i] || null
            },
            getWorldPosition: v => v.copy(archiveHit.point)
        });
        return;
    }
});
canvas.addEventListener("pointercancel", () => {
    pointerStart = null;
    archiveOrbitPaused = false;
});
function extractVinePaths(vines) {
    const paths = [], centers = [];
    for (const mesh of vines) {
        const geo = mesh.geometry, idx = geo.index, pa = geo.attributes.position;
        if (!idx) continue;
        const faces = idx.count / 3, parent = new Int32Array(faces);
        for (let i = 0; i < faces; i++) parent[i] = i;
        const find = x => {
            while (parent[x] !== x) {
                parent[x] = parent[parent[x]];
                x = parent[x];
            }
            return x;
        }, join = (a, b) => {
            a = find(a);
            b = find(b);
            if (a !== b) parent[b] = a;
        }, owner = new Map;
        for (let f = 0; f < faces; f++) for (let k = 0; k < 3; k++) {
            const vi = idx.getX(f * 3 + k);
            if (owner.has(vi)) join(f, owner.get(vi)); else owner.set(vi, f);
        }
        const comps = new Map;
        for (let f = 0; f < faces; f++) {
            const r = find(f);
            if (!comps.has(r)) comps.set(r, new Set);
            for (let k = 0; k < 3; k++) comps.get(r).add(idx.getX(f * 3 + k));
        }
        for (const ids of comps.values()) {
            if (ids.size < 30) continue;
            const verts = [ ...ids ].map(i => (new THREE.Vector3).fromBufferAttribute(pa, i)), box = (new THREE.Box3).setFromPoints(verts), ext = box.getSize(new THREE.Vector3), axes = [ ext.x, ext.y, ext.z ], axis = axes.indexOf(Math.max(...axes)), ordered = [ ...axes ].sort((a, b) => b - a);
            if (ordered[0] < 5 || ordered[1] > .75) continue;
            const center = box.getCenter(new THREE.Vector3).applyMatrix4(mesh.matrixWorld);
            if (centers.some(c => c.distanceTo(center) < .22)) continue;
            centers.push(center);
            const min = axis === 0 ? box.min.x : axis === 1 ? box.min.y : box.min.z, max = axis === 0 ? box.max.x : axis === 1 ? box.max.y : box.max.z, pts = [];
            for (let bin = 0; bin < 7; bin++) {
                const lo = min + (max - min) * bin / 7, hi = min + (max - min) * (bin + 1) / 7, bucket = verts.filter(p => {
                    const q = axis === 0 ? p.x : axis === 1 ? p.y : p.z;
                    return q >= lo && q <= hi;
                });
                if (bucket.length) {
                    const p = bucket.reduce((a, v) => a.add(v), new THREE.Vector3).multiplyScalar(1 / bucket.length).applyMatrix4(mesh.matrixWorld);
                    pts.push(p);
                }
            }
            if (pts.length >= 4) {
                pts.sort((a, b) => b.y - a.y);
                paths.push(pts);
            }
        }
    }
    return paths.slice(0, 8);
}
function buildMemoryForms(root, vines) {
    scene.getObjectByName("memory-forms-prototype")?.traverse(o => {
        if (o.isMesh || o.isPoints) {
            o.geometry?.dispose?.();
            const m = o.material;
            (Array.isArray(m) ? m : [ m ]).forEach(x => x?.dispose?.());
        } else if (o.isSprite) o.material?.dispose?.();
    });
    scene.getObjectByName("memory-forms-prototype")?.removeFromParent();
    scene.getObjectByName("archived-memory-ring")?.removeFromParent();
    archivePointCloud = null;
    memoryHitMeshes = [];
    lifecycleVisuals = [];
    const forms = new THREE.Group, archiveGroup = new THREE.Group, starGroup = new THREE.Group, seedGroup = new THREE.Group, dewGroup = new THREE.Group, fruitGroup = new THREE.Group;
    forms.name = "memory-forms-prototype";
    forms.add(starGroup, seedGroup, dewGroup, fruitGroup);
    scene.add(forms);
    archiveGroup.name = "archived-memory-ring";
    scene.add(archiveGroup);
    memoryFormGroups = {
        archive: archiveGroup,
        star: starGroup,
        seed: seedGroup,
        dew: dewGroup,
        fruit: fruitGroup
    };
    Object.entries(memoryFormGroups).forEach(([k, g]) => g.visible = formVisibility[k]);
    const starCanvas = document.createElement("canvas");
    starCanvas.width = 96;
    starCanvas.height = 96;
    const sx = starCanvas.getContext("2d"), sg = sx.createRadialGradient(48, 48, 2, 48, 48, 45);
    sg.addColorStop(0, "rgba(255,255,255,1)");
    sg.addColorStop(.2, "rgba(255,235,250,.98)");
    sg.addColorStop(.52, "rgba(255,166,221,.58)");
    sg.addColorStop(1, "rgba(205,113,208,0)");
    sx.fillStyle = sg;
    sx.beginPath();
    sx.moveTo(48, 1);
    sx.lineTo(56, 39);
    sx.lineTo(95, 48);
    sx.lineTo(56, 56);
    sx.lineTo(48, 95);
    sx.lineTo(40, 56);
    sx.lineTo(1, 48);
    sx.lineTo(40, 39);
    sx.closePath();
    sx.fill();
    const starTex = new THREE.CanvasTexture(starCanvas);
    populateArchiveCloud();
    const chains = extractVinePaths(vines);
    {
        const bp = [], tv = new THREE.Vector3;
        (lastBranchSources || []).forEach(o => {
            if (!o.visible) return;
            o.updateMatrixWorld(true);
            const g = o.geometry, pa = g.attributes.position, idx = g.index, used = new Set;
            if (idx) for (let i = 0; i < idx.count; i++) used.add(idx.getX(i)); else for (let i = 0; i < pa.count; i++) used.add(i);
            for (const i of used) {
                tv.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld);
                bp.push(tv.x, tv.y, tv.z);
            }
        });
        if (bp.length) chains.forEach(pts => {
            const top = pts[0];
            let best = 1e9, bi = -1;
            for (let i = 0; i < bp.length; i += 3) {
                const d = (bp[i] - top.x) ** 2 + (bp[i + 1] - top.y) ** 2 + (bp[i + 2] - top.z) ** 2;
                if (d < best) {
                    best = d;
                    bi = i;
                }
            }
            if (bi >= 0 && Math.sqrt(best) > .12) {
                const dx = bp[bi] - top.x, dy = bp[bi + 1] - top.y, dz = bp[bi + 2] - top.z;
                pts.forEach(p => {
                    p.x += dx;
                    p.y += dy;
                    p.z += dz;
                });
            }
        });
    }
    chains.forEach((pts, ci) => {
        const curve = new THREE.CatmullRomCurve3(pts), line = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, .008, 5, false), new THREE.MeshBasicMaterial({
            color: "#c88bc8",
            transparent: true,
            opacity: .22,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }));
        starGroup.add(line);
        [ .18, .52, .84 ].forEach((t, j) => {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({
                map: starTex,
                color: j === 1 ? "#fff0cc" : "#ffd8f0",
                transparent: true,
                opacity: .94,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                toneMapped: false
            })), p = curve.getPoint(t), z = j === 1 ? .2 : .15, baseScale = new THREE.Vector3(z, z, 1);
            sp.position.copy(p);
            sp.scale.copy(baseScale);
            sp.userData.pulse = ci * .7 + j * .5;
            starGroup.add(sp);
            trackLifecycle(sp, "star", .68 + ci * .055 + j * .13, baseScale, curve.getPoint(.025));
            addMemoryHit(starGroup, [ p.x, p.y, p.z ], .23, "star", ci * 3 + j).userData.visual = sp;
        });
    });
    const treeBox = (new THREE.Box3).setFromObject(root), treeSize = treeBox.getSize(new THREE.Vector3), treeCenter = treeBox.getCenter(new THREE.Vector3);
    const pool = memoryBranchTipsWorld.filter(p => p.y > treeBox.min.y + treeSize.y * .34), used = [];
    function branchAnchor(nx, ny) {
        const target = new THREE.Vector3(treeCenter.x + nx * treeSize.x * .47, treeBox.min.y + ny * treeSize.y, treeCenter.z);
        let best = null, bestScore = Infinity;
        for (const p of pool) {
            if (used.some(q => q.distanceTo(p) < .34)) continue;
            const score = Math.abs(p.x - target.x) * 1.15 + Math.abs(p.y - target.y) * .9 + Math.abs(p.z - target.z) * .18;
            if (score < bestScore) {
                bestScore = score;
                best = p;
            }
        }
        if (!best) best = target;
        used.push(best);
        return best.clone();
    }
    function hangStem(group, a, p, color = "#e6b7dc") {
        const curve = new THREE.LineCurve3(a, p), stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 4, .008, 5, false), new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: .62,
            depthWrite: false
        }));
        group.add(stem);
        return stem;
    }
    const seedGeo = new THREE.OctahedronGeometry(.092, 0), seedMat = new THREE.MeshStandardMaterial({
        color: "#ffd7a8",
        emissive: "#ffb67b",
        emissiveIntensity: 1.15,
        roughness: .3,
        metalness: .02,
        transparent: true,
        opacity: .92
    });
    const dewProfile = [ new THREE.Vector2(0, -.15), new THREE.Vector2(.07, -.095), new THREE.Vector2(.092, -.015), new THREE.Vector2(.073, .075), new THREE.Vector2(.03, .155), new THREE.Vector2(0, .205) ], dewGeo = new THREE.LatheGeometry(dewProfile, 18), dewMat = new THREE.MeshStandardMaterial({
        color: "#dedaff",
        emissive: "#7667bd",
        emissiveIntensity: .28,
        transparent: true,
        opacity: .68,
        roughness: .18,
        metalness: .08,
        depthWrite: false
    });
    const dewAnchors = [ [ -.88, .58 ], [ -.55, .72 ], [ -.18, .62 ], [ .2, .76 ], [ .55, .6 ], [ .87, .7 ] ].map(t => branchAnchor(...t));
    const fruitShellGeo = new THREE.DodecahedronGeometry(.098, 0), fruitShellMat = new THREE.MeshPhysicalMaterial({
        color: "#ef9fc9",
        emissive: "#842956",
        emissiveIntensity: .24,
        roughness: .1,
        metalness: .02,
        transparent: true,
        opacity: .62,
        transmission: .34,
        thickness: .28,
        ior: 1.34,
        iridescence: .52,
        iridescenceIOR: 1.26,
        iridescenceThicknessRange: [ 120, 420 ],
        flatShading: true,
        side: THREE.DoubleSide,
        depthWrite: false
    }), fruitCoreGeo = new THREE.OctahedronGeometry(.046, 1), fruitCoreMat = new THREE.MeshBasicMaterial({
        color: "#ffe5a8",
        transparent: true,
        opacity: .94
    }), fruitCalyxGeo = new THREE.ConeGeometry(.047, .034, 5, 1, true), fruitCalyxMat = new THREE.MeshStandardMaterial({
        color: "#bd6d99",
        emissive: "#5b203f",
        emissiveIntensity: .18,
        roughness: .72,
        side: THREE.DoubleSide
    });
    resetCrownIndex();
    window.__birthKit = {
        seedGeo: seedGeo,
        seedMat: seedMat,
        branchAnchor: branchAnchor,
        seedGroup: seedGroup,
        fruitGroup: fruitGroup,
        dewGroup: dewGroup,
        dewAnchors: dewAnchors,
        hangStem: hangStem,
        fruitShellGeo: fruitShellGeo,
        fruitShellMat: fruitShellMat,
        fruitCoreGeo: fruitCoreGeo,
        fruitCoreMat: fruitCoreMat,
        fruitCalyxGeo: fruitCalyxGeo,
        fruitCalyxMat: fruitCalyxMat,
        dewGeo: dewGeo,
        dewMat: dewMat
    };
    scheduleCrownReconcile();
    root.attach(forms);
    {
        let n = 0;
        scene.traverse(o => {
            if (o.name === "memory-forms-prototype") n++;
        });
        window.__memoryFormsGroups = n;
    }
    return forms;
}
function candidateMaterial(treeNo, src, foliage) {
    const matName = String(src?.name || "").toLowerCase();
    let color = "#d28fb9", emissive = "#6b264c", emissiveIntensity = .42, opacity = 1, alphaTest = 0, roughness = .78;
    if (treeNo === "19–21") {
        if (foliage) {
            color = "#fff2fa";
            emissive = "#a9497d";
            emissiveIntensity = .66;
            opacity = .95;
            alphaTest = .2;
            roughness = .72;
        } else {
            color = "#c982a7";
            emissive = "#5f2945";
            emissiveIntensity = .34;
            roughness = .88;
        }
    } else if (treeNo === "12") {
        if (foliage) {
            const second = /leaf2/.test(matName);
            color = second ? "#e5b8df" : "#ffd7e9";
            emissive = second ? "#663a77" : "#8a3c68";
            emissiveIntensity = second ? .26 : .38;
            opacity = second ? .82 : .91;
            alphaTest = .15;
            roughness = .68;
        } else {
            color = "#d58bad";
            emissive = "#682a4b";
            emissiveIntensity = .4;
            roughness = .86;
        }
    } else if (treeNo === "3") {
        color = "#c97fa8";
        emissive = "#6d294b";
        emissiveIntensity = .46;
        roughness = .88;
    }
    return new THREE.MeshStandardMaterial({
        color: color,
        emissive: emissive,
        emissiveIntensity: emissiveIntensity,
        map: src?.map || null,
        alphaMap: src?.alphaMap || null,
        normalMap: src?.normalMap || null,
        roughnessMap: src?.roughnessMap || null,
        transparent: foliage,
        opacity: opacity,
        alphaTest: foliage ? alphaTest : 0,
        depthWrite: !foliage,
        roughness: roughness,
        metalness: 0,
        side: THREE.DoubleSide
    });
}
function addProceduralCrown(root) {
    const box = (new THREE.Box3).setFromObject(root), size = box.getSize(new THREE.Vector3), center = box.getCenter(new THREE.Vector3), h = Math.max(.01, size.y);
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 96;
    const cx = canvas.getContext("2d"), grad = cx.createLinearGradient(32, 10, 32, 90);
    grad.addColorStop(0, "rgba(255,226,244,.98)");
    grad.addColorStop(.55, "rgba(222,158,205,.92)");
    grad.addColorStop(1, "rgba(139,78,151,0)");
    cx.fillStyle = grad;
    cx.beginPath();
    cx.moveTo(32, 4);
    cx.bezierCurveTo(58, 22, 58, 61, 32, 91);
    cx.bezierCurveTo(6, 61, 6, 22, 32, 4);
    cx.fill();
    cx.strokeStyle = "rgba(255,235,248,.55)";
    cx.lineWidth = 1.2;
    cx.beginPath();
    cx.moveTo(32, 12);
    cx.lineTo(32, 86);
    cx.stroke();
    const tex = new THREE.CanvasTexture(canvas), palette = [ "#ffd4e9", "#eab6db", "#d2b5e7" ], group = new THREE.Group;
    group.name = "procedural-memory-leaves";
    let seed = 73129;
    const rnd = () => (seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296;
    for (let i = 0; i < 132; i++) {
        const yN = .43 + rnd() * .54, spread = Math.sin(Math.min(1, (yN - .38) / .62) * Math.PI) * .56 + .12, angle = rnd() * Math.PI * 2;
        const xRadius = Math.max(size.x * .5, h * .11) * spread, zRadius = Math.max(size.z * .6, h * .085) * spread;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
            map: tex,
            color: palette[i % palette.length],
            transparent: true,
            opacity: .78 + rnd() * .18,
            depthWrite: false,
            alphaTest: .025,
            toneMapped: false
        }));
        sp.position.set(center.x + Math.cos(angle) * xRadius * (.54 + rnd() * .55), box.min.y + yN * h, center.z + Math.sin(angle) * zRadius * (.48 + rnd() * .55));
        const leafH = h * (.028 + rnd() * .019), leafW = leafH * (.43 + rnd() * .17);
        sp.scale.set(leafW, leafH, 1);
        sp.material.rotation = (rnd() - .5) * 1.35;
        group.add(sp);
    }
    root.add(group);
}
function select(ix) {
    const m = manifest[ix], my = ++token;
    document.querySelectorAll(".card").forEach((x, i) => x.classList.toggle("on", i === ix));
    document.querySelectorAll(".card")[ix]?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest"
    });
    clawdGroup.visible = m.n === "23" && !clawdUserOff;
    if (!clawdGroup.visible) {
        clawdSpeech.classList.remove("on", "chatting");
        setTreeChat(false);
    }
    if (m.n === "23") applyRingTune();
    const treeNo = String(m.n).includes("–") ? m.n : String(m.n).padStart(2, "0");
    document.getElementById("number").textContent = `TREE ${treeNo}`;
    document.getElementById("name").textContent = m.name;
    document.getElementById("meta").innerHTML = `${m.source || "Poly Pizza"} · ${m.license || "CC0 公共领域"}<br>${m.mb.toFixed(2)} MB · GLB · 可随开源项目分发`;
    load.style.display = "block";
    load.textContent = "正在换树…";
    const timer = setTimeout(() => {
        if (my === token) load.textContent = "这棵树加载太久了，点下一棵试试";
    }, 15e3);
    loader.load("/static/lib/models/candidates/" + m.file, g => {
        clearTimeout(timer);
        if (my !== token) {
            clean(g.scene);
            return;
        }
        if (active) clean(active);
        active = g.scene;
        const bark = new THREE.MeshStandardMaterial({
            color: "#d28fb9",
            emissive: "#ff9bce",
            emissiveIntensity: .72,
            roughness: .74,
            metalness: 0,
            side: THREE.DoubleSide
        });
        const meshes = [], leafSources = [], branchSources = [], vineSources = [];
        active.traverse(o => {
            if (o.isMesh) meshes.push(o);
        });
        meshes.forEach((o, meshIx) => {
            if (m.only && !m.only.includes(o.name) || m.meshRange && (meshIx < m.meshRange[0] || meshIx > m.meshRange[1])) {
                o.parent.remove(o);
                return;
            }
            const src = Array.isArray(o.material) ? o.material[0] : o.material, tag = `${o.name} ${src?.name || ""}`;
            const treeGN = m.n === "23", foliage = treeGN ? /Cluster/i.test(tag) : /leaf|leaves|branches/i.test(tag) || !!src?.alphaMap || !!src?.transparent;
            if (treeGN && foliage) {
                leafSources.push(o);
                o.visible = false;
                return;
            }
            if (treeGN && /Vines/i.test(tag)) {
                vineSources.push(o);
                o.visible = false;
                return;
            }
            if (treeGN && /Cortex|Prune/i.test(tag)) {
                o.visible = false;
                return;
            }
            if (treeGN && /BarkB/i.test(tag)) {
                if (!branchSources.length) resetBranchStat();
                o.userData.rawGeo = o.geometry;
                o.userData.branchIx = branchSources.length;
                const pruned = pruneTreeGNGeometry(o.geometry, String(branchSources.length));
                o.geometry = beautifyTreeGNRoots(pruned);
                o.geometry.userData.faceMap = pruned.userData.faceMap;
                branchSources.push(o);
            }
            const vine = treeGN && /Vines/i.test(tag), backLeaf = treeGN && /ClusterB2/i.test(tag);
            o.material = treeGN ? new THREE.MeshStandardMaterial({
                color: foliage ? "#c978a7" : vine ? "#a98bc8" : "#df91ba",
                emissive: foliage ? "#4e1835" : vine ? "#392857" : "#6b264c",
                emissiveIntensity: .3,
                map: src?.map || null,
                alphaMap: src?.alphaMap || null,
                normalMap: src?.normalMap || null,
                roughnessMap: src?.roughnessMap || null,
                transparent: foliage || vine,
                opacity: backLeaf ? .24 : foliage ? .7 : 1,
                alphaTest: foliage ? .1 : 0,
                depthWrite: !foliage,
                roughness: .86,
                metalness: 0,
                side: THREE.DoubleSide
            }) : candidateMaterial(String(m.n), src, foliage);
            o.frustumCulled = false;
            if (!foliage) {
                const halo = new THREE.Mesh(o.geometry, new THREE.MeshBasicMaterial({
                    color: "#ffd6ee",
                    transparent: true,
                    opacity: .012,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    side: THREE.BackSide
                }));
                halo.position.copy(o.position);
                halo.quaternion.copy(o.quaternion);
                halo.scale.copy(o.scale).multiplyScalar(1.012);
                o.parent.add(halo);
                o.userData.halo = halo;
            }
        });
        let badVisibleGeometry = 0;
        active.traverse(o => {
            if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
            const p = o.geometry.attributes.position;
            for (let i = 0; i < p.count; i++) {
                if (!Number.isFinite(p.getX(i)) || !Number.isFinite(p.getY(i)) || !Number.isFinite(p.getZ(i))) {
                    badVisibleGeometry++;
                    break;
                }
            }
        });
        canvas.dataset.badVisibleGeometry = String(badVisibleGeometry);
        if (String(m.n) === "3") addProceduralCrown(active);
        let b = (new THREE.Box3).setFromObject(active), s = b.getSize(new THREE.Vector3);
        active.scale.setScalar(5.2 / Math.max(.01, s.y));
        b = (new THREE.Box3).setFromObject(active);
        const c = b.getCenter(new THREE.Vector3);
        active.position.x -= c.x;
        active.position.y -= b.min.y + 2.5;
        active.position.z -= c.z;
        scene.add(active);
        active.updateMatrixWorld(true);
        currentTreeCenterY = (new THREE.Box3).setFromObject(active).getCenter(new THREE.Vector3).y;
        if (m.n === "23") {
            lastVineSources = vineSources;
            cleanCrownLeaves(active, leafSources, branchSources);
            buildMemoryForms(active, vineSources);
        }
        applySoloVisibility();
        controls.target.set(0, .25, 0);
        camera.position.set(0, .8, 8.8);
        load.style.display = "none";
    }, ev => {
        if (my === token && ev.total) load.textContent = `正在换树 ${Math.round(ev.loaded / ev.total * 100)}%…`;
    }, () => {
        clearTimeout(timer);
        load.textContent = "这棵树没种成功，点下一棵试试";
    });
}
cards.innerHTML = manifest.map((x, i) => `<button class="card" data-i="${i}"><b>${String(x.n).includes("–") ? x.n : String(x.n).padStart(2, "0")}</b><span>${x.name}</span></button>`).join("");
cards.addEventListener("click", e => {
    const b = e.target.closest(".card");
    if (b) select(+b.dataset.i);
});
select(0);
fetch("/api/starmap").then(r => r.json()).then(d => {
    if (!d.error) classifyMemories(d);
}).catch(() => {});
const debugArchivePreview = Math.min(1e4, Math.max(0, +new URLSearchParams(location.search).get("archivePreview") || 0));
if (debugArchivePreview) {
    const bootArchivePreview = () => {
        if (!memoryFormGroups.archive) {
            setTimeout(bootArchivePreview, 250);
            return;
        }
        if (!memoryRecords.archive.length) {
            const sampleCount = Math.min(512, debugArchivePreview);
            memoryRecords.archive = Array.from({
                length: sampleCount
            }, (_, i) => ({
                id: `archive-preview-${i}`,
                name: `万星规模预览 ${i + 1}`,
                preview: "仅用于观察上万颗记忆的密度与性能。",
                importance: 4 + i % 6,
                domain: "规模预览"
            }));
            allMemoryRecords = memoryRecords.archive.slice();
        }
        populateArchiveCloud();
        document.getElementById("memoryCount").textContent = `万星规模模拟 ${debugArchivePreview} · 每颗均可点击（循环映射预览记录）`;
    };
    setTimeout(bootArchivePreview, 450);
}
let archiveDetailLast = -1;
function updateArchiveLOD(force = false) {
    if (!archivePointCloud) return;
    const distance = camera.position.distanceTo(controls.target);
    const detail = 1 - THREE.MathUtils.smoothstep(distance, 4.2, 8.4);
    if (!force && Math.abs(detail - archiveDetailLast) < .008) return;
    archiveDetailLast = detail;
    const sizeA = archivePointCloud.geometry.attributes.pointSize;
    const glowA = archivePointCloud.geometry.attributes.glow;
    for (let i = 0; i < sizeA.count; i++) {
        const glow = glowA.getX(i);
        const base = glow > .9 ? .145 : glow > .6 ? .092 : .05 + i % 4 * .004;
        const farScale = archiveLayoutMode === "river" && pearlEnabled ? 1 : glow > .9 ? 1 : glow > .6 ? .64 : .24;
        const linked = archiveConstellationIndices.includes(i), selected = archiveConstellationSelf === i;
        sizeA.setX(i, base * (farScale + (1 - farScale) * detail) * (selected ? 3.05 : linked ? 2.25 : 1));
    }
    sizeA.needsUpdate = true;
    raycaster.params.Points.threshold = .22;
    document.getElementById("memoryCount").style.opacity = String(.42 + detail * .32);
}
controls.addEventListener("change", updateArchiveLOD);
addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    {
        const b = new THREE.Vector2;
        renderer.getDrawingBufferSize(b);
        reflRT.setSize(Math.max(1, b.x >> 1), Math.max(1, b.y >> 1));
    }
    if (archivePointMaterial) archivePointMaterial.uniforms.uScale.value = innerHeight * .64 * (+ringTune.starSize || 1);
});
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), +(typeof ringTune !== "undefined" && ringTune.bloomGlow || .38), .32, .32);
const clawdBufSize = new THREE.Vector2;
renderer.getDrawingBufferSize(clawdBufSize);
const clawdOrigRT = new THREE.WebGLRenderTarget(clawdBufSize.x, clawdBufSize.y, {
    type: THREE.HalfFloatType
});
const clawdMaskRT = new THREE.WebGLRenderTarget(Math.max(1, clawdBufSize.x >> 1), Math.max(1, clawdBufSize.y >> 1));
const clawdSaveQuad = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms),
    vertexShader: CopyShader.vertexShader,
    fragmentShader: CopyShader.fragmentShader
}));
const clawdSavePass = {
    enabled: true,
    needsSwap: false,
    clear: false,
    renderToScreen: false,
    setSize(w, h) {
        clawdOrigRT.setSize(w, h);
        clawdMaskRT.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
        if (typeof clawdCompositePass !== "undefined") clawdCompositePass.uniforms.uTexel.value.set(1 / Math.max(1, w >> 1), 1 / Math.max(1, h >> 1));
    },
    render(r, writeBuffer, readBuffer) {
        clawdSaveQuad.material.uniforms.tDiffuse.value = readBuffer.texture;
        r.setRenderTarget(clawdOrigRT);
        clawdSaveQuad.render(r);
    },
    dispose() {}
};
const clawdCompositePass = new ShaderPass({
    uniforms: {
        tDiffuse: {
            value: null
        },
        tOriginal: {
            value: clawdOrigRT.texture
        },
        tMask: {
            value: clawdMaskRT.texture
        },
        uAmt: {
            value: 1
        },
        uBright: {
            value: 1
        },
        uTexel: {
            value: new THREE.Vector2(1 / Math.max(1, clawdBufSize.x >> 1), 1 / Math.max(1, clawdBufSize.y >> 1))
        }
    },
    vertexShader: CopyShader.vertexShader,
    fragmentShader: "uniform sampler2D tDiffuse;uniform sampler2D tOriginal;uniform sampler2D tMask;uniform float uAmt;uniform float uBright;uniform vec2 uTexel;varying vec2 vUv;float mk(vec2 o){return texture2D(tMask,vUv+o*uTexel).r;}void main(){vec4 b=texture2D(tDiffuse,vUv);vec4 o=texture2D(tOriginal,vUv);float e=mk(vec2(0.0));e=min(e,min(min(mk(vec2(1.0,0.0)),mk(vec2(-1.0,0.0))),min(mk(vec2(0.0,1.0)),mk(vec2(0.0,-1.0)))));e=min(e,min(min(mk(vec2(.7,.7)),mk(vec2(-.7,.7))),min(mk(vec2(.7,-.7)),mk(vec2(-.7,-.7)))));e=smoothstep(.15,.95,e);gl_FragColor=mix(b,o,e*uAmt);gl_FragColor.rgb*=mix(1.0,uBright,e);}"
});
clawdCompositePass.uniforms.tOriginal.value = clawdOrigRT.texture;
clawdCompositePass.uniforms.tMask.value = clawdMaskRT.texture;
composer.addPass(clawdSavePass);
composer.addPass(bloomPass);
window.__bloomPass = bloomPass;
composer.addPass(clawdCompositePass);
composer.addPass(new OutputPass);
const reflRT = new THREE.WebGLRenderTarget(Math.max(1, clawdBufSize.x >> 1), Math.max(1, clawdBufSize.y >> 1), {
    type: THREE.HalfFloatType
});
const reflCam = new THREE.PerspectiveCamera, reflVP = new THREE.Matrix4;
let reflWaterY = -2.5, reflStrength = 0;
{
    const _n = new THREE.Vector3(0, 1, 0), _pt = new THREE.Vector3, _eye = new THREE.Vector3, _fwd = new THREE.Vector3, _up = new THREE.Vector3, _rot = new THREE.Matrix4, _clearKeep = new THREE.Color, _stat = {
        calls: 0,
        drawn: 0,
        why: "never"
    };
    window.__renderReflection = () => {
        _stat.calls++;
        if (!(typeof dayOn !== "undefined" && dayOn && reflStrength > .001)) {
            _stat.why = "off:dayOn=" + (typeof dayOn !== "undefined" ? dayOn : "undef") + ",s=" + reflStrength;
            return false;
        }
        camera.updateMatrixWorld();
        if (camera.position.y <= reflWaterY + .02) {
            _stat.why = "camUnderWater";
            return false;
        }
        _eye.set(camera.position.x, 2 * reflWaterY - camera.position.y, camera.position.z);
        _rot.extractRotation(camera.matrixWorld);
        _fwd.set(0, 0, -1).applyMatrix4(_rot);
        _up.set(0, 1, 0).applyMatrix4(_rot);
        _pt.set(_eye.x + _fwd.x, _eye.y - _fwd.y, _eye.z + _fwd.z);
        reflCam.up.set(_up.x, -_up.y, _up.z);
        reflCam.position.copy(_eye);
        reflCam.lookAt(_pt);
        reflCam.near = camera.near;
        reflCam.far = camera.far;
        reflCam.fov = camera.fov;
        reflCam.aspect = camera.aspect;
        reflCam.projectionMatrix.copy(camera.projectionMatrix);
        reflCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
        reflCam.updateMatrixWorld(true);
        reflVP.multiplyMatrices(reflCam.projectionMatrix, reflCam.matrixWorldInverse);
        const oldTarget = renderer.getRenderTarget(), oldAlpha = renderer.getClearAlpha();
        renderer.getClearColor(_clearKeep);
        renderer.setRenderTarget(reflRT);
        renderer.setClearColor(0, 1);
        renderer.clear(true, true, false);
        renderer.render(scene, reflCam);
        renderer.setRenderTarget(oldTarget);
        renderer.setClearColor(_clearKeep, oldAlpha);
        const u = daylightPass.uniforms;
        u.uReflVP.value.copy(reflVP);
        u.uCamPos.value.copy(camera.position);
        u.uWaterY.value = reflWaterY;
        if (active) u.uTreeXZ.value.set(active.position.x, active.position.z);
        _stat.drawn++;
        _stat.why = "ok";
        return true;
    };
    window.__reflDbg = () => {
        const px = new Uint8Array(4 * 64 * 64);
        let mean = 0, mx = 0;
        try {
            renderer.readRenderTargetPixels(reflRT, 0, 0, 64, 64, px);
            for (let i = 0; i < px.length; i += 4) {
                const l = (px[i] + px[i + 1] + px[i + 2]) / 3;
                mean += l;
                if (l > mx) mx = l;
            }
            mean /= 64 * 64;
        } catch (e) {
            mean = -1;
        }
        return {
            on: reflStrength > .001,
            waterY: reflWaterY,
            strength: reflStrength,
            size: [ reflRT.width, reflRT.height ],
            camY: +camera.position.y.toFixed(2),
            rtMean: +mean.toFixed(1),
            rtMax: mx,
            reflCamY: +reflCam.position.y.toFixed(2),
            calls: _stat.calls,
            drawn: _stat.drawn,
            why: _stat.why
        };
    };
    window.__reflView = v => {
        daylightPass.uniforms.uReflDbgView.value = v ? 1 : 0;
    };
}
const SPLASH_N = 6, splashBuf = [], splashTmp = new THREE.Vector3;
for (let i = 0; i < SPLASH_N; i++) splashBuf.push(new THREE.Vector4(0, 0, -999, 0));
let splashCursor = 0, splashLast = 0;
function registerSplash(lx, lz) {
    if (!(typeof dayOn !== "undefined" && dayOn && reflStrength > .001)) return;
    if (!(+dayState.splashA > .001)) return;
    const now = performance.now();
    if (now - splashLast < (+dayState.splashGap || 90)) return;
    splashLast = now;
    splashTmp.set(lx, 0, lz);
    if (archivePointCloud) archivePointCloud.localToWorld(splashTmp);
    splashBuf[splashCursor++ % SPLASH_N].set(splashTmp.x, splashTmp.z, daylightPass.uniforms.uTime.value, 1);
}
window.__splashDbg = () => ({
    live: splashBuf.filter(v => v.w > .5).length,
    last: splashBuf.map(v => [ +v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2) ]),
    cursor: splashCursor
});
{}
const DAY_BASE = {
    glowMix: 1,
    glowGain: 1.1,
    skyTop: "#cbb0dc",
    skyMid: "#e5bed9",
    skyBot: "#d5c4e7",
    skyLow: -24,
    skyHigh: 24,
    sunCol: "#ffffff",
    sunA: 0,
    sunCore: 1,
    sunAz: 5,
    sunEl: 14,
    horizonCol: "#fff2f6",
    horizonA: 0,
    reflA: 0,
    reflRipple: .5,
    reflFade: 40,
    hazeCol: "#fbe7f1",
    hazeA: 0,
    hazeEl: -9,
    cloudLit: "#fde6f0",
    cloudShade: "#c8b5dd",
    cloudA: 0,
    cloudTop: 14,
    mistCol: "#f6dcec",
    mistA: 0,
    mistSpeed: 1,
    mistTop: 4,
    nebulaA: 0,
    nebulaCol: "#e7a6d0",
    nebulaCol2: "#f7cfd8",
    nebulaShade: "#a4a3d6",
    radialMix: 0,
    coolCol: "#b5b3e0",
    coolA: 0,
    coolW: 35,
    cloudPuff: 3,
    reflBright: .03,
    auroraA: 0,
    auroraEl: 15,
    auroraV: 0,
    auroraAz: 0,
    milkyA: 0,
    starDust: 0,
    sparkA: 0,
    moonA: 0,
    moonRim: 0,
    moonAz: 7,
    moonEl: 17,
    moonR: 2.4,
    imgAz: 0,
    imgSpan: 110,
    imgEl: 6,
    imgFeather: 18,
    skyPano: 1,
    panoTop: 63,
    panoBottom: -70,
    seamBlend: 12,
    panoRepeat: 0,
    imgKeep: .6,
    imgGain: 1,
    seaEl: 0,
    seaMist: .35,
    seaMistW: 3,
    reflReal: .9,
    waterY: -2.5,
    reflRealFade: .06,
    reflRealRipple: .5,
    reflRealGain: 1,
    waterDark: .22,
    waterCol: "#efe2f2",
    waterSpark: .6,
    waterWave: 1,
    waterSpeed: 1,
    waterFres: .85,
    footRing: .32,
    footSize: .8,
    footSpeed: .5,
    footSpread: 4,
    splashA: .55,
    splashLife: 1.9,
    splashSpeed: .6,
    splashW: .13,
    splashGap: 400,
    seaMelt: .7,
    seaMeltW: 4,
    riverEnd: .75,
    ink: "#6b3f4f",
    inkTint: .45,
    inkDark: .55,
    inkA: .9,
    inkLo: .02,
    inkHi: .6,
    glintCol: "#ffffff",
    glint: 0,
    clawdKeep: 1
};
const DAY_PRESETS = {
    pink: {
        preset: "pink",
        glowGain: 1.05,
        skyTop: "#a598cf",
        skyMid: "#dba7cd",
        skyBot: "#f4c9d4",
        skyLow: -2,
        skyHigh: 38,
        coolCol: "#aab2df",
        coolA: .7,
        coolW: 28,
        sunCol: "#ffc9ae",
        sunA: 1,
        sunCore: 0,
        sunAz: 4,
        sunEl: 10,
        horizonA: .5,
        horizonCol: "#fff3ee",
        reflA: .9,
        reflRipple: .6,
        reflFade: 60,
        reflBright: .08,
        hazeA: .22,
        hazeCol: "#ffdcdc",
        hazeEl: 4,
        nebulaA: .95,
        nebulaCol: "#e595c6",
        nebulaCol2: "#ffdcd0",
        nebulaShade: "#a0a0d4",
        radialMix: .45,
        cloudA: .8,
        cloudTop: 18,
        cloudPuff: 1.8,
        cloudLit: "#fff1f0",
        cloudShade: "#ab96cf",
        mistA: .06,
        mistCol: "#f2d0e4",
        mistTop: 22,
        sparkA: .8,
        starDust: .2
    },
    aurora: {
        preset: "aurora",
        skyTop: "#737cbd",
        skyMid: "#9ea2d6",
        skyBot: "#d9c6e3",
        skyLow: -2,
        skyHigh: 40,
        sunCol: "#ffe0ee",
        sunA: .25,
        sunCore: 0,
        sunAz: 0,
        sunEl: 1,
        horizonA: .7,
        horizonCol: "#fff3f7",
        reflA: .8,
        reflRipple: .5,
        reflFade: 50,
        hazeA: .15,
        hazeCol: "#eedcef",
        hazeEl: 4,
        cloudA: .65,
        cloudTop: 9,
        cloudLit: "#fdeaf3",
        cloudShade: "#a99fd2",
        mistA: .08,
        mistCol: "#d6d2f0",
        mistTop: 5,
        auroraA: 1.5,
        auroraEl: 9,
        auroraV: 15,
        auroraAz: 0,
        milkyA: .55,
        starDust: .6,
        sparkA: .9,
        moonA: .85,
        moonRim: 1,
        moonAz: 12,
        moonEl: 10,
        moonR: 7
    },
    cloud: {
        preset: "cloud",
        glowGain: 1.15,
        skyTop: "#bfb3e2",
        skyMid: "#e6c3dc",
        skyBot: "#f2cfd3",
        sunCol: "#fff1d6",
        sunA: .75,
        sunAz: 9,
        sunEl: 2
    },
    pearl: {
        preset: "pearl",
        skyTop: "#a7a2d4",
        skyMid: "#c4bee4",
        skyBot: "#d8cfeb",
        sunA: .18,
        sunAz: 6,
        sunEl: 20
    },
    dawn: {
        preset: "dawn",
        glowMix: 0,
        glowGain: 1,
        skyTop: "#eadccb",
        skyMid: "#fbf0e1",
        skyBot: "#f5d6bd",
        sunCol: "#ffcf8a",
        sunA: .5,
        sunAz: 5,
        sunEl: 10,
        glintCol: "#fff1cf",
        glint: .28
    }
};
for (const k in DAY_PRESETS) DAY_PRESETS[k] = {
    ...DAY_BASE,
    ...DAY_PRESETS[k]
};
const DAY_KEYS = [ [ "imgKeep", "天空图显出来(越大叠加的雾和光越淡)", 0, 1, .02 ], [ "imgGain", "天空图亮度", .4, 1.3, .02 ], [ "seaEl", "海平线高度(度)", -20, 20, .5 ], [ "seaMist", "海平线柔雾", 0, 1, .02 ], [ "seaMistW", "柔雾宽度(度)", .5, 15, .5 ], [ "glowMix", "发光↔墨色(1=发光)", 0, 1, .05 ], [ "glowGain", "光的强度", .3, 2.5, .05 ], [ "skyTop", "天顶", "c" ], [ "skyMid", "中间", "c" ], [ "skyBot", "地平线", "c" ], [ "skyHigh", "天顶色在(度)", 0, 90, 1 ], [ "skyLow", "地平线色在(度)", -60, 30, 1 ], [ "horizonCol", "地平线光带色", "c" ], [ "horizonA", "地平线光带", 0, 1.5, .02 ], [ "reflReal", "真倒影(树和河映在水里)", 0, 1, .02 ], [ "waterY", "水面高度(树根≈-2.5)", -6, 2, .05 ], [ "reflRealRipple", "水面波纹", 0, 2, .05 ], [ "reflRealFade", "倒影淡出(越大越近)", 0, .3, .005 ], [ "reflRealGain", "倒影亮度", .2, 2, .05 ], [ "waterCol", "水的颜色", "c" ], [ "waterDark", "水面压暗(不压暗看不见倒影)", 0, .6, .01 ], [ "waterWave", "水波大小", 0, 2.5, .05 ], [ "waterSpeed", "水波流动快慢", 0, 3, .05 ], [ "waterSpark", "水面碎光", 0, 2, .05 ], [ "waterFres", "贴着看更像镜子", 0, 1, .02 ], [ "footRing", "树脚下的波圈(星河模式自动不显示)", 0, 1.2, .02 ], [ "footSize", "波圈间距", .15, 2, .025 ], [ "footSpeed", "波圈扩散快慢", 0, 2, .05 ], [ "footSpread", "波圈铺多远", .6, 10, .2 ], [ "splashA", "星星落水的波纹", 0, 2, .02 ], [ "splashSpeed", "落水波纹扩散", .2, 3, .05 ], [ "splashW", "落水波纹粗细", .03, .4, .01 ], [ "splashLife", "落水波纹持续(秒)", .4, 4, .1 ], [ "splashGap", "多久落一颗(毫秒)", 30, 600, 10 ], [ "seaMelt", "远处化进海平线", 0, 1, .02 ], [ "seaMeltW", "化进的范围(度)", .5, 15, .5 ], [ "riverEnd", "河的收边软化", 0, 1, .02 ], [ "reflA", "天空倒影(老的·假)", 0, 1, .02 ], [ "reflRipple", "倒影涟漪", 0, 2, .05 ], [ "reflFade", "倒影淡出(度)", 5, 90, 1 ], [ "hazeCol", "柔光色", "c" ], [ "hazeA", "柔光", 0, 1, .02 ], [ "hazeEl", "柔光高度(度)", -30, 30, 1 ], [ "cloudLit", "云亮面", "c" ], [ "cloudShade", "云暗面", "c" ], [ "cloudA", "云堤", 0, 1, .02 ], [ "cloudTop", "云堤高度(度)", 2, 40, 1 ], [ "mistCol", "雾色", "c" ], [ "mistA", "雾浓度", 0, 1, .02 ], [ "mistSpeed", "雾飘速度", 0, 4, .05 ], [ "mistTop", "雾的高度(度)", -20, 40, 1 ], [ "coolCol", "两边冷色", "c" ], [ "coolA", "冷暖对比", 0, 1, .02 ], [ "coolW", "冷色从多远开始(度)", 5, 120, 1 ], [ "nebulaCol", "星云色", "c" ], [ "nebulaCol2", "星云亮处色", "c" ], [ "nebulaShade", "星云暗处色", "c" ], [ "radialMix", "星云放射感", 0, 1, .02 ], [ "nebulaA", "星云", 0, 1, .02 ], [ "cloudPuff", "云的蓬松(小=高)", 1, 5, .1 ], [ "reflBright", "倒影提亮", 0, .2, .005 ], [ "auroraA", "极光", 0, 2, .02 ], [ "auroraEl", "极光顶边(度)", 0, 70, 1 ], [ "auroraV", "极光两边抬高(度)", 0, 40, 1 ], [ "auroraAz", "极光中心方位(度)", -180, 180, 1 ], [ "milkyA", "银河带", 0, 1.5, .02 ], [ "starDust", "星尘", 0, 2, .05 ], [ "sparkA", "星芒亮星", 0, 2, .05 ], [ "moonA", "月亮/星球", 0, 1, .02 ], [ "moonRim", "月牙↔星球弧", 0, 1, .05 ], [ "moonAz", "方位(度)", -180, 180, 1 ], [ "moonEl", "仰角(度)", -10, 80, 1 ], [ "moonR", "大小(度)", .5, 20, .1 ], [ "sunCol", "太阳色", "c" ], [ "sunA", "太阳/暖光", 0, 1.5, .02 ], [ "sunCore", "太阳亮核", 0, 1, .05 ], [ "sunAz", "太阳方位(度)", -180, 180, 1 ], [ "sunEl", "太阳仰角(度)", -10, 80, 1 ], [ "imgAz", "天空图朝向(度)", -180, 180, 1 ], [ "imgSpan", "天空图铺多宽(度)", 30, 360, 1 ], [ "imgEl", "天空图高度(度)", -40, 60, 1 ], [ "imgFeather", "图边缘羽化(度)", 0, 60, 1 ], [ "panoTop", "全景上沿(度)", 10, 90, 1 ], [ "panoBottom", "全景下沿(度)", -90, 0, 1 ], [ "seamBlend", "全景接缝融合(度)", 0, 40, 1 ], [ "panoRepeat", "全景重复几次(0=自动)", 0, 8, 1 ], [ "glintCol", "高光色", "c" ], [ "glint", "亮核高光", 0, 1, .02 ], [ "clawdKeep", "Clawd保留原色", 0, 1, .05 ] ];
const DAY_SECTIONS = [ [ "常用", [ "glowMix", "glowGain", "imgKeep", "imgGain", "glintCol", "glint", "clawdKeep" ] ], [ "天空的颜色", [ "skyTop", "skyMid", "skyBot", "skyHigh", "skyLow", "coolCol", "coolA", "coolW" ] ], [ "太阳和月亮", [ "sunCol", "sunA", "sunCore", "sunAz", "sunEl", "moonA", "moonRim", "moonAz", "moonEl", "moonR" ] ], [ "云和雾", [ "hazeCol", "hazeA", "hazeEl", "cloudLit", "cloudShade", "cloudA", "cloudTop", "cloudPuff", "mistCol", "mistA", "mistSpeed", "mistTop" ] ], [ "星星·星云·极光", [ "nebulaCol", "nebulaCol2", "nebulaShade", "radialMix", "nebulaA", "auroraA", "auroraEl", "auroraV", "auroraAz", "milkyA", "starDust", "sparkA" ] ], [ "海平线", [ "seaEl", "seaMist", "seaMistW", "horizonCol", "horizonA", "seaMelt", "seaMeltW", "riverEnd" ] ], [ "💧 水面", [ "reflReal", "waterY", "waterCol", "waterDark", "waterWave", "waterSpeed", "waterFres", "waterSpark", "reflRealRipple", "reflRealGain", "reflRealFade", "reflBright", "reflA", "reflRipple", "reflFade" ] ], [ "水上的波纹", [ "footRing", "footSize", "footSpeed", "footSpread", "splashA", "splashSpeed", "splashW", "splashLife", "splashGap" ] ], [ "天空图怎么贴", [ "imgAz", "imgSpan", "imgEl", "imgFeather", "panoTop", "panoBottom", "seamBlend", "panoRepeat" ] ] ];
const DAY_IMG_KEYS = [ "imgKeep", "imgGain", "seaEl", "seaMist", "seaMistW", "skyPano", "imgAz", "imgSpan", "imgEl", "imgFeather", "panoTop", "panoBottom", "seamBlend", "panoRepeat" ];
const dayKeepImg = () => Object.fromEntries(DAY_IMG_KEYS.map(k => [ k, dayState[k] ]));
const hex3 = h => {
    const n = parseInt(String(h || "#000000").slice(1), 16) || 0;
    return new THREE.Vector3((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255);
};
const daylightPass = new ShaderPass({
    uniforms: {
        tDiffuse: {
            value: null
        },
        tMask: {
            value: null
        },
        tSky: {
            value: null
        },
        tSkyAvg: {
            value: null
        },
        tRefl: {
            value: null
        },
        uReflVP: {
            value: new THREE.Matrix4
        },
        uCamPos: {
            value: new THREE.Vector3
        },
        uWaterY: {
            value: -2.5
        },
        reflReal: {
            value: 0
        },
        reflRealFade: {
            value: .06
        },
        reflRealRipple: {
            value: .5
        },
        reflRealGain: {
            value: 1
        },
        waterDark: {
            value: .22
        },
        waterCol: {
            value: new THREE.Vector3(1, 1, 1)
        },
        waterSpark: {
            value: .6
        },
        waterWave: {
            value: 1
        },
        waterSpeed: {
            value: 1
        },
        waterFres: {
            value: .85
        },
        footRing: {
            value: 0
        },
        footSize: {
            value: .8
        },
        footSpeed: {
            value: .5
        },
        footSpread: {
            value: 4
        },
        splashA: {
            value: .55
        },
        splashLife: {
            value: 1.8
        },
        splashSpeed: {
            value: 1.1
        },
        splashW: {
            value: .11
        },
        uSplash: {
            value: null
        },
        uTreeXZ: {
            value: new THREE.Vector2(0, 0)
        },
        seaMelt: {
            value: 0
        },
        seaMeltW: {
            value: .07
        },
        uReflDbgView: {
            value: 0
        },
        uSkyOn: {
            value: 0
        },
        uPanoRepeat: {
            value: 1
        },
        imgKeep: {
            value: .6
        },
        imgGain: {
            value: 1
        },
        seaEl: {
            value: 0
        },
        seaMist: {
            value: .35
        },
        seaMistW: {
            value: .05
        },
        uSkyAspect: {
            value: 1
        },
        uAspect: {
            value: 1
        },
        uTime: {
            value: 0
        },
        uInvProj: {
            value: new THREE.Matrix4
        },
        uCamWorld: {
            value: new THREE.Matrix4
        },
        skyTop: {
            value: new THREE.Vector3
        },
        skyMid: {
            value: new THREE.Vector3
        },
        skyBot: {
            value: new THREE.Vector3
        },
        skyLow: {
            value: -.42
        },
        skyHigh: {
            value: .42
        },
        sunCol: {
            value: new THREE.Vector3
        },
        sunA: {
            value: 0
        },
        sunCore: {
            value: 1
        },
        sunDir: {
            value: new THREE.Vector3(0, 0, -1)
        },
        moonA: {
            value: 0
        },
        moonR: {
            value: .04
        },
        moonRim: {
            value: 0
        },
        moonDir: {
            value: new THREE.Vector3(0, 0, -1)
        },
        horizonCol: {
            value: new THREE.Vector3
        },
        horizonA: {
            value: 0
        },
        reflA: {
            value: 0
        },
        reflRipple: {
            value: .5
        },
        reflFade: {
            value: .7
        },
        hazeCol: {
            value: new THREE.Vector3
        },
        hazeA: {
            value: 0
        },
        hazeEl: {
            value: -.16
        },
        cloudLit: {
            value: new THREE.Vector3
        },
        cloudShade: {
            value: new THREE.Vector3
        },
        cloudA: {
            value: 0
        },
        cloudTop: {
            value: .24
        },
        mistCol: {
            value: new THREE.Vector3
        },
        mistA: {
            value: 0
        },
        mistSpeed: {
            value: 1
        },
        mistTop: {
            value: .07
        },
        nebulaA: {
            value: 0
        },
        nebulaCol: {
            value: new THREE.Vector3
        },
        nebulaCol2: {
            value: new THREE.Vector3
        },
        nebulaShade: {
            value: new THREE.Vector3
        },
        radialMix: {
            value: 0
        },
        coolCol: {
            value: new THREE.Vector3
        },
        coolA: {
            value: 0
        },
        coolW: {
            value: .6
        },
        cloudPuff: {
            value: 3
        },
        reflBright: {
            value: .03
        },
        auroraA: {
            value: 0
        },
        auroraEl: {
            value: .26
        },
        auroraV: {
            value: 0
        },
        auroraAz: {
            value: 0
        },
        milkyA: {
            value: 0
        },
        starDust: {
            value: 0
        },
        sparkA: {
            value: 0
        },
        imgAz: {
            value: 0
        },
        imgSpan: {
            value: 1.92
        },
        imgEl: {
            value: .1
        },
        imgFeather: {
            value: .31
        },
        uSkyPano: {
            value: 0
        },
        panoTop: {
            value: 1.05
        },
        panoBottom: {
            value: -1.05
        },
        seamBlend: {
            value: .21
        },
        glowMix: {
            value: 1
        },
        glowGain: {
            value: 1
        },
        ink: {
            value: new THREE.Vector3
        },
        inkTint: {
            value: .4
        },
        inkDark: {
            value: .55
        },
        inkA: {
            value: .9
        },
        inkLo: {
            value: .02
        },
        inkHi: {
            value: .6
        },
        glintCol: {
            value: new THREE.Vector3
        },
        glint: {
            value: 0
        },
        clawdKeep: {
            value: 1
        },
        uMaskTexel: {
            value: new THREE.Vector2(1 / 450, 1 / 450)
        }
    },
    vertexShader: CopyShader.vertexShader,
    fragmentShader: `uniform sampler2D tDiffuse;uniform sampler2D tMask;uniform sampler2D tSky;uniform sampler2D tSkyAvg;uniform float uSkyOn;uniform float uSkyAspect;uniform float uTime;\nuniform mat4 uInvProj;uniform mat4 uCamWorld;\nuniform vec3 skyTop;uniform vec3 skyMid;uniform vec3 skyBot;uniform float skyLow;uniform float skyHigh;\nuniform vec3 sunCol;uniform float sunA;uniform float sunCore;uniform vec3 sunDir;uniform float moonA;uniform float moonR;uniform float moonRim;uniform vec3 moonDir;\nuniform sampler2D tRefl;uniform mat4 uReflVP;uniform vec3 uCamPos;uniform float uWaterY;uniform float uReflDbgView;uniform float reflReal;uniform float reflRealFade;uniform float reflRealRipple;uniform float reflRealGain;uniform float waterDark;uniform vec3 waterCol;uniform float waterSpark;uniform float waterWave;uniform float waterSpeed;uniform float waterFres;uniform float footRing;uniform float footSize;uniform float footSpeed;uniform float footSpread;uniform vec2 uTreeXZ;\nuniform float splashA;uniform float splashLife;uniform float splashSpeed;uniform float splashW;uniform vec4 uSplash[6];uniform float seaMelt;uniform float seaMeltW;\nuniform vec3 horizonCol;uniform float horizonA;uniform float reflA;uniform float reflRipple;uniform float reflFade;uniform vec3 hazeCol;uniform float hazeA;uniform float hazeEl;\nuniform vec3 cloudLit;uniform vec3 cloudShade;uniform float cloudA;uniform float cloudTop;uniform vec3 mistCol;uniform float mistA;uniform float mistSpeed;uniform float mistTop;\nuniform float nebulaA;uniform vec3 nebulaCol;uniform vec3 nebulaCol2;uniform vec3 nebulaShade;uniform float radialMix;uniform vec3 coolCol;uniform float coolA;uniform float coolW;uniform float cloudPuff;uniform float reflBright;uniform float auroraA;uniform float auroraEl;uniform float auroraV;uniform float auroraAz;uniform float milkyA;uniform float starDust;uniform float sparkA;\nuniform float imgAz;uniform float imgSpan;uniform float imgEl;uniform float imgFeather;uniform float uSkyPano;uniform float uPanoRepeat;uniform float imgKeep;uniform float imgGain;uniform float seaEl;uniform float seaMist;uniform float seaMistW;uniform float panoTop;uniform float panoBottom;uniform float seamBlend;\nuniform float glowMix;uniform float glowGain;uniform vec3 ink;uniform float inkTint;uniform float inkDark;uniform float inkA;uniform float inkLo;uniform float inkHi;\nuniform vec3 glintCol;uniform float glint;uniform float clawdKeep;uniform vec2 uMaskTexel;\nvarying vec2 vUv;\nfloat hash3(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}\nfloat vnoise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);\n  return mix(mix(mix(hash3(i),hash3(i+vec3(1.,0.,0.)),f.x),mix(hash3(i+vec3(0.,1.,0.)),hash3(i+vec3(1.,1.,0.)),f.x),f.y),\n             mix(mix(hash3(i+vec3(0.,0.,1.)),hash3(i+vec3(1.,0.,1.)),f.x),mix(hash3(i+vec3(0.,1.,1.)),hash3(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}\nfloat fbm3(vec3 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*vnoise3(p);p=p*2.03+vec3(1.7,9.2,4.1);a*=.5;}return v;}\nfloat fbm2(vec3 p){return .5*vnoise3(p)+.25*vnoise3(p*2.03+vec3(1.7,9.2,4.1))+.125;}   \nvec3 panoTex(float v,float t){float a=fract(v),b=fract(v+.5)-.5;return texture2D(tSky,vec2(fwidth(a)<fwidth(b)-.001?a:b,t)).rgb;}\nvec3 starLayer(vec3 dir){\n  vec3 c=vec3(0.);\n  if(starDust>0.){vec3 g=dir*260.,id=floor(g);float h=hash3(id);\n    if(h>.93){vec3 sc=normalize(id+.5);float ang=length(dir-sc*dot(dir,sc))*260.;c+=vec3(1.)*exp(-ang*ang*9.)*(.6+.4*sin(uTime*(.7+h*2.)+h*80.))*starDust*(h-.93)*9.;}}\n  if(sparkA>0.){vec3 g=dir*38.,id=floor(g);float h=hash3(id+vec3(3.1));\n    if(h>.965){vec3 sc=normalize(id+.5);vec3 rt=normalize(cross(vec3(0.,1.,0.),sc)),up=cross(sc,rt);\n      vec2 p=vec2(dot(dir,rt),dot(dir,up))*61.;   \n      float tw=.55+.45*sin(uTime*(.6+h*2.5)+h*47.),sz=.6+(h-.965)*25.;p/=sz;\n      c+=vec3(1.,.97,.99)*(exp(-dot(p,p)*60.)*1.2+(exp(-abs(p.x)*40.)*exp(-abs(p.y)*5.)+exp(-abs(p.y)*40.)*exp(-abs(p.x)*5.))*.55)*tw*sparkA;}}\n  return c;}\nvec3 moonLayer(vec3 c,vec3 dir){\n  if(moonA<=0.||dot(dir,moonDir)<=0.)return c;\n  vec3 rt=normalize(cross(vec3(0.,1.,0.),moonDir));vec3 up=cross(moonDir,rt);\n  vec2 m=vec2(dot(dir,rt),dot(dir,up));float r=length(m);\n  float disc=1.-smoothstep(moonR*.985,moonR,r),cut=1.-smoothstep(moonR*.89,moonR*.93,length(m-vec2(-moonR*.38,moonR*.2)));\n  vec3 cres=mix(c,vec3(.98,.97,1.),clamp(disc-cut,0.,1.)*.9);cres=mix(cres,vec3(.93,.93,1.),disc*cut*.08);cres+=vec3(.86,.88,1.)*exp(-max(r-moonR,0.)*38.)*.14;\n  float side=smoothstep(-.3,.85,dot(m/max(r,1e-5),normalize(vec2(-1.,.35))));   \n  float rim=exp(-pow((r-moonR)/(moonR*.012+.0006),2.))*side;\n  vec3 planet=mix(c,c*.96+vec3(.01,.012,.03),disc*.85)+vec3(.97,.97,1.)*rim*.95+vec3(.85,.88,1.)*exp(-max(r-moonR,0.)*12./max(moonR,.01))*smoothstep(moonR*.99,moonR*1.01,r)*side*.08;\n  return mix(c,mix(cres,planet,moonRim),moonA);}\nvec3 skyUpper(vec3 dir,float el,float az){\n  float t=clamp((el-skyLow)/max(skyHigh-skyLow,.001),0.,1.);\n  vec3 c=t>.5?mix(skyMid,skyTop,smoothstep(.5,1.,t)):mix(skyBot,skyMid,smoothstep(0.,.5,t));\n  if(uSkyOn>.5){\n    if(uSkyPano>.5){\n      float x=(az-imgAz)/6.28318+.5,tp=(el-seaEl-panoBottom)/max(panoTop-panoBottom,.01),tt=clamp(tp,.002,.998);\n      float dd=min(x,1.-x),bw=max(seamBlend/6.28318,.0001);\n      vec3 img;\n      if(uPanoRepeat>1.5){   \n        float xs=x+.5/uPanoRepeat,a=xs*uPanoRepeat,b=(fract(xs+.5)-.5)*uPanoRepeat;\n        float fa=mod(floor(a),2.)>.5?1.-fract(a):fract(a),fb=mod(floor(b),2.)>.5?1.-fract(b):fract(b);\n        img=texture2D(tSky,vec2(fwidth(a)<fwidth(b)-.001?fa:fb,tt)).rgb;\n      }else img=mix(panoTex(x,tt),panoTex(-x,tt),.5*(1.-smoothstep(0.,bw,dd)));\n      c=mix(tp>.5?texture2D(tSkyAvg,vec2(.5,.985)).rgb:texture2D(tSkyAvg,vec2(.5,.015)).rgb,img,smoothstep(0.,.12,tp)*(1.-smoothstep(.88,1.,tp)));\n    }else{\n      float du=mod(az-imgAz+3.14159,6.28318)-3.14159,vspan=imgSpan/uSkyAspect,u=du/imgSpan+.5,v=(el-seaEl-imgEl)/vspan+.5;\n      vec3 avg=texture2D(tSkyAvg,vec2(.5,clamp(v,.01,.99))).rgb,img=texture2D(tSky,vec2(clamp(u,0.,1.),clamp(v,0.,1.))).rgb;\n      float fu=max(imgFeather/imgSpan,.001),fv=max(imgFeather/vspan,.001);\n      c=mix(avg,img,smoothstep(0.,fu,u)*(1.-smoothstep(1.-fu,1.,u))*smoothstep(0.,fv,v)*(1.-smoothstep(1.-fv,1.,v)));\n    }}\n  \n  if(uSkyOn>.5)c*=imgGain;   \n  \n  float fk=1.-imgKeep*step(.5,uSkyOn),nA=nebulaA*fk,cA=cloudA*fk,mA=mistA*fk,hA=hazeA*fk,kA=coolA*fk;\n  if(coolA>0.){float ha=acos(clamp(dot(normalize(dir.xz+1e-4),normalize(sunDir.xz+1e-4)),-1.,1.));c=mix(c,coolCol,smoothstep(0.,max(coolW,.01),ha)*kA);}\n  if(hazeA>0.)c=mix(c,hazeCol,exp(-pow((el-hazeEl)/.14,2.))*hA);\n  if(horizonA>0.){float ae=abs(el-seaEl);c=mix(c,horizonCol,clamp((exp(-ae*80.)*.9+exp(-ae*14.)*.15)*horizonA*fk,0.,1.));}\n  if(nebulaA>0.){vec3 q=dir*2.2+vec3(uTime*.003,0.,uTime*.002);   \n    vec3 wq=q+1.4*vec3(fbm2(q*1.1+1.7),fbm2(q*1.1+9.2),fbm2(q*1.1+4.4));\n    \n    vec3 cn=sunDir,rt=normalize(cross(vec3(0.,1.,0.),cn)),uv2=cross(cn,rt);\n    float rho=acos(clamp(dot(dir,cn),-1.,1.)),th=atan(dot(dir,uv2),dot(dir,rt));\n    float thw=th+.5*(fbm2(q*2.3+3.3)-.5);   \n    float streak=fbm3(vec3(cos(thw)*6.,sin(thw)*6.,rho*3.2-uTime*.004)+.9*vec3(fbm2(q*1.5),fbm2(q*1.5+7.),0.));\n    float mass=mix(fbm3(wq),streak,radialMix*smoothstep(.04,.35,rho)),bil=fbm3(wq*3.1+11.),fil=pow(1.-abs(2.*fbm2(wq*2.6)-1.),8.),up=smoothstep(-.05,.12,el);\n    c=mix(c,nebulaShade,(1.-smoothstep(.22,.48,mass))*nA*.7*up);   \n    c=mix(c,nebulaCol,smoothstep(.42,.75,mass)*nA*up);\n    c=mix(c,nebulaCol2,smoothstep(.6,.86,mass)*nA*.65*up);\n    c=mix(c,nebulaCol2,smoothstep(.5,.78,bil)*smoothstep(.38,.68,mass)*nA*.6*up);   \n    c+=vec3(1.,.93,.96)*fil*smoothstep(.45,.72,mass)*nA*.35*up;}\n  if(milkyA>0.){float d=dot(dir,normalize(vec3(.45,.75,-.5)));float band=exp(-d*d*28.);\n    if(band>.01)c=mix(c,vec3(.94,.91,1.),band*smoothstep(.38,.82,fbm3(dir*9.))*milkyA*.5);}\n  if(auroraA>0.&&el>-.02){vec2 ring=vec2(cos(az),sin(az));float side=az-auroraAz;\n    for(int i=0;i<3;i++){float fi=float(i);\n      float topEl=auroraEl+auroraV*abs(sin(side*.8+fi*.3))+.06*(fbm2(vec3(ring*2.,fi*3.1+uTime*.02))-.5)+fi*.04;\n      float dy=topEl-el;\n      float curtain=(dy<0.?exp(-dy*dy*1600.):exp(-dy*(5.+fi*1.5)))*smoothstep(-.01,.08,el)*smoothstep(.35,.7,fbm2(vec3(ring*3.5,fi*7.+uTime*.01)));   \n      float rays=smoothstep(.35,.9,fbm2(vec3(ring*(70.+fi*23.),fi*5.+uTime*.04)));\n      vec3 col=mix(vec3(.55,.93,.9),vec3(.8,.62,1.),clamp(.5+.5*sin(side*2.3+fi*1.7)-max(dy,0.)*.8,0.,1.));\n      float a=curtain*(.18+.82*rays)*auroraA;\n      c=mix(c,col,clamp(a*.65,0.,.8));c+=col*a*.12;}}\n  if(cloudA>0.&&el>-.02&&el<cloudTop*1.1){vec3 q=vec3(dir.x,dir.y*cloudPuff,dir.z)*4.+vec3(uTime*.003,0.,uTime*.002);\n    float n=fbm3(q),hgt=clamp(el/max(cloudTop,.01),0.,1.);\n    float dens=smoothstep(.45,.66,n+(1.-hgt)*.28-.14)*(1.-smoothstep(.7,1.,hgt));\n    float lit=clamp((n-fbm2(q-vec3(0.,.12,0.)))*4.+.5,0.,1.);   \n    c=mix(c,mix(cloudShade,cloudLit,lit),dens*cA);}\n  if(mistA>0.){vec3 q=dir*vec3(3.2,7.,3.2)+vec3(uTime*.02*mistSpeed,0.,uTime*.006*mistSpeed);\n    float m=fbm3(q+1.5*vnoise3(q*1.3-vec3(0.,uTime*.01*mistSpeed,0.)));\n    c=mix(c,mistCol,clamp((smoothstep(.32,.72,m)*(1.-smoothstep(mistTop-.12,mistTop+.2,el))*.85+smoothstep(.5,.85,m)*.45)*mA,0.,.85));}\n  if(sunA>0.){float q=acos(clamp(dot(dir,sunDir),-1.,1.));\n    c+=sunCol*sunA*fk*((exp(-q*q*1300.)*1.1+exp(-q*q*85.)*.35)*sunCore+exp(-q*8.4)*.1+exp(-q*2.5)*.28*(1.-sunCore));}   \n  c=moonLayer(c,dir);\n  return c+starLayer(dir)*smoothstep(-.02,.12,el);}\nvec3 skyAt(vec3 dir,float solid){\n  float el=asin(clamp(dir.y,-1.,1.)),az=atan(dir.x,-dir.z),elS=el-seaEl;vec3 c;\n  \n  float ra=reflA*(1.-imgKeep*step(.5,uSkyOn))*(1.-smoothstep(0.,max(reflFade,.01),-elS));\n  if(elS<0.){\n    vec3 under=uSkyOn>.5?skyUpper(dir,el,az):mix(skyBot,skyMid,.35);\n    if(ra>.001){   \n      float re=seaEl-elS,rp=reflRipple*clamp(-elS*5.,0.,1.)*.03;\n      vec3 rd=vec3(sin(az)*cos(re),sin(re),-cos(az)*cos(re));\n      rd.xz+=vec2(vnoise3(vec3(az*60.,el*140.,uTime*.25))-.5,vnoise3(vec3(az*60.+7.,el*140.,uTime*.25))-.5)*rp;rd=normalize(rd);\n      c=mix(under,skyUpper(rd,asin(clamp(rd.y,-1.,1.)),atan(rd.x,-rd.z))*(.96-reflBright)+vec3(reflBright),ra);\n    }else c=under;\n  }else c=skyUpper(dir,el,az);\n  \n  \n  \n  \n  \n  if(reflReal>.001&&dir.y<-1e-4&&uCamPos.y>uWaterY){\n    float t=(uWaterY-uCamPos.y)/dir.y;\n    if(t>0.&&t<6000.){\n      vec3 H=uCamPos+dir*t;\n      float atten=1./(1.+t*.05);                                   \n      float e=.45,ws=.5*max(waterWave,.001);\n      vec2 q=H.xz;\n      float wt=uTime*waterSpeed;   \n      float n0=vnoise3(vec3(q*ws+vec2(wt*.09,0.),wt*.06));\n      float nx=vnoise3(vec3((q+vec2(e,0.))*ws+vec2(wt*.09,0.),wt*.06));\n      float nz=vnoise3(vec3((q+vec2(0.,e))*ws+vec2(wt*.09,0.),wt*.06));\n      float m0=vnoise3(vec3(q*ws*3.1+vec2(0.,wt*.17),wt*.12));\n      float mx=vnoise3(vec3((q+vec2(e,0.))*ws*3.1+vec2(0.,wt*.17),wt*.12));\n      float mz=vnoise3(vec3((q+vec2(0.,e))*ws*3.1+vec2(0.,wt*.17),wt*.12));\n      vec2 grad=vec2((nx-n0)+(mx-m0)*.45,(nz-n0)+(mz-m0)*.45)/e;\n      float amp=reflRealRipple*atten*2.2;\n      vec3 N=normalize(vec3(-grad.x*amp,1.,-grad.y*amp));\n      vec3 body=c*waterCol*(1.-waterDark);                         \n      vec3 rd=reflect(dir,N); rd.y=abs(rd.y);                      \n      vec3 skyR=skyUpper(rd,asin(clamp(rd.y,-1.,1.)),atan(rd.x,-rd.z));\n      float fres=mix(.10,1.,pow(1.-clamp(dot(N,-dir),0.,1.),5.))*waterFres;\n      vec3 w=mix(body,mix(body,skyR,.92),clamp(fres,0.,1.));\n      vec3 Hd=H+vec3(N.x,0.,N.z)*(reflRealRipple*atten*t*.10);     \n      vec4 cp=uReflVP*vec4(Hd,1.);\n      if(cp.w>1e-4){\n        vec2 ruv=cp.xy/cp.w*.5+.5,ed=min(ruv,1.-ruv);\n        float inside=smoothstep(0.,.02,min(ed.x,ed.y));            \n        vec3 rc=texture2D(tRefl,clamp(ruv,vec2(.001),vec2(.999))).rgb;\n        float amt=inside*exp(-t*reflRealFade);\n        w=1.-(1.-w)*(1.-clamp(rc*reflRealGain,0.,1.)*amt);\n      }\n      w+=sunCol*(pow(max(dot(rd,sunDir),0.),220.)*waterSpark*atten);  \n      \n      \n      \n      \n      if(footRing>.001){\n        float rr=length(H.xz-uTreeXZ);\n        float w0=sin((rr/max(footSize,.05)-uTime*footSpeed)*6.28318)*.5+.5;\n        float ring=smoothstep(.30,1.,w0)*.7+w0*.3;\n        float env=exp(-rr/max(footSpread,.1))*smoothstep(.10,.60,rr);\n        w+=waterCol*(ring*env*footRing*.26*atten);\n      }\n      \n      \n      if(splashA>.001){\n        for(int k=0;k<6;k++){\n          vec4 sp=uSplash[k];\n          if(sp.w<.5)continue;\n          float age=uTime-sp.z;\n          if(age<0.||age>splashLife)continue;\n          float rr=length(H.xz-sp.xy),rad=age*splashSpeed;\n          float ring2=exp(-pow((rr-rad)/max(splashW,.02),2.));\n          float fade=1.-age/max(splashLife,.05);\n          w+=waterCol*(ring2*fade*fade*splashA*atten);\n        }\n      }\n      \n      float wf=smoothstep(0.,.035,-dir.y)*reflReal*(1.-solid);\n      c=mix(c,w,clamp(wf,0.,1.));\n    }\n  }\n  \n  if(seaMist>0.){float vH=uSkyPano>.5?(-panoBottom)/max(panoTop-panoBottom,.01):(-imgEl)/max(imgSpan/uSkyAspect,.01)+.5;\n    vec3 mc=uSkyOn>.5?texture2D(tSkyAvg,vec2(.5,clamp(vH,.01,.99))).rgb*imgGain:mix(horizonCol,skyBot,.5);\n    c=mix(c,mc,exp(-pow(elS/max(seaMistW,.001),2.))*seaMist);}\n  return c;}\nvoid main(){\n  if(uReflDbgView>.5){gl_FragColor=vec4(texture2D(tRefl,vUv).rgb,1.);return;}   \n  vec4 v=uInvProj*vec4(vUv*2.-1.,1.,1.);vec3 dir=normalize((uCamWorld*vec4(v.xyz/v.w,0.)).xyz);\n  vec3 d=texture2D(tDiffuse,vUv).rgb;\n  \n  \n  float solid=smoothstep(.12,.42,max(max(d.r,d.g),d.b));\n  \n  \n  if(seaMelt>0.){float below=-asin(clamp(dir.y,-1.,1.));\n    if(below>0.)d*=mix(mix(1.,smoothstep(0.,max(seaMeltW,.0005),below),seaMelt),1.,solid);}\n  float l=max(max(d.r,d.g),d.b);\n  vec3 sk=skyAt(dir,solid);\n  vec3 inkC=mix(d/max(l,.0001)*inkDark,ink,inkTint);\n  vec3 inked=mix(sk,inkC,smoothstep(inkLo,inkHi,l)*inkA);\n  vec3 glowed=1.-(1.-sk)*(1.-clamp(d*glowGain,0.,1.));\n  vec3 c=mix(inked,glowed,glowMix);\n  c=mix(c,glintCol,smoothstep(.78,1.,l)*glint);\n  \n  float km=texture2D(tMask,vUv).r;\n  km=min(km,min(min(texture2D(tMask,vUv+vec2(uMaskTexel.x,0.)).r,texture2D(tMask,vUv-vec2(uMaskTexel.x,0.)).r),min(texture2D(tMask,vUv+vec2(0.,uMaskTexel.y)).r,texture2D(tMask,vUv-vec2(0.,uMaskTexel.y)).r)));\n  km=min(km,min(min(texture2D(tMask,vUv+uMaskTexel*vec2(.7,.7)).r,texture2D(tMask,vUv+uMaskTexel*vec2(-.7,.7)).r),min(texture2D(tMask,vUv+uMaskTexel*vec2(.7,-.7)).r,texture2D(tMask,vUv+uMaskTexel*vec2(-.7,-.7)).r)));\n  c=mix(c,d,smoothstep(.15,.95,km)*clawdKeep);\n  gl_FragColor=vec4(c,1.);}`
});
daylightPass.uniforms.tMask.value = clawdMaskRT.texture;
daylightPass.uniforms.tRefl.value = reflRT.texture;
daylightPass.uniforms.uSplash.value = splashBuf;
let dayOn = DAYLIGHT || (() => {
    try {
        return localStorage.getItem("memoryTreeDaylightOn") === "1";
    } catch (e) {
        return false;
    }
})();
daylightPass.enabled = dayOn;
composer.addPass(daylightPass);
{
    const origRender = daylightPass.render.bind(daylightPass);
    daylightPass.render = (r, w, rb, dt, mask) => {
        camera.updateMatrixWorld();
        daylightPass.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
        daylightPass.uniforms.uCamWorld.value.copy(camera.matrixWorld);
        origRender(r, w, rb, dt, mask);
    };
}
let dayState = (() => {
    let v = {};
    try {
        v = JSON.parse(localStorage.getItem("memoryTreeDaylight") || "{}");
    } catch (e) {}
    return {
        ...DAY_BASE,
        ...DAY_PRESETS[v.preset] || DAY_PRESETS.pink,
        ...v
    };
})();
const DAY_DEG = new Set([ "skyLow", "skyHigh", "hazeEl", "mistTop", "auroraEl", "auroraV", "auroraAz", "cloudTop", "coolW", "reflFade", "imgAz", "imgSpan", "imgEl", "imgFeather", "panoTop", "panoBottom", "seamBlend", "seaEl", "seaMistW", "seaMeltW", "moonR" ]);
const dayDir = (az, el) => {
    const a = az * Math.PI / 180, e = el * Math.PI / 180;
    return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
};
function dayApply() {
    const u = daylightPass.uniforms;
    for (const [k, , t] of DAY_KEYS) {
        const v = dayState[k];
        if (!u[k]) continue;
        if (t === "c") {
            u[k].value.copy(hex3(v));
            continue;
        }
        u[k].value = DAY_DEG.has(k) ? +v * Math.PI / 180 : +v;
    }
    u.uSkyPano.value = +dayState.skyPano || 0;
    {
        const span = Math.max(1, +dayState.panoTop - +dayState.panoBottom), asp = u.uSkyAspect.value || 2, raw = 360 / (asp * span);
        let n = +dayState.panoRepeat || (raw >= 1.6 ? Math.round(raw) : 1);
        if (n > 1 && n % 2) n += 1;
        u.uPanoRepeat.value = n;
        const gu = galaxyMaterial.uniforms;
        for (const k of [ "uSkyPano", "uSkyAspect", "uPanoRepeat", "imgAz", "imgSpan", "imgEl", "imgFeather", "panoTop", "panoBottom", "seaEl", "imgGain", "imgKeep" ]) gu[k].value = u[k].value;
        const tx = u.tSky.value, ws = n > 1 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
        if (tx && tx.wrapS !== ws) {
            tx.wrapS = ws;
            tx.needsUpdate = true;
        }
    }
    u.sunDir.value.copy(dayDir(+dayState.sunAz, +dayState.sunEl));
    u.moonDir.value.copy(dayDir(+dayState.moonAz, +dayState.moonEl));
    reflWaterY = +dayState.waterY;
    reflStrength = +dayState.reflReal;
    u.uWaterY.value = reflWaterY;
    try {
        if (wardrobePearl) wardrobePearl.state._endSoft = +dayState.riverEnd || 0;
    } catch (e) {}
}
function daySave() {
    try {
        localStorage.setItem("memoryTreeDaylight", JSON.stringify(dayState));
    } catch (e) {}
}
function daySetOn(on) {
    dayOn = !!on;
    daylightPass.enabled = dayOn;
    try {
        if (!dayOn && wardrobePearl) wardrobePearl.state._endSoft = 0;
    } catch (e) {}
    try {
        localStorage.setItem("memoryTreeDaylightOn", dayOn ? "1" : "0");
    } catch (e) {}
    document.body.classList.toggle("daylight", dayOn);
    if (!dayOn) {
        try {
            applyColorTune();
        } catch (e) {}
        galaxySky.visible = ringTune.galaxyOn !== false;
    }
}
window.__daylightFrame = t => {
    if (!dayOn) return;
    daylightPass.uniforms.uTime.value = (t || 0) * .001;
    daylightPass.uniforms.footRing.value = archiveLayoutMode === "river" && pearlEnabled ? 0 : +dayState.footRing || 0;
    if (wardrobePearl) wardrobePearl.state._endSoft = +dayState.riverEnd || 0;
    if (!(scene.background && scene.background.isColor)) scene.background = new THREE.Color(0, 0, 0);
    scene.background.setRGB(0, 0, 0);
    if (scene.fog) scene.fog.color.setRGB(0, 0, 0);
    galaxySky.visible = false;
    daylightPass.uniforms.uAspect.value = innerWidth / Math.max(1, innerHeight);
};
const dayIDB = (mode, fn) => new Promise((res, rej) => {
    const rq = indexedDB.open("memoryTreeDaylight", 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore("kv");
    rq.onerror = () => rej(rq.error);
    rq.onsuccess = () => {
        const db = rq.result, tx = db.transaction("kv", mode);
        let r;
        try {
            r = fn(tx.objectStore("kv"));
        } catch (e) {
            db.close();
            rej(e);
            return;
        }
        tx.oncomplete = () => {
            db.close();
            res(r && r.result);
        };
        tx.onabort = tx.onerror = () => {
            db.close();
            rej(tx.error || new Error("图片保存失败"));
        };
    };
});
async function daySkyFromBlob(blob) {
    const url = URL.createObjectURL(blob), img = new Image;
    try {
        img.src = url;
        await img.decode();
    } catch (e) {
        URL.revokeObjectURL(url);
        throw e;
    }
    const W = img.naturalWidth, H = img.naturalHeight, cap = Math.min(4096, renderer.capabilities.maxTextureSize || 4096), k = Math.min(1, cap / Math.max(W, H));
    let src = img;
    if (k < 1) {
        const cv = document.createElement("canvas");
        cv.width = Math.round(W * k);
        cv.height = Math.round(H * k);
        const g = cv.getContext("2d");
        g.imageSmoothingQuality = "high";
        g.drawImage(img, 0, 0, cv.width, cv.height);
        src = cv;
    }
    const a = document.createElement("canvas");
    a.width = 32;
    a.height = 64;
    const ag = a.getContext("2d", {
        willReadFrequently: true
    });
    ag.imageSmoothingQuality = "high";
    ag.drawImage(src, 0, 0, 32, 64);
    const px = ag.getImageData(0, 0, 32, 64).data, row = new Uint8Array(64 * 4);
    for (let y = 0; y < 64; y++) {
        let r = 0, gg = 0, b = 0;
        for (let x = 0; x < 32; x++) {
            const i = (y * 32 + x) * 4;
            r += px[i];
            gg += px[i + 1];
            b += px[i + 2];
        }
        const o = (63 - y) * 4;
        row[o] = r / 32;
        row[o + 1] = gg / 32;
        row[o + 2] = b / 32;
        row[o + 3] = 255;
    }
    const avg = new THREE.DataTexture(row, 1, 64);
    avg.magFilter = avg.minFilter = THREE.LinearFilter;
    avg.needsUpdate = true;
    const tex = new THREE.Texture(src);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.needsUpdate = true;
    const u = daylightPass.uniforms;
    if (u.tSky.value) u.tSky.value.dispose();
    if (u.tSkyAvg.value) u.tSkyAvg.value.dispose();
    u.tSky.value = tex;
    u.tSkyAvg.value = avg;
    u.uSkyOn.value = 1;
    galaxyMaterial.uniforms.tSky.value = tex;
    galaxyMaterial.uniforms.tSkyAvg.value = avg;
    galaxyMaterial.uniforms.uSkyOn.value = 1;
    u.uSkyAspect.value = (src.width || W) / (src.height || H);
    URL.revokeObjectURL(url);
    try {
        dayApply();
    } catch (e) {}
    return {
        w: W,
        h: H,
        gpu: [ src.width || W, src.height || H ]
    };
}
{
    const g = document.createElement("details");
    g.className = "pg pg-sub";
    g.dataset.group = "daylight";
    g.innerHTML = '<summary>天色 · 预设与调色</summary><div class="pg-body"></div>';
    try {
        const v = localStorage.getItem("memoryTreePanelGroupV2_daylight");
        g.open = DAYLIGHT || v === "1";
    } catch (e) {
        g.open = DAYLIGHT;
    }
    g.addEventListener("toggle", () => {
        try {
            localStorage.setItem("memoryTreePanelGroupV2_daylight", g.open ? "1" : "0");
        } catch (e) {}
    });
    const b = g.querySelector(".pg-body");
    const fillDay = () => b.querySelectorAll("[data-day]").forEach(i => {
        const k = i.dataset.day;
        i.value = dayState[k];
        const o = i.nextElementSibling;
        if (o && i.type === "range") o.value = (+dayState[k]).toFixed(2);
    });
    const markDay = () => b.querySelectorAll("[data-day-preset]").forEach(x => x.classList.toggle("on", x.dataset.dayPreset === "night" ? !dayOn : dayOn && dayState.preset === x.dataset.dayPreset));
    const row = document.createElement("div");
    row.className = "pg-row";
    [ [ "pink", "粉雾虚空" ], [ "aurora", "极光之境" ], [ "night", "原来的夜空" ] ].forEach(([k, t]) => {
        const x = document.createElement("button");
        x.type = "button";
        x.className = "ring-btn tune-toggle";
        x.dataset.dayPreset = k;
        x.textContent = t;
        x.onclick = () => {
            if (k === "night") daySetOn(false); else {
                dayState = {
                    ...DAY_PRESETS[k],
                    ...dayKeepImg()
                };
                daySave();
                dayApply();
                fillDay();
                daySetOn(true);
            }
            markDay();
        };
        row.appendChild(x);
    });
    b.appendChild(row);
    const secOf = new Map;
    DAY_SECTIONS.forEach(([t, keys]) => keys.forEach(k => secOf.set(k, t)));
    const bins = new Map;
    DAY_SECTIONS.forEach(([t]) => bins.set(t, []));
    bins.set("其他", []);
    for (const row of DAY_KEYS) bins.get(secOf.get(row[0]) || "其他").push(row);
    const mkRow = ([k, label, lo, hi, st]) => {
        const l = document.createElement("label"), inp = document.createElement("input"), out = document.createElement("output");
        inp.dataset.day = k;
        if (lo === "c") inp.type = "color"; else {
            inp.type = "range";
            inp.min = lo;
            inp.max = hi;
            inp.step = st;
        }
        l.append(label, inp, out);
        inp.oninput = () => {
            dayState[k] = lo === "c" ? inp.value : +inp.value;
            if (lo !== "c") out.value = (+inp.value).toFixed(2);
            dayApply();
            daySave();
        };
        return l;
    };
    for (const [title, rows] of bins) {
        if (!rows.length) continue;
        const d = document.createElement("details");
        d.className = "pg pg-sub";
        d.dataset.daySec = title;
        d.innerHTML = "<summary>" + title + '</summary><div class="pg-body"><div class="pg-tune"></div></div>';
        try {
            d.open = localStorage.getItem("memoryTreeDaySec_" + title) === "1" || title === "常用" && localStorage.getItem("memoryTreeDaySec_常用") === null;
        } catch (e) {
            d.open = title === "常用";
        }
        d.addEventListener("toggle", () => {
            try {
                localStorage.setItem("memoryTreeDaySec_" + title, d.open ? "1" : "0");
            } catch (e) {}
        });
        const t = d.querySelector(".pg-tune");
        rows.forEach(r => t.appendChild(mkRow(r)));
        b.appendChild(d);
    }
    const skyShelf = document.createElement("section");
    skyShelf.className = "sky-shelf";
    skyShelf.setAttribute("aria-label", "我的天空图片");
    const shelfTitle = document.createElement("strong");
    shelfTitle.textContent = "我的天空图片";
    const imgRow = document.createElement("div");
    imgRow.className = "pg-row";
    const gallery = document.createElement("div");
    gallery.className = "sky-gallery";
    const skyStatus = document.createElement("small");
    skyStatus.setAttribute("role", "status");
    skyStatus.textContent = "正在读取已保存的图片…";
    const undoBtn = document.createElement("button");
    undoBtn.type = "button";
    undoBtn.className = "ring-btn";
    undoBtn.textContent = "撤销删除";
    undoBtn.hidden = true;
    skyShelf.append(shelfTitle, imgRow, gallery, skyStatus, undoBtn);
    row.after(skyShelf);
    let library = {
        items: [],
        activeId: null
    }, deletedSky = null, thumbURLs = [], skyBusy = true, failedSkyId = null;
    const skyOff = () => {
        daylightPass.uniforms.uSkyOn.value = 0;
        galaxyMaterial.uniforms.uSkyOn.value = 0;
    };
    const saveLibrary = next => dayIDB("readwrite", st => {
        st.put(next, "skyLibrary");
    });
    const renderShelf = () => {
        thumbURLs.forEach(URL.revokeObjectURL);
        thumbURLs = [];
        gallery.replaceChildren();
        for (const item of library.items) {
            const card = document.createElement("div");
            card.className = "sky-card";
            const choose = document.createElement("button");
            choose.type = "button";
            choose.className = "sky-choice";
            choose.setAttribute("aria-label", "使用天空图：" + item.name);
            choose.setAttribute("aria-pressed", String(item.id === library.activeId));
            const img = document.createElement("img");
            img.alt = "";
            img.loading = "lazy";
            const url = URL.createObjectURL(item.blob);
            thumbURLs.push(url);
            img.src = url;
            img.onerror = () => {
                img.style.display = "none";
                state.textContent = "图片需重新添加";
            };
            const name = document.createElement("span");
            name.textContent = item.name;
            const state = document.createElement("small");
            state.textContent = item.id === failedSkyId ? "图片需重新添加" : item.id === library.activeId ? "正在使用" : "点击切换";
            choose.append(img, name, state);
            choose.onclick = () => runSky(async () => {
                await daySkyFromBlob(item.blob);
                failedSkyId = null;
                const next = {
                    ...library,
                    activeId: item.id
                };
                await saveLibrary(next);
                library = next;
            });
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "sky-delete";
            remove.textContent = "删除";
            remove.setAttribute("aria-label", "删除天空图：" + item.name);
            remove.onclick = () => runSky(async () => {
                const wasActive = library.activeId === item.id, next = {
                    items: library.items.filter(i => i.id !== item.id),
                    activeId: wasActive ? null : library.activeId
                };
                await saveLibrary(next);
                deletedSky = {
                    item: item,
                    index: library.items.indexOf(item),
                    wasActive: wasActive
                };
                library = next;
                if (wasActive) skyOff();
            });
            card.append(choose, remove);
            gallery.append(card);
        }
        shelfTitle.textContent = "我的天空图片" + (library.items.length ? " · " + library.items.length : "");
        skyStatus.textContent = library.items.length ? library.activeId ? "点缩略图切换；图片保存在这台设备的浏览器中。" : "当前不用图片，收藏仍保留。" : "添加喜欢的天空图，可以多选；以后点缩略图就能切换。";
        undoBtn.hidden = !deletedSky;
        skyShelf.querySelectorAll("button").forEach(x => x.disabled = skyBusy);
    };
    const restoreSky = async () => {
        const item = library.items.find(i => i.id === library.activeId);
        if (item) await daySkyFromBlob(item.blob); else skyOff();
    };
    async function runSky(fn) {
        if (skyBusy) return;
        skyBusy = true;
        skyShelf.querySelectorAll("button").forEach(x => x.disabled = true);
        try {
            await fn();
            renderShelf();
        } catch (e) {
            try {
                await restoreSky();
            } catch (_) {}
            skyStatus.textContent = e.name === "NotFoundError" || e.name === "EncodingError" ? "这张图片在浏览器中已无法读取，请重新添加原文件。" : "图片未保存成功：" + (e.name === "QuotaExceededError" ? "浏览器空间不足，请删除不用的图片后重试。" : "请重试或换一张图片。");
            console.warn("sky library", e);
        } finally {
            skyBusy = false;
            skyShelf.querySelectorAll("button").forEach(x => x.disabled = false);
        }
    }
    undoBtn.onclick = () => runSky(async () => {
        if (!deletedSky) return;
        const {item: item, index: index, wasActive: wasActive} = deletedSky, items = [ ...library.items ];
        items.splice(index, 0, item);
        const next = {
            items: items,
            activeId: wasActive ? item.id : library.activeId
        };
        if (wasActive) await daySkyFromBlob(item.blob);
        await saveLibrary(next);
        library = next;
        deletedSky = null;
    });
    const pick = document.createElement("input");
    pick.type = "file";
    pick.accept = "image/*";
    pick.multiple = true;
    pick.hidden = true;
    pick.id = "daySkyPick";
    pick.onchange = () => {
        const files = [ ...pick.files ];
        pick.value = "";
        if (!files.length) return;
        runSky(async () => {
            const items = [ ...library.items ];
            let last = null;
            for (const f of files) {
                const url = URL.createObjectURL(f);
                try {
                    const img = new Image;
                    img.src = url;
                    await img.decode();
                } finally {
                    URL.revokeObjectURL(url);
                }
                const repair = items.findIndex(i => i.id === failedSkyId && i.name === f.name && i.blob?.size === f.size);
                last = {
                    id: repair >= 0 ? items[repair].id : crypto.randomUUID(),
                    name: f.name || "天空图片",
                    blob: f,
                    createdAt: Date.now()
                };
                if (repair >= 0) {
                    items[repair] = last;
                    failedSkyId = null;
                } else items.push(last);
            }
            await daySkyFromBlob(last.blob);
            const next = {
                items: items,
                activeId: last.id
            };
            await saveLibrary(next);
            library = next;
            if (!dayState.skyPano) {
                dayState.skyPano = 1;
                panoBtn.textContent = "360°全景：开";
                dayApply();
                daySave();
            }
        });
    };
    const mkB = (t, fn) => {
        const x = document.createElement("button");
        x.type = "button";
        x.className = "ring-btn tune-toggle";
        x.textContent = t;
        x.onclick = () => fn(x);
        return x;
    };
    imgRow.append(pick, mkB("＋ 添加天空图片", () => pick.click()), mkB("不用图片", () => runSky(async () => {
        const next = {
            ...library,
            activeId: null
        };
        await saveLibrary(next);
        library = next;
        skyOff();
    })));
    const panoRow = document.createElement("div");
    panoRow.className = "pg-row";
    const panoBtn = mkB(dayState.skyPano ? "360°全景：开" : "360°全景：关", x => {
        dayState.skyPano = dayState.skyPano ? 0 : 1;
        x.textContent = dayState.skyPano ? "360°全景：开" : "360°全景：关";
        dayApply();
        daySave();
    });
    panoRow.append(panoBtn, mkB("复制参数", async x => {
        const txt = JSON.stringify(dayState, null, 1);
        try {
            await navigator.clipboard.writeText(txt);
            x.textContent = "已复制✓";
            setTimeout(() => x.textContent = "复制参数", 1500);
        } catch (e) {
            prompt("复制参数", txt);
        }
    }));
    b.appendChild(panoRow);
    skyShelf.querySelectorAll("button").forEach(x => x.disabled = true);
    const loadSkyLibrary = async () => {
        try {
            const saved = await dayIDB("readonly", st => st.get("skyLibrary"));
            if (saved && Array.isArray(saved.items)) library = saved; else {
                let blob = await dayIDB("readonly", st => st.get("sky"));
                const old = localStorage.getItem("memoryTreeDaylightSky");
                if (!blob && old) blob = await fetch(old).then(r => r.blob());
                if (blob) {
                    const id = crypto.randomUUID();
                    library = {
                        items: [ {
                            id: id,
                            name: blob.name || "之前导入的天空",
                            blob: blob,
                            createdAt: Date.now()
                        } ],
                        activeId: id
                    };
                    await saveLibrary(library);
                }
            }
            try {
                await restoreSky();
            } catch (e) {
                failedSkyId = library.activeId;
                skyOff();
                console.warn("sky library image", e);
            }
            skyBusy = false;
            renderShelf();
            if (failedSkyId) skyStatus.textContent = "之前的图片记录还在，但浏览器已无法读取文件。请重新添加原图。";
        } catch (e) {
            skyBusy = false;
            renderShelf();
            skyStatus.textContent = "天空图片记录读取失败；仍可添加新图。";
            console.warn("sky library load", e);
        }
    };
    const wRow = document.createElement("div");
    wRow.className = "pg-row";
    const wBtn = mkB("💧 水面倒影：关", x => {
        const on = !(+dayState.reflReal > .001);
        dayState.reflReal = on ? .9 : 0;
        if (on && !(+dayState.waterDark > 0)) dayState.waterDark = .22;
        if (on && !(+dayState.seaMelt > 0)) {
            dayState.seaMelt = .7;
            dayState.seaMeltW = 4;
        }
        if (on && !(+dayState.riverEnd > 0)) dayState.riverEnd = .75;
        if (on && !(+dayState.footRing > 0)) dayState.footRing = .32;
        if (!on) {
            dayState.seaMelt = 0;
            dayState.riverEnd = 0;
            dayState.footRing = 0;
        }
        x.textContent = on ? "💧 水面倒影：开" : "💧 水面倒影：关";
        x.classList.toggle("on", on);
        dayApply();
        daySave();
        fillDay();
    });
    const wFit = mkB("水面对齐树根", () => {
        let y = -2.5;
        try {
            if (active) y = +((new THREE.Box3).setFromObject(active).min.y + .02).toFixed(2);
        } catch (e) {}
        dayState.waterY = y;
        dayApply();
        daySave();
        fillDay();
        try {
            showLifeToast("水面放到 " + y + " 了");
        } catch (e) {}
    });
    wRow.append(wBtn, wFit);
    b.appendChild(wRow);
    const syncWBtn = () => {
        const on = +dayState.reflReal > .001;
        wBtn.textContent = on ? "💧 水面倒影：开" : "💧 水面倒影：关";
        wBtn.classList.toggle("on", on);
    };
    syncWBtn();
    const tip = document.createElement("small");
    tip.className = "pg-tip";
    tip.textContent = "选一个天色；「原来的夜空」也能使用导入的天空图；“天空图显出来”在夜空里是原星空与图片的混合，0 是原星空，1 是图片最明显。发灰发糊就去「星空 › 光与雾」把辉光调低。天空图只存在这台设备上。水面倒影是真的把树和河再渲一遍映下去——好看但费手机，卡就关掉。";
    b.appendChild(tip);
    treeSidePanel.querySelector(".pg[data-group=sky] .pg-body").appendChild(g);
    fillDay();
    dayApply();
    daySetOn(dayOn);
    markDay();
    loadSkyLibrary();
}
window.__daylight = {
    pass: daylightPass,
    state: () => dayState,
    on: () => dayOn,
    set: (k, v) => {
        dayState[k] = v;
        dayApply();
    },
    preset: k => {
        dayState = {
            ...DAY_PRESETS[k],
            ...dayKeepImg()
        };
        dayApply();
        daySetOn(true);
    },
    skyFromBlob: daySkyFromBlob
};
const CLAWD_LAYER = 3, clawdMaskMat = new THREE.MeshBasicMaterial({
    color: 16777215,
    fog: false
}), clawdPrevClear = new THREE.Color;
let clawdLayerTick = 0, clawdMaskDirty = false, clawdMaskObj = null;
window.__clawdBloom = {
    pass: clawdCompositePass,
    maskRT: clawdMaskRT,
    renderer: renderer,
    fillMask(v) {
        renderer.setRenderTarget(clawdMaskRT);
        renderer.setClearColor(v ? 16777215 : 0, 1);
        renderer.clear(true, true, true);
        renderer.setRenderTarget(null);
    },
    maskPixels() {
        const w = clawdMaskRT.width, h = clawdMaskRT.height, buf = new Uint8Array(w * h * 4);
        renderer.readRenderTargetPixels(clawdMaskRT, 0, 0, w, h, buf);
        let n = 0;
        for (let i = 0; i < buf.length; i += 4) if (buf[i] > 128) n++;
        return {
            w: w,
            h: h,
            lit: n
        };
    }
};
function renderClawdMask() {
    if (window.__clawdBloom && window.__clawdBloom.freeze) return;
    clawdCompositePass.uniforms.uAmt.value = 1 - clawdGlowIn;
    daylightPass.uniforms.uMaskTexel.value.set(1 / Math.max(1, clawdMaskRT.width), 1 / Math.max(1, clawdMaskRT.height));
    clawdCompositePass.uniforms.uBright.value = clawdBright;
    clawdMaskObj = clawdMaskObj || scene.getObjectByName("tree-clawd");
    const show = clawdMaskObj && parentsVisible(clawdMaskObj);
    if (!show && !clawdMaskDirty) return;
    const prevMask = camera.layers.mask, prevOverride = scene.overrideMaterial, prevBg = scene.background, prevAlpha = renderer.getClearAlpha();
    renderer.getClearColor(clawdPrevClear);
    renderer.setRenderTarget(clawdMaskRT);
    renderer.setClearColor(0, 1);
    renderer.clear(true, true, true);
    if (show) {
        if (clawdLayerTick++ % 30 === 0) clawdMaskObj.traverse(o => o.layers.enable(CLAWD_LAYER));
        camera.layers.set(CLAWD_LAYER);
        scene.overrideMaterial = clawdMaskMat;
        scene.background = null;
        renderer.render(scene, camera);
    }
    clawdMaskDirty = !!show;
    renderer.setRenderTarget(null);
    camera.layers.mask = prevMask;
    scene.overrideMaterial = prevOverride;
    scene.background = prevBg;
    renderer.setClearColor(clawdPrevClear, prevAlpha);
}
(function breatheArchiveStars(t) {
    requestAnimationFrame(breatheArchiveStars);
    if (window.__daylightFrame) window.__daylightFrame(t);
    galaxyMaterial.uniforms.uTime.value = t * .001;
    riverMistMaterial.uniforms.uTime.value = t * .001;
    if (archivePointMaterial?.uniforms?.uTime) {
        archivePointMaterial.uniforms.uTime.value = t * .001 * (+ringTune.twinkleSpeed || 1);
        archivePointMaterial.uniforms.uPulseAge.value = archivePulseBorn ? (performance.now() - archivePulseBorn) / 1e3 : 99;
    }
})();
(function loop(t) {
    requestAnimationFrame(loop);
    controls.update();
    if (wardrobePearl) {
        syncWardrobePearl();
        wardrobePearl.update();
    }
    const _rs = +ringTune.ringSpeed || 1, _rp = t * 18e-5 * _rs, _tx = +ringTune.tiltX, _tz = +ringTune.tiltZ;
    ring.rotation.set(_tx + Math.sin(_rp * .73) * .024, Math.sin(_rp) * .22, _tz + Math.cos(_rp * .61) * .018);
    ring2.rotation.set(-_tx * .72 + Math.sin(_rp * .67 + 1.4) * .018, .38 - Math.sin(_rp * .86) * .17, _tz + .72 + Math.cos(_rp * .58 + .8) * .015);
    updateRingStreams(t * .001);
    if (riverFilaMat) riverFilaMat.uniforms.uTime.value = t * .001;
    const archiveGroup = memoryFormGroups.archive, now = performance.now();
    if (archiveGroup) {
        if (!archiveOrbitPaused) archiveOrbitAngle += 2e-4;
        if (archiveLayoutMode === "waterfall" || archiveLayoutMode === "river") {
            archiveGroup.position.set(0, 0, 0);
            archiveGroup.scale.set(1, 1, 1);
            archiveGroup.quaternion.setFromAxisAngle(YAW_AXIS, archiveLayoutMode === "river" ? (+yawTune.river || 0) * Math.PI / 180 : 0);
            ring.visible = archiveLayoutMode === "waterfall";
            ring2.visible = archiveLayoutMode === "waterfall" && ringTune.mode === "double";
        } else {
            ring.visible = true;
            ring2.visible = ringTune.mode === "double";
            archiveGroup.position.copy(ring.position);
            archiveGroup.scale.copy(ring.scale);
            archiveGroup.quaternion.copy(ring.quaternion);
        }
        if (archivePointCloud) {
            const age = (now - archiveEnterBorn) / 1e3, raw = Math.max(0, Math.min(1, (age - .12) / .82)), reveal = raw * raw * (3 - 2 * raw), pa = archivePointCloud.geometry.attributes.position, angles = archivePointCloud.userData.angles, ys = archivePointCloud.userData.ys, radii = archivePointCloud.userData.radii, rounds = archivePointCloud.userData.rounds, doubleArchive = archiveLayoutMode === "ring" && ringTune.mode === "double";
            archivePointMaterial.uniforms.uReveal.value = reveal;
            if (doubleArchive) {
                archiveGroup.updateMatrixWorld(true);
                ring2.updateMatrixWorld(true);
                archiveSecondMatrix.copy(archiveGroup.matrixWorld).invert().multiply(ring2.matrixWorld);
            }
            if (archiveLayoutMode === "river") {} else if (archiveLayoutMode === "waterfall") {
                const bx = archivePointCloud.userData.baseX, by = archivePointCloud.userData.baseY, bz = archivePointCloud.userData.baseZ, kinds = archivePointCloud.userData.flowKinds, offsets = archivePointCloud.userData.flowOffsets, targets = archivePointCloud.userData.flowTargets, prevP = archivePointCloud.userData.flowPrevP, flowSpeed = +ringTune.flowSpeed || 1, doubleWaterfall = ringTune.mode === "double";
                ring.updateMatrixWorld(true);
                if (doubleWaterfall) ring2.updateMatrixWorld(true);
                for (let i = 0; i < bx.length; i++) {
                    if (kinds[i] === 2) {
                        const wave = Math.sin(t * 22e-5 + i * .17) * .008;
                        pa.setXYZ(i, bx[i] + wave, by[i], bz[i]);
                        continue;
                    }
                    const sourceRing = doubleWaterfall && i & 1 ? ring2 : ring;
                    archiveTmpPoint.set(bx[i], by[i], bz[i]).applyMatrix4(sourceRing.matrixWorld);
                    if (kinds[i] === 0) {
                        pa.setXYZ(i, archiveTmpPoint.x, archiveTmpPoint.y, archiveTmpPoint.z);
                        continue;
                    }
                    const p = (t * 34e-6 * flowSpeed + offsets[i]) % 1, e = p * p * (3 - 2 * p), open = Math.sin(p * Math.PI), swayX = Math.sin(p * Math.PI * 2 + i * .37) * (.022 + .09 * open), swayZ = Math.cos(p * Math.PI * 1.72 + i * .29) * (.016 + .068 * open), rootPull = (.055 + i % 5 * .018) * e;
                    const _fx = archiveTmpPoint.x * (1 - rootPull) + sourceRing.position.x * rootPull + swayX, _fy = archiveTmpPoint.y + (targets[i] - archiveTmpPoint.y) * e, _fz = archiveTmpPoint.z * (1 - rootPull) + swayZ;
                    pa.setXYZ(i, _fx, _fy, _fz);
                    if (prevP) {
                        if (kinds[i] === 1 && p < prevP[i] - .5) registerSplash(_fx, _fz);
                        prevP[i] = p;
                    }
                }
            } else for (let i = 0; i < angles.length; i++) {
                const a = angles[i] + archiveOrbitAngle, r = radii[i], x = Math.cos(a) * r, y = ys[i], z = Math.sin(a) * r * rounds[i];
                if (doubleArchive && i & 1) {
                    archiveTmpPoint.set(x, y, z).applyMatrix4(archiveSecondMatrix);
                    pa.setXYZ(i, archiveTmpPoint.x, archiveTmpPoint.y, archiveTmpPoint.z);
                } else pa.setXYZ(i, x, y, z);
            }
            pa.needsUpdate = true;
        }
    }
    for (const v of lifecycleVisuals) {
        const age = (now - v.born) / 1e3 - v.delay;
        if (age < 0) continue;
        const duration = v.type === "fruit" || v.type === "fruitCore" ? 1.05 : .78, k = Math.min(1, age / duration), ease = 1 - Math.pow(1 - k, 3), overshoot = k < .78 ? ease : 1 + Math.sin((k - .78) / .22 * Math.PI) * .07;
        v.mesh.position.lerpVectors(v.from, v.basePos, ease);
        v.mesh.scale.copy(v.baseScale).multiplyScalar(Math.max(.001, overshoot));
        if (k >= 1) {
            const breathe = 1 + Math.sin(t * .0022 + v.delay * 5) * (v.type === "seed" ? .055 : v.type === "fruitCore" ? .045 : .018);
            v.mesh.scale.copy(v.baseScale).multiplyScalar(breathe);
        }
    }
    for (let i = blossomEffects.length - 1; i >= 0; i--) {
        const b = blossomEffects[i], age = (now - b.born) / 1e3, k = Math.min(1, age / .34);
        b.group.scale.setScalar(.08 + k * 1.18);
        b.group.rotation.z += age < .7 ? .012 : .003;
        if (age > .72) {
            const fall = age - .72;
            b.group.children.forEach(p => {
                const f = p.userData.fall;
                if (!f) return;
                p.position.x = f.vx * fall;
                p.position.y = f.vy * fall - .34 * fall * fall;
                p.rotation.z += f.spin * .018;
            });
            b.mat.opacity = Math.max(0, .92 - fall * .88);
            b.heart.material.opacity = Math.max(0, .96 - fall * 1.45);
        }
        if (age > 1.78) {
            scene.remove(b.group);
            b.geo.dispose();
            b.mat.dispose();
            b.heart.material.dispose();
            blossomEffects.splice(i, 1);
        }
    }
    if (window.__renderReflection) window.__renderReflection();
    renderClawdMask();
    composer.render();
})();
const crownIndex = new Map;
const SEED_SPOTS = [ [ -.78, .52 ], [ -.38, .64 ], [ .06, .55 ], [ .48, .66 ], [ .78, .5 ], [ -.6, .78 ], [ -.12, .82 ], [ .62, .82 ], [ .26, .92 ], [ -.42, .91 ] ];
const FRUIT_SPOTS = [ [ -.62, .48 ], [ .04, .58 ], [ .66, .46 ], [ -.32, .54 ], [ .36, .52 ], [ -.78, .58 ] ];
let seedSpot = 0, fruitSpot = 0;
function resetCrownIndex() {
    crownIndex.clear();
    seedSpot = 0;
    fruitSpot = 0;
}
function refreshMemoryCount() {
    const el = document.getElementById("memoryCount");
    if (el) el.textContent = `树冠 ${memoryRecords.seed.length + memoryRecords.dew.length + memoryRecords.fruit.length} · 星链 ${memoryRecords.star.length} · 星环 ${memoryRecords.archive.length} / 全部 ${allMemoryRecords.length}`;
}
function showLifeToast(text, border, color) {
    const t = document.createElement("div");
    t.textContent = visitorModeOn ? String(text).split(" · ")[0] : text;
    t.style.cssText = "position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 58px);transform:translateX(-50%) translateY(-8px);" + "z-index:20;padding:9px 16px;border-radius:999px;border:1px solid " + (border || "rgba(255,214,170,.35)") + ";" + "background:rgba(30,16,40,.96);color:" + (color || "#ffe3c4") + ";font-size:12px;" + "opacity:0;transition:all .45s ease;max-width:78vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    document.body.appendChild(t);
    requestAnimationFrame(() => {
        t.style.opacity = "1";
        t.style.transform = "translateX(-50%) translateY(0)";
    });
    setTimeout(() => {
        t.style.opacity = "0";
        t.style.transform = "translateX(-50%) translateY(-8px)";
    }, 5200);
    setTimeout(() => t.remove(), 5800);
}
function ackAnim(id) {
    if (id && id !== "birthtest") fetch("/api/starmap/anim-done", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            id: String(id)
        })
    }).catch(() => {});
}
function dropLifecycleVisuals(meshes) {
    for (let i = lifecycleVisuals.length - 1; i >= 0; i--) if (meshes.includes(lifecycleVisuals[i].mesh)) lifecycleVisuals.splice(i, 1);
}
function removeCrownEntry(id) {
    const e = crownIndex.get(String(id));
    if (!e) return null;
    dropLifecycleVisuals(e.meshes);
    e.hits.forEach(h => {
        const ix = memoryHitMeshes.indexOf(h);
        if (ix >= 0) memoryHitMeshes.splice(ix, 1);
        h.removeFromParent();
    });
    e.meshes.forEach(m => m.removeFromParent());
    if (e.stem) e.stem.removeFromParent();
    crownIndex.delete(String(id));
    return e;
}
function buildSeedMesh(record, ceremony) {
    const kit = window.__birthKit;
    if (!kit || !record) return;
    const id = String(record.id || "");
    if (!id || crownIndex.has(id)) return;
    const t = SEED_SPOTS[seedSpot++ % SEED_SPOTS.length], a = kit.branchAnchor(t[0], t[1]), p = a.clone().add(new THREE.Vector3(0, .045, 0)), m = new THREE.Mesh(kit.seedGeo, kit.seedMat);
    m.position.copy(p);
    m.rotation.z = Math.random() * 1.2 - .6;
    kit.seedGroup.add(m);
    trackLifecycle(m, "seed", ceremony ? .12 : .16 + Math.random() * .5, new THREE.Vector3(.58, 1.38, .58), a);
    const idx = memoryRecords.seed.findIndex(r => String(r.id) === id);
    const hit = addMemoryHit(kit.seedGroup, [ p.x, p.y, p.z ], .24, "seed", idx >= 0 ? idx : 0);
    crownIndex.set(id, {
        type: "seed",
        meshes: [ m ],
        hits: [ hit ],
        anchor: a
    });
    if (ceremony) {
        showLifeToast("🌱 一颗新种子落在枝头 · " + (record.name || "新的记忆"));
        setTimeout(() => bloomAt(m), 1400);
    }
}
function buildFruitMesh(record, ceremony, anchor) {
    const kit = window.__birthKit;
    if (!kit || !record) return;
    const id = String(record.id || "");
    if (!id || crownIndex.has(id)) return;
    let a = anchor;
    if (!a) {
        const t = FRUIT_SPOTS[fruitSpot++ % FRUIT_SPOTS.length];
        a = kit.branchAnchor(t[0], t[1]);
    }
    const p = a.clone().add(new THREE.Vector3(0, -.13, 0)), top = p.clone().add(new THREE.Vector3(0, .105, 0)), stem = kit.hangStem(kit.fruitGroup, a, top, "#d99ac3"), shell = new THREE.Mesh(kit.fruitShellGeo, kit.fruitShellMat), core = new THREE.Mesh(kit.fruitCoreGeo, kit.fruitCoreMat), calyx = new THREE.Mesh(kit.fruitCalyxGeo, kit.fruitCalyxMat);
    shell.position.copy(p);
    shell.scale.set(1, .91, .88);
    shell.rotation.y = Math.random() * Math.PI;
    core.position.copy(p).add(new THREE.Vector3(0, -.006, .008));
    core.scale.setScalar(.82);
    core.rotation.z = Math.PI * .25;
    calyx.position.copy(top).add(new THREE.Vector3(0, -.008, 0));
    calyx.scale.set(1, .68, 1);
    calyx.rotation.y = Math.random() * Math.PI;
    shell.userData.fruitRole = "shell";
    core.userData.fruitRole = "core";
    calyx.userData.fruitRole = "calyx";
    shell.userData.pulse = 1.1 + Math.random() * 2;
    kit.fruitGroup.add(shell, core, calyx);
    trackLifecycle(shell, "fruit", ceremony ? .15 : 1.2 + Math.random() * .5, new THREE.Vector3(1, 1, 1), a);
    trackLifecycle(core, "fruitCore", ceremony ? .3 : 1.4 + Math.random() * .5, new THREE.Vector3(1, 1, 1), a);
    trackLifecycle(calyx, "fruit", ceremony ? .1 : 1.3 + Math.random() * .5, new THREE.Vector3(1, 1, 1), a);
    const idx = memoryRecords.fruit.findIndex(r => String(r.id) === id);
    const hit = addMemoryHit(kit.fruitGroup, [ p.x, p.y, p.z ], .32, "fruit", idx >= 0 ? idx : 0);
    crownIndex.set(id, {
        type: "fruit",
        meshes: [ shell, core, calyx ],
        hits: [ hit ],
        stem: stem,
        anchor: a
    });
    if (ceremony) {
        showLifeToast("🍑 一颗种子熟成了果实 · " + (record.name || ""), "rgba(242,162,204,.4)", "#ffd9ec");
        setTimeout(() => bloomAt(shell), 1200);
    }
}
let crownReconcileArmed = false;
function scheduleCrownReconcile() {
    if (crownReconcileArmed) return;
    crownReconcileArmed = true;
    (function attempt() {
        if (!window.__birthKit || !allMemoryRecords.length) {
            setTimeout(attempt, 1500);
            return;
        }
        crownReconcileArmed = false;
        memoryRecords.seed.forEach(r => buildSeedMesh(r, false));
        memoryRecords.fruit.forEach(r => buildFruitMesh(r, false));
        bindMemoryRecords();
        refreshMemoryCount();
    })();
}
function spawnBirth(record, isTest, quiet) {
    if (!record) return;
    const id = String(record.id || "");
    if (!memoryRecords.seed.some(r => String(r.id) === id)) memoryRecords.seed.push(record);
    if (!allMemoryRecords.some(r => String(r.id) === id)) allMemoryRecords.push(record);
    record.stage = "seed";
    record.anim_pending = null;
    buildSeedMesh(record, !quiet);
    bindMemoryRecords();
    refreshMemoryCount();
    if (!isTest) ackAnim(id);
}
function ritualScreenPoint(world) {
    if (!world) return {
        x: innerWidth * .5,
        y: innerHeight * .5
    };
    const p = world.clone().project(camera);
    return {
        x: (p.x * .5 + .5) * innerWidth,
        y: (-p.y * .5 + .5) * innerHeight
    };
}
function playRipenRitual(anchor, done) {
    const p = ritualScreenPoint(anchor), el = document.createElement("div");
    el.className = "life-ritual";
    el.style.left = p.x + "px";
    el.style.top = p.y + "px";
    el.innerHTML = '<i class="life-ripen-glow"></i><i class="life-sprout a"></i><i class="life-sprout b"></i>';
    document.body.appendChild(el);
    setTimeout(() => {
        el.remove();
        done && done();
    }, 1120);
}
function playStarDustRitual(from, targetWorld) {
    const a = ritualScreenPoint(from), target = ritualScreenPoint(targetWorld || new THREE.Vector3(0, 2.65, 0)), el = document.createElement("div");
    el.className = "life-ritual";
    el.style.left = a.x + "px";
    el.style.top = a.y + "px";
    const dx = target.x - a.x, dy = target.y - a.y, core = document.createElement("i"), flash = document.createElement("i");
    core.className = "life-core-flight";
    flash.className = "life-shell-flash";
    core.style.setProperty("--dx", dx + "px");
    core.style.setProperty("--dy", dy + "px");
    core.style.setProperty("--mx", dx * .38 + "px");
    core.style.setProperty("--my", dy * .43 - 30 + "px");
    el.append(flash, core);
    for (let i = 0; i < 11; i++) {
        const s = document.createElement("i"), j = (i - 5) * 4.6, sdx = dx + j, sdy = dy - Math.abs(i - 5) * 3;
        s.className = "life-star-dust";
        s.style.setProperty("--s", 2 + i % 3 + "px");
        s.style.setProperty("--delay", i * .035 + "s");
        s.style.setProperty("--dx", sdx + "px");
        s.style.setProperty("--dy", sdy + "px");
        s.style.setProperty("--mx", sdx * .38 + j * .7 + "px");
        s.style.setProperty("--my", sdy * .43 - 24 - Math.abs(j) * .22 + "px");
        el.appendChild(s);
    }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2850);
    setTimeout(() => {
        const kiss = document.createElement("i");
        kiss.className = "life-ring-kiss";
        kiss.style.left = target.x + "px";
        kiss.style.top = target.y + "px";
        document.body.appendChild(kiss);
        setTimeout(() => kiss.remove(), 1250);
    }, 2260);
}
function scheduleArchiveWelcome(count) {
    const key = "memoryTreeSeenArchiveCount";
    let previous = null;
    try {
        const raw = localStorage.getItem(key);
        if (raw !== null) previous = Math.max(0, parseInt(raw, 10) || 0);
        localStorage.setItem(key, String(count));
    } catch (e) {}
    const arrivals = previous === null ? 1 : Math.min(3, Math.max(0, count - previous));
    for (let i = 0; i < arrivals; i++) setTimeout(() => {
        const angle = (.72 + i * 2.18 + count % 13 * .07) % (Math.PI * 2), target = ring.localToWorld(new THREE.Vector3(Math.cos(angle) * 2.8, 0, Math.sin(angle) * 2.8 * .48));
        const from = target.clone().add(new THREE.Vector3((i - 1) * .16, 2.15 + .18 * i, 0));
        playStarDustRitual(from, target);
    }, 1150 + i * 520);
}
function playRipen(record, quiet) {
    if (!record) return;
    const id = String(record.id || "");
    const si = memoryRecords.seed.findIndex(r => String(r.id) === id);
    if (si >= 0) memoryRecords.seed.splice(si, 1);
    record.stage = "fruit";
    record.anim_pending = null;
    if (!memoryRecords.fruit.some(r => String(r.id) === id)) memoryRecords.fruit.push(record);
    const old = crownIndex.get(id), anchor = old ? old.anchor : null;
    const finish = () => {
        const current = crownIndex.get(id);
        if (current?.type === "seed") removeCrownEntry(id);
        buildFruitMesh(record, !quiet, anchor);
        bindMemoryRecords();
        refreshMemoryCount();
        ackAnim(id);
    };
    if (old && !quiet) {
        bloomAt(old.meshes[0]);
        playRipenRitual(anchor, finish);
    } else finish();
}
const ascendAnims = [];
const dewExits = [], safeDews = [];
function playAscend(record, ringAngle, quiet) {
    if (!record) return;
    const id = String(record.id || "");
    const fi = memoryRecords.fruit.findIndex(r => String(r.id) === id);
    if (fi >= 0) memoryRecords.fruit.splice(fi, 1);
    const si = memoryRecords.seed.findIndex(r => String(r.id) === id);
    if (si >= 0) memoryRecords.seed.splice(si, 1);
    record.stage = "archived";
    if (ringAngle != null) record.ring_angle = ringAngle;
    record.anim_pending = null;
    if (!memoryRecords.archive.some(r => String(r.id) === id)) memoryRecords.archive.push(record);
    const riverTarget = riverLandingPoint(record);
    if (!quiet) showLifeToast(riverTarget ? "💧 一段记忆流进了珠光河 · " + (record.name || "") : "⭐ 一段记忆升入了星环 · " + (record.name || ""), riverTarget ? "rgba(222,218,255,.4)" : "rgba(255,241,201,.4)", riverTarget ? "#dedaff" : "#fff1c9");
    const e = crownIndex.get(id);
    if (e) {
        const angle = (ringAngle == null ? 42 : ringAngle) * Math.PI / 180, targetWorld = riverTarget || ring.localToWorld(new THREE.Vector3(Math.cos(angle) * 2.8, 0, Math.sin(angle) * 2.8 * .48)), fromWorld = e.meshes[0].getWorldPosition(new THREE.Vector3);
        if (!quiet) {
            playStarDustRitual(fromWorld, targetWorld);
            if (riverTarget) setTimeout(() => landRipple(riverTarget), 2150);
        }
        dropLifecycleVisuals(e.meshes);
        e.hits.forEach(h => {
            const ix = memoryHitMeshes.indexOf(h);
            if (ix >= 0) memoryHitMeshes.splice(ix, 1);
            h.removeFromParent();
        });
        if (e.stem) e.stem.removeFromParent();
        e.meshes.forEach(m => m.removeFromParent());
        crownIndex.delete(id);
    }
    setTimeout(() => {
        if (id !== "birthtest") populateArchiveCloud();
        bindMemoryRecords();
        refreshMemoryCount();
    }, 2700);
    ackAnim(id);
}
let lifeDemoRecord = null, lifeDemoTimers = [], lifeDemoTicker = 0, lifeDemoMeshes = [], lifeDemoGo = false;
const LIFE_DEMO_FRUIT = 6e3, LIFE_DEMO_ASCEND = 12e3, LIFE_DEMO_END = 18e3;
function clearLifeDemo(removeVisual = true) {
    lifeDemoTimers.forEach(clearTimeout);
    lifeDemoTimers = [];
    clearInterval(lifeDemoTicker);
    lifeDemoTicker = 0;
    if (removeVisual && lifeDemoRecord) {
        const id = String(lifeDemoRecord.id), entry = crownIndex.get(id);
        if (entry) removeCrownEntry(id);
        for (let i = ascendAnims.length - 1; i >= 0; i--) if (ascendAnims[i].meshes.some(m => lifeDemoMeshes.includes(m))) {
            ascendAnims[i].meshes.forEach(m => m.removeFromParent());
            ascendAnims.splice(i, 1);
        }
        for (const key of [ "seed", "fruit", "archive" ]) for (let i = memoryRecords[key].length - 1; i >= 0; i--) if (String(memoryRecords[key][i].id) === id) memoryRecords[key].splice(i, 1);
        for (let i = allMemoryRecords.length - 1; i >= 0; i--) if (String(allMemoryRecords[i].id) === id) allMemoryRecords.splice(i, 1);
        bindMemoryRecords();
        refreshMemoryCount();
    }
    lifeDemoRecord = null;
    lifeDemoMeshes = [];
    const button = document.getElementById("lifeDemoBtn");
    button.classList.remove("demo-on");
    button.dataset.stage = "idle";
    button.textContent = "▶ 一生演示";
}
function beginLifeDemo(source) {
    clearLifeDemo();
    if (soloMode) {
        soloMode = false;
        applySoloVisibility();
    }
    document.getElementById("memorySearch").classList.remove("on");
    document.getElementById("ringPanel").classList.remove("on");
    const button = document.getElementById("lifeDemoBtn"), started = performance.now();
    lifeDemoRecord = {
        ...source || {},
        id: "birthtest",
        name: "演示 · " + (source?.name || "一颗记忆的一生"),
        preview: "这是一段只存在十几秒的演示，不会写入真实记忆。",
        created: (new Date).toISOString().slice(0, 10),
        importance: 7,
        stage: "seed"
    };
    button.classList.add("demo-on");
    button.dataset.stage = "seed";
    spawnBirth(lifeDemoRecord, true, false);
    lifeDemoMeshes = [ ...crownIndex.get("birthtest")?.meshes || [] ];
    lifeDemoTicker = setInterval(() => {
        const left = Math.max(0, LIFE_DEMO_END / 1e3 - Math.floor((performance.now() - started) / 1e3));
        button.textContent = `× 演示 ${left}s`;
    }, 500);
    lifeDemoTimers.push(setTimeout(() => {
        button.dataset.stage = "fruit";
        playRipen(lifeDemoRecord, false);
        lifeDemoMeshes = [ ...crownIndex.get("birthtest")?.meshes || [] ];
    }, LIFE_DEMO_FRUIT));
    lifeDemoTimers.push(setTimeout(() => {
        button.dataset.stage = "archive";
        playAscend(lifeDemoRecord, 42, false);
    }, LIFE_DEMO_ASCEND));
    lifeDemoTimers.push(setTimeout(() => {
        showLifeToast("演示结束 · 真实记忆没有被改变");
        clearLifeDemo();
    }, LIFE_DEMO_END));
}
document.getElementById("lifeDemoBtn").onclick = () => {
    if (lifeDemoRecord) {
        showLifeToast("已退出生命周期演示");
        clearLifeDemo();
        return;
    }
    if (cinemaCountdownTimer) {
        cancelCinemaCountdown();
        return;
    }
    if (!lifeDemoGo) {
        runCinemaCountdown();
        return;
    }
    lifeDemoGo = false;
    fetch("/api/starmap/lifecycle?demo=1").then(r => r.json()).then(data => {
        const id = Object.keys(data.memories || {})[0], source = findRecord(id) || allMemoryRecords[0] || null;
        beginLifeDemo(source);
    }).catch(() => beginLifeDemo(allMemoryRecords[0] || null));
};
(function ascendLoop() {
    requestAnimationFrame(ascendLoop);
    const now = performance.now();
    for (let i = safeDews.length - 1; i >= 0; i--) {
        const d = safeDews[i];
        if (!d.el.isConnected) {
            removeSafeDew(d);
            continue;
        }
        const p = d.world.clone().project(camera);
        d.el.style.left = (p.x * .5 + .5) * innerWidth + "px";
        d.el.style.top = (-p.y * .5 + .5) * innerHeight + "px";
        d.el.style.visibility = p.z > -1 && p.z < 1 ? "visible" : "hidden";
        const screenUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion), q = d.world.clone().addScaledVector(screenUp, .12).project(camera), projectedPx = Math.hypot((q.x - p.x) * innerWidth * .5, (q.y - p.y) * innerHeight * .5), h = Math.max(6, Math.min(40, projectedPx));
        d.el.style.width = h * .67 + "px";
        d.el.style.height = h + "px";
    }
    for (let i = ascendAnims.length - 1; i >= 0; i--) {
        const a = ascendAnims[i], k = Math.min(1, (now - a.start) / 2400), e = k * k * (3 - 2 * k);
        a.parts.forEach(p => {
            const m = p.mesh;
            if (p.role === "core") {
                const lift = p.from.clone().lerp(a.target, e), arc = Math.sin(k * Math.PI) * .64;
                lift.y += arc;
                m.position.copy(lift);
                m.rotation.y += .055;
                m.rotation.z += .035;
                const pulse = 1 + Math.sin(k * Math.PI) * .72;
                m.scale.copy(p.scale).multiplyScalar(Math.max(.08, (1 - e * .82) * pulse));
                m.material.opacity = p.opacity * Math.min(1, k * 5);
            } else if (p.role === "calyx") {
                m.position.copy(p.from);
                m.position.y -= e * .26;
                m.position.x += Math.sin(k * Math.PI) * .08;
                m.rotation.z += .045;
                m.scale.copy(p.scale).multiplyScalar(Math.max(.001, 1 - e));
                m.material.opacity = p.opacity * (1 - e);
            } else {
                m.position.copy(p.from);
                m.position.y += e * .1;
                m.rotation.y += .025;
                const open = 1 + Math.sin(Math.min(1, k / .48) * Math.PI) * .22;
                m.scale.copy(p.scale).multiplyScalar(Math.max(.001, open * (1 - e)));
                m.material.opacity = p.opacity * (1 - e);
            }
        });
        if (k >= 1) {
            a.meshes.forEach(m => {
                m.removeFromParent();
                m.material.dispose();
            });
            ascendAnims.splice(i, 1);
        }
    }
    for (let i = dewExits.length - 1; i >= 0; i--) {
        const a = dewExits[i], k = Math.min(1, (now - a.start) / 2600), e = k * k * (3 - 2 * k);
        a.mesh.position.y = a.fromY + e * .45;
        a.mesh.material.opacity = .64 * (1 - e);
        a.mesh.scale.setScalar(a.baseS * (1 - .4 * e));
        if (k >= 1) {
            a.mesh.removeFromParent();
            a.mesh.material.dispose();
            dewExits.splice(i, 1);
        }
    }
})();
const ceremonyQueue = [];
let ceremonyPlaying = false;
function enqueueCeremony(fn) {
    ceremonyQueue.push(fn);
    if (!ceremonyPlaying) runCeremonyQueue();
}
function runCeremonyQueue() {
    const fn = ceremonyQueue.shift();
    if (!fn) {
        ceremonyPlaying = false;
        return;
    }
    ceremonyPlaying = true;
    try {
        fn();
    } catch (e) {}
    setTimeout(runCeremonyQueue, 3600);
}
function spawnDew(id, name) {
    const rec = findRecord(id) || {
        id: String(id),
        name: name || "一段记忆"
    };
    showLifeToast("💧 我想起了 · " + (name || rec.name || "一段记忆"), "rgba(222,218,255,.4)", "#dedaff");
    for (let i = safeDews.length - 1; i >= 0; i--) if (!safeDews[i].el.isConnected) safeDews.splice(i, 1);
    let slot, oldest = null;
    if (safeDews.length >= 6) {
        oldest = safeDews.reduce((a, b) => a.born <= b.born ? a : b);
        slot = oldest.slot;
        removeSafeDew(oldest);
    } else {
        const used = new Set(safeDews.map(d => d.slot));
        slot = [ 0, 1, 2, 3, 4, 5 ].find(i => !used.has(i));
    }
    const dew = document.createElement("div");
    dew.className = "safe-dew";
    dew.title = name || rec.name || "一段记忆";
    dew.setAttribute("role", "button");
    dew.setAttribute("aria-label", "打开这滴露珠里的记忆");
    dew.style.setProperty("--dew-color", ringTune.dewColor || "#dedaff");
    const world = (window.__birthKit?.dewAnchors?.[slot] || new THREE.Vector3(0, 2.2, 0)).clone();
    dew.onclick = () => openCard(rec, "dew", "ORDINARY DAY · 露珠");
    if (soloMode && soloType !== "dew") dew.style.display = "none";
    document.body.appendChild(dew);
    const entry = {
        el: dew,
        world: world,
        slot: slot,
        rec: rec,
        born: performance.now(),
        timer: 0
    };
    safeDews.push(entry);
    memoryRecords.dew.push(rec);
    refreshMemoryCount();
    entry.timer = setTimeout(() => removeSafeDew(entry), 180500);
}
function removeSafeDew(entry) {
    if (!entry) return;
    clearTimeout(entry.timer);
    entry.el.remove();
    const i = safeDews.indexOf(entry);
    if (i >= 0) safeDews.splice(i, 1);
    const ri = memoryRecords.dew.indexOf(entry.rec);
    if (ri >= 0) memoryRecords.dew.splice(ri, 1);
    refreshMemoryCount();
}
function findRecord(id) {
    id = String(id);
    return allMemoryRecords.find(r => String(r.id) === id) || null;
}
let lifeSyncBusy = false;
function syncLifecycle() {
    if (!window.__birthKit) {
        setTimeout(syncLifecycle, 2e3);
        return;
    }
    if (lifeSyncBusy) return;
    lifeSyncBusy = true;
    fetch("/api/starmap").then(r => r.json()).then(data => {
        const stars = (data.galaxies || []).flatMap(g => (g.stars || []).map(s => ({
            ...s,
            domain: s.domain || g.label || "",
            galaxy: g.label,
            color: g.color
        })));
        const pend = [];
        stars.forEach(s => {
            if (!s.anim_pending || !s.id) return;
            pend.push(s);
        });
        const LOUD = 3, loud = pend.slice(-LOUD), quietOnes = pend.slice(0, Math.max(0, pend.length - LOUD));
        const doOne = (s, quiet) => {
            const id = String(s.id), onstage = findRecord(id);
            if (s.anim_pending === "birth") {
                if (onstage) {
                    if (!onstage._ceremonyDone && !quiet) {
                        onstage._ceremonyDone = true;
                        showLifeToast("🌱 一颗新种子落在枝头 · " + (s.name || ""));
                        const e = crownIndex.get(id);
                        if (e) setTimeout(() => bloomAt(e.meshes[0]), 1400);
                    }
                    onstage.anim_pending = null;
                    ackAnim(id);
                } else spawnBirth(s, false, quiet);
            } else if (s.anim_pending === "ripen") {
                playRipen(onstage || s, quiet);
            } else if (s.anim_pending === "ascend") {
                playAscend(onstage || s, s.ring_angle, quiet);
            }
        };
        quietOnes.forEach(s => doOne(s, true));
        loud.forEach(s => enqueueCeremony(() => doOne(s, false)));
        if (quietOnes.length) enqueueCeremony(() => showLifeToast("✨ 你不在的时候，还有 " + quietOnes.length + " 段记忆悄悄完成了成长", "rgba(222,218,255,.4)", "#dedaff"));
    }).catch(() => {}).finally(() => {
        lifeSyncBusy = false;
    });
}
const LIVE_LIFECYCLE = false;
if (LIVE_LIFECYCLE) setTimeout(syncLifecycle, 1200);
let lifePokeBusy = false;
async function pokeLifecycle() {
    if (document.hidden || lifePokeBusy) return;
    lifePokeBusy = true;
    try {
        await fetch("/api/starmap/lifecycle/sync", {
            method: "POST"
        });
    } catch (e) {} finally {
        lifePokeBusy = false;
    }
}
if (LIVE_LIFECYCLE) {
    setTimeout(pokeLifecycle, 450);
    setInterval(pokeLifecycle, 4e3);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            setTimeout(pokeLifecycle, 120);
            setTimeout(syncLifecycle, 600);
        }
    });
}
(function initLifeStream() {
    if (!LIVE_LIFECYCLE) return;
    if (new URLSearchParams(location.search).get("birthtest")) {
        setTimeout(() => spawnBirth({
            id: "birthtest",
            name: "测试种子 · 出生动画验收",
            preview: "这是一颗假种子，只为验收出生动画，刷新就消失。",
            created: "2026-07-24",
            importance: 5
        }, true), 3e3);
        return;
    }
    let es;
    try {
        es = new EventSource("/api/starmap/events");
    } catch (e) {
        return;
    }
    es.onmessage = ev => {
        let d;
        try {
            d = JSON.parse(ev.data);
        } catch (e) {
            return;
        }
        if (!d.id) return;
        const id = String(d.id);
        console.log("[life-stream]", d.event, id);
        if (d.event === "birth") {
            if (findRecord(id)) return;
            fetch("/api/starmap").then(r => r.json()).then(data => {
                const rec = (data.galaxies || []).flatMap(g => (g.stars || []).map(s => ({
                    ...s,
                    domain: s.domain || g.label || "",
                    galaxy: g.label,
                    color: g.color
                }))).find(s => String(s.id) === id);
                if (rec) enqueueCeremony(() => spawnBirth(rec, false));
            }).catch(() => {});
        } else if (d.event === "ripen") {
            enqueueCeremony(() => playRipen(findRecord(id)));
        } else if (d.event === "ascend") {
            enqueueCeremony(() => playAscend(findRecord(id), d.ring_angle));
        } else if (d.event === "dew") {
            enqueueCeremony(() => spawnDew(id, d.name));
        }
    };
})();
(function treeShake() {
    const petalShape = new THREE.Shape;
    petalShape.moveTo(0, 0);
    petalShape.bezierCurveTo(.055, .025, .065, .11, 0, .17);
    petalShape.bezierCurveTo(-.065, .11, -.055, .025, 0, 0);
    const petalGeo = new THREE.ShapeGeometry(petalShape, 6), petals = [], V = new THREE.Vector3, PETAL_LIT = new THREE.Color("#fffaf0"), memCardEl = document.getElementById("memCard");
    let sway = null, lastShake = 0, taps = [], down = null;
    const treeOn = () => active && parentsVisible(active);
    function pickRecords(n) {
        const pool = allMemoryRecords.filter(r => r && r.name && r.stage !== "removed");
        if (!pool.length) return [];
        const vip = pool.filter(r => r.pinned || (+r.importance || 0) >= 8), bag = [ ...vip, ...vip, ...pool ], seen = new Set, out = [];
        for (let g = 0; g < 200 && out.length < n; g++) {
            const r = bag[Math.floor(Math.random() * bag.length)];
            if (seen.has(r.id)) continue;
            seen.add(r.id);
            out.push(r);
        }
        return out;
    }
    function treeBox() {
        const b = (new THREE.Box3).setFromObject(active);
        return {
            b: b,
            size: b.getSize(new THREE.Vector3),
            c: b.getCenter(new THREE.Vector3)
        };
    }
    const _mb = new THREE.Box3, _ob = new THREE.Box3;
    function treeMeshBox() {
        _mb.makeEmpty();
        active.traverse(o => {
            if (o.isMesh && o.geometry && o.visible) {
                _ob.setFromObject(o);
                if (!_ob.isEmpty()) _mb.union(_ob);
            }
        });
        if (_mb.isEmpty()) return treeBox();
        return {
            b: _mb,
            size: _mb.getSize(new THREE.Vector3),
            c: _mb.getCenter(new THREE.Vector3)
        };
    }
    function shake() {
        const now = performance.now();
        if (now - lastShake < 1200) return;
        lastShake = now;
        if (!treeOn()) {
            showLifeToast("树还没长出来，等一下再摇 🌱");
            return;
        }
        if (!sway) sway = {
            base: active.rotation.z,
            start: now
        }; else sway.start = now;
        const {b: b, size: size, c: c} = treeMeshBox(), groundY = b.min.y + .02, recs = pickRecords(4);
        let qi = 0;
        for (let i = 0; i < 16; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: i % 3 ? "#ffd8ee" : "#ffe9f6",
                transparent: true,
                opacity: .94,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const m = new THREE.Mesh(petalGeo, mat);
            m.position.set(c.x + (Math.random() - .5) * size.x * .62, b.min.y + size.y * (.5 + Math.random() * .45), c.z + (Math.random() - .5) * size.z * .62);
            m.scale.setScalar(.7 + Math.random() * .8);
            m.visible = false;
            scene.add(m);
            const p = {
                mesh: m,
                mat: mat,
                born: now + i * 38,
                speed: .8 + Math.random() * .5,
                swayA: .22 + Math.random() * .2,
                swayF: 1.6 + Math.random() * 1.4,
                phase: Math.random() * 6.28,
                drift: (Math.random() - .5) * .16,
                spin: (Math.random() - .5) * 4,
                y0: m.position.y,
                x0: m.position.x,
                gy: groundY + Math.random() * .06,
                landed: 0,
                rec: null
            };
            if (qi < recs.length && i % 4 === 1) {
                const slot = qi;
                p.rec = recs[qi++];
                m.position.x = c.x + [ -.82, -.3, .32, .84 ][slot % 4] * size.x * .5;
                m.position.y = b.min.y + size.y * (.62 + slot % 2 * .18);
                p.x0 = m.position.x;
                p.y0 = m.position.y;
                p.born = now + 260 + slot * 300;
                mat.color.set("#ffe2a8");
                m.scale.setScalar(1.3 + Math.random() * .35);
                p.s0 = m.scale.x;
            }
            petals.push(p);
        }
        showLifeToast("🌸 哗啦——金色的花瓣捎着记忆，落地后点它看看");
    }
    function trunkRect() {
        const {b: b, size: size, c: c} = treeBox(), xs = [], ys = [];
        for (const dx of [ -.045, .045 ]) for (const fy of [ .04, .27 ]) {
            V.set(c.x + dx * size.x, b.min.y + fy * size.y, c.z).project(camera);
            xs.push((V.x * .5 + .5) * innerWidth);
            ys.push((-V.y * .5 + .5) * innerHeight);
        }
        return {
            x0: Math.min(...xs) - 6,
            x1: Math.max(...xs) + 6,
            y0: Math.min(...ys),
            y1: Math.max(...ys)
        };
    }
    function goldAt(x, y) {
        let best = null, bd = 34;
        for (const p of petals) {
            if (!p.rec) continue;
            p.mesh.getWorldPosition(V);
            V.project(camera);
            if (V.z > 1) continue;
            const d = Math.hypot((V.x * .5 + .5) * innerWidth - x, (-V.y * .5 + .5) * innerHeight - y);
            if (d < bd) {
                bd = d;
                best = p;
            }
        }
        return best;
    }
    function openGold(g) {
        window.__treeTapConsumedAt = performance.now();
        g.lit = performance.now();
        try {
            bloomAt(g.mesh);
        } catch (e) {}
        const rec = g.rec;
        setTimeout(() => openCard(rec, "dew", "FALLING MEMORY · 花瓣捎来的"), 380);
    }
    {
        const overlaySel = "#clawdHotspot,.safe-dew";
        let odown = null, overlayTapAt = 0;
        document.addEventListener("pointerdown", ev => {
            odown = ev.target && ev.target.closest && ev.target.closest(overlaySel) ? {
                x: ev.clientX,
                y: ev.clientY
            } : null;
        }, true);
        document.addEventListener("pointerup", ev => {
            const d = odown;
            odown = null;
            if (!d || Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 8) return;
            const g = goldAt(ev.clientX, ev.clientY);
            if (!g) return;
            overlayTapAt = performance.now();
            openGold(g);
        }, true);
        document.addEventListener("click", ev => {
            if (performance.now() - overlayTapAt < 600 && ev.target && ev.target.closest && ev.target.closest(overlaySel)) {
                ev.stopImmediatePropagation();
                ev.preventDefault();
            }
        }, true);
    }
    canvas.addEventListener("pointerdown", ev => {
        down = {
            x: ev.clientX,
            y: ev.clientY,
            t: performance.now()
        };
    }, {
        capture: true
    });
    canvas.addEventListener("pointerup", ev => {
        const d = down;
        down = null;
        if (!d || Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 8 || performance.now() - d.t > 600) return;
        if (branchPickMode || crownMemoryAt(ev.clientX, ev.clientY)) {
            taps = [];
            return;
        }
        const g = goldAt(ev.clientX, ev.clientY);
        if (g) {
            openGold(g);
            return;
        }
        if (!treeOn()) return;
        const r = trunkRect();
        if (ev.clientX < r.x0 || ev.clientX > r.x1 || ev.clientY < r.y0 || ev.clientY > r.y1) return;
        window.__treeTapConsumedAt = performance.now();
        const now = performance.now();
        taps = taps.filter(t => now - t < 2600);
        taps.push(now);
        if (taps.length >= 3) {
            taps = [];
            shake();
            return;
        }
        if (!sway) sway = {
            base: active.rotation.z,
            start: now - 1400
        }; else sway.start = Math.max(sway.start, now - 1400);
    }, {
        capture: true
    });
    (function loop() {
        requestAnimationFrame(loop);
        const now = performance.now();
        if (sway && active) {
            const age = (now - sway.start) / 1e3, k = Math.max(0, 1 - age / 2.1);
            if (k <= 0) {
                active.rotation.z = sway.base;
                sway = null;
            } else active.rotation.z = sway.base + Math.sin(age * 8.5) * .04 * k;
        }
        for (let i = petals.length - 1; i >= 0; i--) {
            const p = petals[i], age = (now - p.born) / 1e3;
            if (age < 0) {
                p.mesh.visible = false;
                continue;
            }
            if (!p.mesh.visible) p.mesh.visible = true;
            if (!p.landed) {
                p.mesh.position.y = p.y0 - p.speed * age;
                p.mesh.position.x = p.x0 + Math.sin(age * p.swayF + p.phase) * p.swayA * Math.min(1, age * .8) + p.drift * age;
                p.mesh.quaternion.copy(camera.quaternion);
                p.mesh.rotateZ(p.spin * age);
                if (p.mesh.position.y <= p.gy) {
                    p.mesh.position.y = p.gy;
                    p.landed = now;
                }
            } else {
                const f = (now - p.landed) / 1e3;
                if (p.rec) {
                    p.mesh.quaternion.copy(camera.quaternion);
                    p.mat.opacity = f > 15 ? Math.max(0, .9 - (f - 15) * .3) : .62 + Math.sin(now * .005 + p.phase) * .3;
                } else p.mat.opacity = Math.max(0, .94 - f * .8);
                if (!p.lit && f > (p.rec ? 18 : 1.4)) {
                    scene.remove(p.mesh);
                    p.mat.dispose();
                    petals.splice(i, 1);
                    continue;
                }
            }
            if (p.lit) {
                const k = Math.min(1, (now - p.lit) / 450);
                p.mesh.scale.setScalar((p.s0 || 1.4) * (1 + .75 * k + Math.sin(now * .007) * .07 * k));
                p.mat.opacity = 1;
                p.mat.color.set("#ffe2a8").lerp(PETAL_LIT, k);
                if (now - p.lit > 1500 && !memCardEl.classList.contains("show")) {
                    p.lit = 0;
                    p.mesh.scale.setScalar(p.s0 || 1.4);
                    p.mat.color.set("#ffe2a8");
                    if (p.landed) p.landed = Math.min(p.landed, now - 15e3);
                }
            }
        }
    })();
    window.__shakeDbg = () => ({
        treeOn: !!treeOn(),
        activeVisible: active ? active.visible : null,
        taps: taps.length
    });
    window.__shake = {
        shake: shake,
        trunkXY: () => {
            if (!treeOn()) return null;
            const r = trunkRect();
            return [ (r.x0 + r.x1) / 2, r.y0 * .35 + r.y1 * .65 ];
        },
        litCount: () => petals.filter(p => p.lit).length,
        goldXY: () => {
            for (const p of petals) {
                if (p.rec && p.landed) {
                    p.mesh.getWorldPosition(V);
                    V.project(camera);
                    const x = (V.x * .5 + .5) * innerWidth, y = (-V.y * .5 + .5) * innerHeight;
                    if (x > 20 && x < innerWidth - 20 && y > 90 && y < innerHeight - 20) return [ x, y ];
                }
            }
            return null;
        },
        stats: () => ({
            petals: petals.length,
            gold: petals.filter(p => p.rec).length,
            goldLanded: petals.filter(p => p.rec && p.landed).length,
            hidden: petals.filter(p => !p.mesh.visible).length
        }),
        dump: () => petals.map(p => ({
            gold: !!p.rec,
            y: p.mesh.position.y,
            y0: p.y0,
            gy: p.gy,
            sp: p.speed,
            age: (performance.now() - p.born) / 1e3,
            landedAgo: p.landed ? (performance.now() - p.landed) / 1e3 : null,
            vis: p.mesh.visible
        })),
        box: () => {
            const a = treeBox(), m = treeMeshBox();
            return {
                "含星尘": [ +a.b.min.y.toFixed(2), +a.b.max.y.toFixed(2) ],
                "只有树": [ +m.b.min.y.toFixed(2), +m.b.max.y.toFixed(2) ]
            };
        }
    };
})();
