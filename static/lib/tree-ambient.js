const CHORDS = {
    Am: [ 57, 60, 64 ],
    F: [ 53, 57, 60 ],
    C: [ 60, 64, 67 ],
    G: [ 55, 59, 62 ],
    Em: [ 52, 55, 59 ],
    Dm: [ 50, 53, 57 ]
};

const PROGS = [ [ "Am", "F", "C", "G" ], [ "F", "G", "Am", "Am" ], [ "Am", "Em", "F", "G" ], [ "C", "G", "Am", "F" ] ];

const SECTIONS = [ "intro", "A", "B", "B2", "A", "B", "B2", "break" ];

const MOTIFS = [ [ [ 0, 2, 0 ], [ 2, 1, 1 ], [ 3, 1, 2 ], [ 4, 4, 1 ], [ 8, 2, 2 ], [ 10, 2, 1 ], [ 12, 4, 0 ] ], [ [ 1, 1, 0 ], [ 2, 2, 1 ], [ 4, 2, 2 ], [ 6, 2, 3 ], [ 8, 3, 2 ], [ 11, 1, 1 ], [ 12, 4, 0 ] ], [ [ 0, 3, 2 ], [ 3, 1, 1 ], [ 4, 4, 0 ], [ 8, 2, 1 ], [ 10, 2, 2 ], [ 12, 2, 3 ], [ 14, 2, 2 ] ] ];

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

const LONELY_CHORDS = [ [ 57, 64, 71, 72 ], [ 53, 60, 64, 69 ], [ 52, 60, 67, 74 ], [ 52, 59, 62, 67 ], [ 50, 57, 64, 65 ] ];

const LONELY_ORDER = [ 0, 1, 2, 3, 0, 1, 4, 3 ];

const LONELY_SECTIONS = [ "voice", "still", "voice", "voice", "still", "voice", "still", "still" ];

const LONELY_VOICE = [ 62, 64, 67, 69, 72, 74, 76 ];

export const AMBIENT_DEFAULTS = {
    style: "lonely",
    volume: .5,
    tempo: 1,
    brightness: .5,
    arp: .6,
    melody: .6,
    sparkle: .4,
    echo: .4,
    motion: .6,
    pad: 0
};

