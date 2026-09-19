import * as THREE from "three";

export const durations = {
    idle: Infinity,
    hello: 1.25,
    curious: 1.25,
    happy: 1.7,
    waiting: Infinity,
    sad: 1.8,
    dress: 1.5,
    pet: 2.4,
    special: 2.4
};

export class ClawdMotion {
    constructor(model, kind) {
        this.model = model;
        this.kind = kind;
        this.root = model.getObjectByName(kind[0].toUpperCase() + kind.slice(1));
        this.parts = [];
        this.pivots = [];
        this.type = "idle";
        this.elapsed = 0;
        this.time = 0;
        this.reduced = false;
        const group = (name, test, pivot) => {
            const objects = [];
            this.root.traverse(o => {
                if (o.isMesh && test(o.name)) objects.push(o);
            });
            if (!objects.length) return;
            const g = new THREE.Group;
            g.name = name;
            g.position.copy(pivot);
            this.root.add(g);
            this.root.updateMatrixWorld(true);
            objects.forEach(o => g.attach(o));
            this.pivots.push(g);
            return g;
        };
        if (kind === "cat") this.tail = group("tailPivot", n => n.startsWith("Curled_tail"), new THREE.Vector3(.9, .65, -.38));
        if (kind === "bunny") {
            this.ear = group("earPivot", n => n.startsWith("Floppy") || n.startsWith("Flopped") || n.startsWith("Pink_floppy"), new THREE.Vector3(.5, 1.92, 0));
        }
        if (kind === "sprout") this.sprout = group("sproutPivot", n => n.startsWith("Stem") || n.startsWith("Leaf"), new THREE.Vector3(0, 1.925, 0));
        if (kind === "wizard") this.hat = group("hatPivot", n => n.startsWith("Hat") || n.startsWith("Stepped_hat") || n.startsWith("Star"), new THREE.Vector3(0, 1.925, 0));
        if (kind === "omurice") this.food = group("foodPivot", n => n.startsWith("Food"), new THREE.Vector3(0, 1.925, 0));
        this.root.traverse(o => {
            if (o.isMesh) {
                this.parts.push({
                    o: o,
                    p: o.position.clone(),
                    q: o.quaternion.clone(),
                    s: o.scale.clone()
                });
                o.castShadow = true;
                o.receiveShadow = true;
            }
        });
        this.arms = this.parts.filter(p => p.o.name.startsWith("Arm"));
        this.feet = this.parts.filter(p => p.o.name.startsWith("Foot"));
        this.eyes = this.parts.filter(p => p.o.name.startsWith("Eye"));
    }
    play(type) {
        if (!(type in durations)) throw Error("Unknown motion " + type);
        this.type = type;
        this.elapsed = 0;
    }
    reset() {
        this.play("idle");
        this.restore();
    }
    restore() {
        this.root.position.set(0, 0, 0);
        this.root.rotation.set(0, 0, 0);
        this.root.scale.set(1, 1, 1);
        for (const p of this.parts) {
            p.o.position.copy(p.p);
            p.o.quaternion.copy(p.q);
            p.o.scale.copy(p.s);
        }
        for (const g of this.pivots) g.rotation.set(0, 0, 0);
    }
    update(dt) {
        this.time += dt;
        this.elapsed += dt;
        if (this.elapsed >= durations[this.type]) this.play("idle");
        this.restore();
        if (this.reduced) return;
        const t = this.time, k = Math.min(1, this.elapsed / durations[this.type]), pulse = Math.sin(k * Math.PI), envelope = Math.sin(k * Math.PI) ** 2;
        let y = .012 * (1 + Math.sin(t * 1.8)), rz = Math.sin(t * 1.3) * .012, sx = 1, sy = 1, arm = 0;
        if (this.type === "hello") {
            y += pulse * .055;
            rz += Math.sin(k * Math.PI * 4) * envelope * .055;
            arm = pulse * .16;
        }
        if (this.type === "curious") {
            rz += pulse * .12;
            this.root.rotation.y = pulse * .12;
            y += pulse * .035;
        }
        if (this.type === "waiting") {
            rz += Math.sin(t * 2.3) * .05;
            arm = .045 + Math.sin(t * 4.6) * .025;
        }
        if (this.type === "happy") {
            const hop = Math.max(0, Math.sin(k * Math.PI * 3));
            y += hop * .4 * envelope;
            sx += Math.sin(k * Math.PI * 6) * envelope * .06;
            sy -= Math.sin(k * Math.PI * 6) * envelope * .075;
            arm = envelope * .24;
            rz += Math.sin(k * Math.PI * 4) * envelope * .065;
        }
        if (this.type === "sad") {
            sy -= pulse * .09;
            sx += pulse * .035;
            rz += Math.sin(k * Math.PI * 2) * .035;
            arm = -pulse * .035;
        }
        if (this.type === "dress") {
            this.root.rotation.y = 2 * Math.PI * (k * k * (3 - 2 * k));
            y += pulse * .18;
            arm = pulse * .12;
        }
        if (this.type === "pet") {
            sy -= envelope * .075;
            sx += envelope * .04;
            rz += Math.sin(k * Math.PI * 6) * envelope * .05;
            arm = envelope * .05;
        }
        if (this.type === "special") {
            if (this.kind === "cat") {
                rz += Math.sin(k * Math.PI * 4) * envelope * .09;
                arm = envelope * .16;
            }
            if (this.kind === "bunny") {
                y += Math.abs(Math.sin(k * Math.PI * 3)) * envelope * .48;
                arm = envelope * .12;
            }
            if (this.kind === "sprout") {
                rz += Math.sin(k * Math.PI * 4) * envelope * .065;
                arm = envelope * .1;
            }
            if (this.kind === "wizard") {
                arm = envelope * .24;
                y += envelope * .18;
                this.root.rotation.y = Math.sin(k * Math.PI * 2) * .18;
            }
            if (this.kind === "omurice") {
                rz += Math.sin(k * Math.PI * 4) * envelope * .075;
                arm = envelope * .65;
                sy -= envelope * .025;
            }
            if (this.kind === "maid") {
                this.root.rotation.x = pulse * .28;
                arm = -pulse * .07;
                sy -= pulse * .025;
            }
        }
        this.root.position.y = y;
        this.root.rotation.z = rz;
        this.root.scale.set(sx, sy, 1);
        for (const [i, p] of this.arms.entries()) {
            p.o.position.y += arm * (this.type === "hello" ? i ? 1 : .3 : 1);
            p.o.rotation.z += (i ? -1 : 1) * arm * .8;
        }
        for (const [i, p] of this.feet.entries()) p.o.rotation.x = Math.sin(t * 2.1 + i * .8) * .018 + (this.type === "happy" ? Math.sin(k * Math.PI * 6 + i) * envelope * .15 : 0);
        const blink = t % 4.8 < .13 ? .1 : 1;
        for (const p of this.eyes) p.o.scale.y *= this.type === "pet" ? Math.max(.14, 1 - envelope * .86) : blink;
        const boost = this.type === "special" || this.type === "pet" ? 1 : 0;
        if (this.food) this.food.rotation.z = this.type === "special" ? Math.sin(k * Math.PI * 5) * envelope * .09 : Math.sin(t * 1.8) * .008;
        if (this.tail) this.tail.rotation.y = Math.sin(t * 3.1) * (.12 + boost * .38);
        if (this.ear) this.ear.rotation.z = Math.sin(t * 2.4) * (.035 + boost * .19);
        if (this.sprout) this.sprout.rotation.z = Math.sin(t * 2) * (.065 + boost * .18);
        if (this.hat) this.hat.rotation.z = Math.sin(t * 1.8) * .025 + Math.sin(k * Math.PI * 4) * envelope * boost * .07;
    }
}