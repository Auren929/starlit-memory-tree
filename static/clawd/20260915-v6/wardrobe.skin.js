import * as THREE from "three";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { ClawdMotion, durations } from "./motion.js";

export const outfitNames = {
    cat: "黑猫耳",
    bunny: "黑兔耳",
    sprout: "嫩芽围巾",
    wizard: "小魔法师",
    maid: "小女仆",
    omurice: "蛋包饭"
};

const specialNames = {
    cat: "摇摇尾巴",
    bunny: "蹦蹦耳朵",
    sprout: "小芽摇摇",
    wizard: "变颗星星",
    maid: "行个小礼",
    omurice: "扶稳蛋包饭"
};

export function createClawdWardrobe({groups: groups, legacy: legacy, scale: scale, baseY: baseY, status: status, specialButton: specialButton}) {
    const loader = new GLTFLoader, cache = new Map;
    let selected = "plain", active = null, request = 0, previous = 0;
    function original(visible) {
        legacy.forEach(o => o.visible = visible);
    }
    function load(kind) {
        if (cache.has(kind)) return cache.get(kind);
        const promise = loader.loadAsync(new URL("./models/" + kind + ".glb", import.meta.url).href).then(gltf => {
            const model = gltf.scene;
            model.traverse(o => {
                if (o.isMesh && /^(Body|Arm|Foot)(?:[_.0-9]|$)/.test(o.name)) o.material = legacy[0].material;
            });
            const actor = new ClawdMotion(model, kind);
            model.scale.setScalar(scale);
            model.position.y = baseY;
            const box = (new THREE.Box3).setFromObject(model), head = box.max.y;
            groups[kind].add(model);
            let stars = null;
            if (kind === "wizard") {
                stars = new THREE.Group;
                model.add(stars);
                const mat = new THREE.MeshStandardMaterial({
                    color: 16768906,
                    emissive: 16764787,
                    emissiveIntensity: 1.2
                });
                const geometry = new THREE.OctahedronGeometry(.075);
                for (let i = 0; i < 6; i++) {
                    const star = new THREE.Mesh(geometry, mat);
                    stars.add(star);
                }
                stars.visible = false;
            }
            return {
                actor: actor,
                model: model,
                head: head,
                stars: stars
            };
        }).catch(e => {
            cache.delete(kind);
            throw e;
        });
        cache.set(kind, promise);
        return promise;
    }
    function select(kind) {
        selected = kind;
        const token = ++request;
        active?.actor.reset();
        if (active?.stars) active.stars.visible = false;
        active = null;
        original(true);
        specialButton.hidden = !outfitNames[kind];
        specialButton.disabled = true;
        status.dataset.outfit = kind;
        status.dataset.ready = "false";
        if (!outfitNames[kind]) {
            status.textContent = "";
            return Promise.resolve();
        }
        status.textContent = "正在换上" + outfitNames[kind] + "…";
        specialButton.textContent = specialNames[kind];
        return load(kind).then(item => {
            if (token !== request || selected !== kind) return;
            active = item;
            active.actor.reset();
            original(false);
            specialButton.disabled = false;
            status.textContent = "已换上" + outfitNames[kind];
            status.dataset.ready = "true";
        }).catch(e => {
            if (token !== request) return;
            original(true);
            status.textContent = "这套装扮未载入，已保留原味 Clawd；点装扮可重试。";
            console.warn("Clawd outfit load failed", kind, e);
        });
    }
    function update(motion, now) {
        const dt = previous ? Math.min(.05, Math.max(0, (now - previous) / 1e3)) : 0;
        previous = now;
        if (!active) return false;
        const a = active.actor, type = motion.type in durations ? motion.type : "idle", age = Math.max(0, now - motion.start);
        a.type = type;
        a.time += dt;
        a.elapsed = Number.isFinite(durations[type]) ? Math.min(1, age / Math.max(1, motion.duration)) * durations[type] : age / 1e3;
        a.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        a.update(0);
        status.dataset.motion = a.type;
        if (active.stars) {
            const visible = type === "special" && !a.reduced && age < motion.duration;
            active.stars.visible = visible;
            if (visible) {
                const k = age / motion.duration;
                active.stars.children.forEach((s, i) => {
                    const angle = i * Math.PI / 3 + k * 2;
                    s.position.set(Math.cos(angle) * (.6 + k * .4), 2.8 + Math.sin(k * Math.PI) * .4 + Math.sin(angle) * .12, Math.sin(angle) * .6);
                    s.scale.setScalar(Math.sin(k * Math.PI));
                });
            }
        }
        return true;
    }
    return {
        select: select,
        update: update,
        get ready() {
            return !!active;
        },
        get headY() {
            return active?.head || .78;
        }
    };
}