export function createTreeAmbient(initial = {}) {
    const P = {
        ...AMBIENT_DEFAULTS,
        ...initial
    };
    let ctx = null, out = null, bright = null, arpBus = null, melBus = null, starBus = null, padBus = null, echoIn = null, analyser = null;
    let nextBarAt = 0, barN = 0, loopTimer = 0, playing = false, startedStyle = null;
    let lArp = null, lMel = null, lStar = null, lPad = null, lEcho = null, nextPhraseBar = 0;
    const counts = {
        bars: 0,
        arpNotes: 0,
        melodyNotes: 0,
        stars: 0,
        padChords: 0,
        rolls: 0,
        phrases: 0,
        calls: 0,
        sections: {}
    };
    const CALL = (() => {
        const hi = [ 76, 79, 81 ][Math.floor(Math.random() * 3)], leap = hi - (Math.random() < .5 ? 5 : 7);
        const tail = LONELY_VOICE.reduce((a, b) => Math.abs(b - (leap + 2)) < Math.abs(a - (leap + 2)) ? b : a);
        return [ [ 0, 1.5, hi ], [ 1.5, 1, leap ], [ 2.5, 2.5, tail ] ];
    })();
    const rnd = Math.random;
    const beat = () => 60 / ((P.style === "forest" ? 72 : 54) * Math.max(.5, Math.min(1.6, P.tempo)));
    function impulse(c, seconds = 3.2, decay = 3) {
        const len = Math.floor(c.sampleRate * seconds), buf = c.createBuffer(2, len, c.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
        return buf;
    }
    function panned(node, amount) {
        if (!ctx.createStereoPanner) return node;
        const p = ctx.createStereoPanner();
        p.pan.value = amount;
        node.connect(p);
        return p;
    }
    function send(from, to, amount) {
        const g = ctx.createGain();
        g.gain.value = amount;
        from.connect(g);
        g.connect(to);
        return g;
    }
    function build(c) {
        ctx = c;
        out = c.createGain();
        out.gain.value = 0;
        bright = c.createBiquadFilter();
        bright.type = "lowpass";
        bright.Q.value = .3;
        const hp = c.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 160;
        hp.Q.value = .5;
        const makeup = c.createGain();
        makeup.gain.value = 3.2;
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.knee.value = 12;
        comp.ratio.value = 3;
        comp.attack.value = .02;
        comp.release.value = .4;
        analyser = c.createAnalyser();
        analyser.fftSize = 1024;
        out.connect(bright);
        bright.connect(hp);
        hp.connect(makeup);
        makeup.connect(comp);
        comp.connect(analyser);
        analyser.connect(c.destination);
        const verb = c.createConvolver();
        verb.buffer = impulse(c);
        const wet = c.createGain();
        wet.gain.value = .5;
        verb.connect(wet);
        wet.connect(out);
        echoIn = c.createGain();
        echoIn.gain.value = P.echo;
        const echoOut = c.createGain();
        echoOut.gain.value = .5;
        const dL = c.createDelay(3), dR = c.createDelay(3);
        dL.delayTime.value = beat() * .75;
        dR.delayTime.value = beat();
        const tone = c.createBiquadFilter();
        tone.type = "lowpass";
        tone.frequency.value = 2200;
        const fbA = c.createGain(), fbB = c.createGain();
        fbA.gain.value = .32;
        fbB.gain.value = .32;
        echoIn.connect(dL);
        panned(dL, -.7).connect(echoOut);
        panned(dR, .7).connect(echoOut);
        dL.connect(tone);
        tone.connect(fbA);
        fbA.connect(dR);
        dR.connect(fbB);
        fbB.connect(dL);
        echoOut.connect(out);
        arpBus = c.createGain();
        arpBus.connect(out);
        send(arpBus, verb, .35);
        send(arpBus, echoIn, .25);
        melBus = c.createGain();
        melBus.connect(out);
        send(melBus, verb, .5);
        send(melBus, echoIn, .6);
        starBus = c.createGain();
        send(starBus, out, .6);
        starBus.connect(verb);
        starBus.connect(echoIn);
        padBus = c.createGain();
        padBus.connect(out);
        send(padBus, verb, .6);
        const verbLong = c.createConvolver();
        verbLong.buffer = impulse(c, 7, 2);
        const wetL = c.createGain();
        wetL.gain.value = .6;
        verbLong.connect(wetL);
        wetL.connect(out);
        lEcho = c.createGain();
        lEcho.gain.value = P.echo;
        const lOut = c.createGain();
        lOut.gain.value = .5;
        const lb = 60 / 54, eL = c.createDelay(5), eR = c.createDelay(5);
        eL.delayTime.value = lb * 1.5;
        eR.delayTime.value = lb * 2;
        const lTone = c.createBiquadFilter();
        lTone.type = "lowpass";
        lTone.frequency.value = 1200;
        const lfA = c.createGain(), lfB = c.createGain();
        lfA.gain.value = .42;
        lfB.gain.value = .42;
        lEcho.connect(eL);
        panned(eL, -.8).connect(lOut);
        panned(eR, .8).connect(lOut);
        eL.connect(lTone);
        lTone.connect(lfA);
        lfA.connect(eR);
        eR.connect(lfB);
        lfB.connect(eL);
        lOut.connect(out);
        lOut.connect(verbLong);
        lArp = c.createGain();
        send(lArp, out, .6);
        send(lArp, verbLong, .8);
        send(lArp, lEcho, .35);
        lMel = c.createGain();
        lMel.connect(out);
        send(lMel, verbLong, .7);
        send(lMel, lEcho, .7);
        lStar = c.createGain();
        send(lStar, out, .3);
        lStar.connect(verbLong);
        send(lStar, lEcho, .8);
        lPad = c.createGain();
        lPad.connect(out);
        send(lPad, verbLong, .9);
        applyTone();
    }
    function applyTone() {
        if (ctx) bright.frequency.setTargetAtTime(P.style === "forest" ? 1800 + P.brightness * 8e3 : 1400 + P.brightness * 3600, ctx.currentTime, .5);
    }
    function mallet(bus, at, m, peak, decay = 1.3, pan = 0) {
        const f = mtof(m), car = ctx.createOscillator(), mod = ctx.createOscillator(), modAmt = ctx.createGain(), g = ctx.createGain();
        car.type = "sine";
        car.frequency.value = f;
        mod.type = "sine";
        mod.frequency.value = f * 3.5;
        modAmt.gain.setValueAtTime(f * .6, at);
        modAmt.gain.exponentialRampToValueAtTime(f * .01, at + .15);
        mod.connect(modAmt);
        modAmt.connect(car.frequency);
        car.connect(g);
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(peak, at + .006);
        g.gain.exponentialRampToValueAtTime(1e-4, at + decay);
        panned(g, pan).connect(bus);
        car.start(at);
        mod.start(at);
        car.stop(at + decay + .05);
        mod.stop(at + decay + .05);
    }
    function flute(at, m, len, peak) {
        const f = mtof(m), o = ctx.createOscillator(), o2 = ctx.createOscillator(), h = ctx.createGain(), g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = f;
        o2.type = "sine";
        o2.frequency.value = f * 2;
        h.gain.value = .12;
        o.connect(g);
        o2.connect(h);
        h.connect(g);
        const end = at + len * .92, rel = .35;
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(peak, at + .03);
        g.gain.linearRampToValueAtTime(peak * .75, at + Math.max(.06, len * .5));
        g.gain.setValueAtTime(peak * .75, end);
        g.gain.exponentialRampToValueAtTime(1e-4, end + rel);
        panned(g, .1).connect(melBus);
        o.start(at);
        o2.start(at);
        o.stop(end + rel + .05);
        o2.stop(end + rel + .05);
        counts.melodyNotes++;
    }
    function padChord(at, notes, len, bus = padBus, oct = 12) {
        notes.forEach((m, i) => {
            const o = ctx.createOscillator(), g = ctx.createGain(), lvl = .05 * P.pad / Math.sqrt(notes.length);
            o.type = "sine";
            o.frequency.value = mtof(m + oct);
            g.gain.setValueAtTime(0, at);
            g.gain.linearRampToValueAtTime(lvl, at + len * .3);
            g.gain.setValueAtTime(lvl, at + len * .7);
            g.gain.exponentialRampToValueAtTime(1e-4, at + len + 1.5);
            o.connect(g);
            panned(g, (i - 1) * .3).connect(bus);
            o.start(at);
            o.stop(at + len + 1.6);
        });
        counts.padChords++;
    }
    function scheduleBar(at) {
        const step = beat() / 2, barLen = step * 8;
        const block = Math.floor(barN / 8), barIdx = barN % 8, half = barIdx % 2;
        const prog = PROGS[Math.floor(block / 2) % PROGS.length];
        const name = prog[Math.floor(barIdx / 2)], ch = CHORDS[name];
        const section = P.motion > .3 ? SECTIONS[block % SECTIONS.length] : "B";
        if (barIdx === 0) counts.sections[section] = (counts.sections[section] || 0) + 1;
        const [r, t, f] = ch;
        if (P.arp > .01 && section !== "break") {
            const pat = section === "intro" ? [ [ 0, r ], [ 4, f ] ] : half === 0 ? [ [ 0, r ], [ 2, f ], [ 3, r + 12 ], [ 5, t + 12 ], [ 6, f ] ] : [ [ 0, r ], [ 2, t ], [ 4, f ], [ 6, r + 12 ] ];
            for (const [s, m] of pat) {
                mallet(arpBus, at + s * step, m, .05 * P.arp * (s === 0 ? 1 : .72), 1.3, -.15);
                counts.arpNotes++;
            }
        }
        if (P.melody > .01 && half === 0 && (section === "B" || section === "B2")) {
            const motif = MOTIFS[Math.floor(block / 2) % MOTIFS.length], tones = [ r + 12, t + 12, f + 12, r + 24 ];
            const lastChord = barIdx === 6;
            motif.forEach(([s, len, ti], k) => {
                let idx = ti;
                if (section === "B2" && s >= 8 && k % 2 === 0) idx = Math.min(3, ti + 1);
                if (lastChord && k === motif.length - 1) {
                    idx = 0;
                    len = 6;
                }
                flute(at + s * step, tones[idx], len * step, .055 * P.melody);
            });
        }
        if (section === "break" && half === 0) [ r, t, f, r + 12 ].forEach((m, i) => mallet(arpBus, at + i * step * .5, m + 12, .035 * Math.max(P.arp, .4), 2.6, (i - 1.5) * .3));
        if (P.sparkle > .01 && (section === "A" || section === "B2" || section === "break")) {
            for (const s of [ 1, 3, 5, 7 ]) {
                if (rnd() < P.sparkle * .35 * (section === "break" ? 1.5 : 1)) {
                    mallet(starBus, at + s * step, [ r, t, f ][Math.floor(rnd() * 3)] + 24, .03 + rnd() * .015, 2.2, (rnd() * 2 - 1) * .7);
                    counts.stars++;
                }
            }
        }
        if (P.pad > .01 && half === 0) padChord(at, ch, barLen * 2);
        counts.bars++;
        barN++;
        return at + barLen;
    }
    function voice(at, m, len, peak) {
        const f = mtof(m), o = ctx.createOscillator(), o3 = ctx.createOscillator(), h = ctx.createGain(), g = ctx.createGain();
        const vib = ctx.createOscillator(), vibAmt = ctx.createGain();
        o.type = "sine";
        o.frequency.value = f;
        o3.type = "sine";
        o3.frequency.value = f * 3;
        h.gain.value = 0;
        vib.frequency.value = 4.6;
        vibAmt.gain.setValueAtTime(0, at);
        vibAmt.gain.linearRampToValueAtTime(5, at + Math.min(len, 1.2));
        vib.connect(vibAmt);
        vibAmt.connect(o.detune);
        vibAmt.connect(o3.detune);
        o.connect(g);
        o3.connect(h);
        h.connect(g);
        const rel = 1.4, end = at + len;
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(peak, at + .28);
        g.gain.setValueAtTime(peak, end);
        g.gain.exponentialRampToValueAtTime(1e-4, end + rel);
        panned(g, (rnd() * 2 - 1) * .25).connect(lMel);
        for (const x of [ o, o3, vib ]) {
            x.start(at);
            x.stop(end + rel + .05);
        }
        counts.melodyNotes++;
    }
    function bell(bus, at, m, peak, decay, pan, far) {
        const f = mtof(m), car = ctx.createOscillator(), mod = ctx.createOscillator(), modAmt = ctx.createGain(), g = ctx.createGain();
        car.type = "sine";
        car.frequency.value = f;
        mod.type = "sine";
        mod.frequency.value = f * 2;
        modAmt.gain.setValueAtTime(f * .08, at);
        modAmt.gain.exponentialRampToValueAtTime(f * .002, at + .3);
        mod.connect(modAmt);
        modAmt.connect(car.frequency);
        car.connect(g);
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(peak, at + (far ? .1 : .035));
        g.gain.exponentialRampToValueAtTime(1e-4, at + decay);
        let node = g;
        if (far) {
            const lp = ctx.createBiquadFilter();
            lp.type = "lowpass";
            lp.frequency.value = 1600;
            g.connect(lp);
            node = lp;
        }
        panned(node, pan).connect(bus);
        car.start(at);
        mod.start(at);
        car.stop(at + decay + .05);
        mod.stop(at + decay + .05);
    }
    function scheduleLonelyBar(at) {
        const b = beat(), barLen = b * 4;
        const block = Math.floor(barN / 8), barIdx = barN % 8, half = barIdx % 2;
        const ch = LONELY_CHORDS[LONELY_ORDER[Math.floor(barN / 2) % LONELY_ORDER.length]];
        const section = P.motion > .3 ? LONELY_SECTIONS[block % LONELY_SECTIONS.length] : "voice";
        if (barIdx === 0) counts.sections[section] = (counts.sections[section] || 0) + 1;
        const up = ch.map(m => m < 60 ? m + 12 : m).sort((a, c) => a - c);
        if (P.arp > .01 && half === 0 && rnd() < (section === "voice" ? .7 : .35)) {
            up.forEach((m, i) => bell(lArp, at + i * .3, m, .04 * P.arp, 4.8, (i - 1.5) * .35, false));
            counts.rolls++;
            counts.arpNotes += up.length;
        }
        if (P.pad > .01 && half === 0 && rnd() < .7) padChord(at, ch, barLen * 1.6, lPad, 12);
        if (P.melody > .01 && section === "voice" && barN >= nextPhraseBar) {
            let notes;
            if (rnd() < .5) {
                notes = CALL;
                counts.calls++;
            } else {
                const n = 2 + Math.floor(rnd() * 2);
                let t = rnd() < .5 ? 0 : .5, prev = LONELY_VOICE[Math.floor(rnd() * LONELY_VOICE.length)];
                notes = [];
                for (let k = 0; k < n; k++) {
                    const len = k === n - 1 ? 2.5 + rnd() : 1 + rnd() * 1.2;
                    notes.push([ t, len, prev ]);
                    t += len;
                    const leap = [ 5, 7, -5, -7, 2, -2, 3, -3 ][Math.floor(rnd() * 8)];
                    prev = LONELY_VOICE.reduce((a, c) => Math.abs(c - (prev + leap)) < Math.abs(a - (prev + leap)) ? c : a);
                }
            }
            notes.forEach(([off, len, m]) => voice(at + off * b, m, len * b, .05 * P.melody));
            counts.phrases++;
            nextPhraseBar = barN + 3 + Math.floor(rnd() * 3);
        }
        if (P.sparkle > .01) for (const beatPos of [ 1.5, 3.5 ]) {
            if (rnd() < P.sparkle * .22 * (section === "still" ? 1.6 : 1)) {
                const m = Math.min(88, up[Math.floor(rnd() * up.length)] + 12);
                bell(lStar, at + beatPos * b, m, .018 + rnd() * .01, 5.5, (rnd() * 2 - 1) * .85, true);
                counts.stars++;
            }
        }
        counts.bars++;
        barN++;
        return at + barLen;
    }
    function scheduleUntil(t) {
        while (nextBarAt < t) nextBarAt = P.style === "forest" ? scheduleBar(nextBarAt) : scheduleLonelyBar(nextBarAt);
    }
    return {
        params: P,
        get playing() {
            return playing;
        },
        get context() {
            return ctx;
        },
        stats() {
            return JSON.parse(JSON.stringify(counts));
        },
        async start() {
            if (!ctx) {
                const C = window.AudioContext || window.webkitAudioContext;
                build(new C);
            }
            if (ctx.state !== "running") await ctx.resume();
            if (playing) return;
            playing = true;
            const t = ctx.currentTime;
            if (startedStyle !== P.style) {
                startedStyle = P.style;
                barN = 0;
                nextBarAt = 0;
                nextPhraseBar = 0;
            }
            nextBarAt = Math.max(nextBarAt, t + .1);
            if (barN === 0) barN = P.style === "forest" ? 16 : 0;
            out.gain.cancelScheduledValues(t);
            out.gain.setValueAtTime(out.gain.value, t);
            out.gain.linearRampToValueAtTime(P.volume, t + 2);
            clearInterval(loopTimer);
            loopTimer = setInterval(() => {
                if (playing) scheduleUntil(ctx.currentTime + 4);
            }, 400);
            scheduleUntil(t + 4);
        },
        stop() {
            if (!ctx || !playing) return;
            playing = false;
            clearInterval(loopTimer);
            const t = ctx.currentTime;
            out.gain.cancelScheduledValues(t);
            out.gain.setValueAtTime(out.gain.value, t);
            out.gain.linearRampToValueAtTime(0, t + 1.5);
            setTimeout(() => {
                if (!playing) ctx.suspend();
            }, 1700);
        },
        set(k, v) {
            P[k] = v;
            if (!ctx) return;
            if (k === "volume" && playing) out.gain.setTargetAtTime(v, ctx.currentTime, .15);
            if (k === "brightness" || k === "style") applyTone();
            if (k === "echo") {
                echoIn.gain.setTargetAtTime(v, ctx.currentTime, .2);
                lEcho.gain.setTargetAtTime(v, ctx.currentTime, .2);
            }
        },
        level() {
            if (!analyser) return 0;
            const a = new Float32Array(analyser.fftSize);
            analyser.getFloatTimeDomainData(a);
            let s = 0;
            for (const x of a) s += x * x;
            return Math.sqrt(s / a.length);
        },
        renderOffline(offlineCtx, seconds) {
            build(offlineCtx);
            out.gain.value = P.volume;
            nextBarAt = .05;
            barN = 0;
            nextPhraseBar = 0;
            startedStyle = P.style;
            scheduleUntil(seconds);
            return offlineCtx.startRendering();
        }
    };
}