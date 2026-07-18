export class AmbientAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.running = false;
    this._stingerTimer = null;
    this._targetVolume = 0.9;
  }

  _ensureContext() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    this._buildDrone();
    this._buildNoiseBed();
  }

  _buildDrone() {
    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.16;
    droneGain.connect(this.master);

    const freqs = [55, 58.5, 41];
    this._droneVoices = freqs.map((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i === 2 ? 'sine' : 'triangle';
      osc.frequency.value = f;

      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 300;
      filt.Q.value = 0.7;

      osc.connect(filt);
      filt.connect(droneGain);
      osc.start();

      const detuneLfo = this.ctx.createOscillator();
      detuneLfo.frequency.value = 0.04 + Math.random() * 0.07;
      const detuneLfoGain = this.ctx.createGain();
      detuneLfoGain.gain.value = 3 + Math.random() * 5;
      detuneLfo.connect(detuneLfoGain);
      detuneLfoGain.connect(osc.detune);
      detuneLfo.start();

      const filterLfo = this.ctx.createOscillator();
      filterLfo.frequency.value = 0.015 + Math.random() * 0.02;
      const filterLfoGain = this.ctx.createGain();
      filterLfoGain.gain.value = 120 + Math.random() * 80;
      filterLfo.connect(filterLfoGain);
      filterLfoGain.connect(filt.frequency);
      filterLfo.start();

      return { osc, filt, detuneLfo, filterLfo };
    });
  }

  _buildNoiseBed() {
    const bufferSize = 4 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 350;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;

    src.connect(filt);
    filt.connect(gain);
    gain.connect(this.master);
    src.start();

    this._noiseSrc = src;
  }

  _scheduleStinger() {
    const delay = 9000 + Math.random() * 20000;
    this._stingerTimer = setTimeout(() => {
      if (this.running) this._playStinger();
      this._scheduleStinger();
    }, delay);
  }

  _playStinger() {
    const now = this.ctx.currentTime;
    const kind = Math.floor(Math.random() * 3);
    if (kind === 0) this._stingerCreak(now);
    else if (kind === 1) this._stingerLowSwell(now);
    else this._stingerMetallic(now);
  }

  _stingerCreak(now) {
    const dur = 1.2 + Math.random() * 1.5;
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.value = 8 + Math.random() * 6;
    const startFreq = 130 + Math.random() * 90;
    const endFreq = 340 + Math.random() * 220;
    filt.frequency.setValueAtTime(startFreq, now);
    filt.frequency.exponentialRampToValueAtTime(endFreq, now + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1 + Math.random() * 0.08, now + dur * 0.3);
    gain.gain.linearRampToValueAtTime(0, now + dur);

    src.connect(filt);
    filt.connect(gain);
    gain.connect(this.master);
    src.start(now);
    src.stop(now + dur);
  }

  _stingerLowSwell(now) {
    const dur = 3 + Math.random() * 3;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const baseFreq = 28 + Math.random() * 22;
    const drift = 0.7 + Math.random() * 0.7;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.linearRampToValueAtTime(baseFreq * drift, now + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.13, now + dur * 0.4);
    gain.gain.linearRampToValueAtTime(0, now + dur);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + dur);
  }

  _stingerMetallic(now) {
    const dur = 0.5 + Math.random() * 0.4;
    const base = 130 + Math.random() * 100;
    [1, 1.2 + Math.random() * 0.25, 1.8 + Math.random() * 0.35].forEach((mult, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base * mult;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.035 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + dur);
    });
  }

  // Heavy stone dragging across rough ground, used when a maze wall shifts.
  // kind: 'rise' (a wall grinding up out of the floor) or 'fall' (a wall
  // grinding down and away) — biases the pitch drift direction and thuds.
  // delay: seconds from now to schedule the start, so it can be synced with
  // a staggered visual animation instead of always firing immediately.
  playMazeShift(kind = 'rise', delay = 0) {
    if (!this.ctx || !this.running) return;
    const startAt = this.ctx.currentTime + Math.max(0, delay);
    this._stoneScrape(startAt, kind);
  }

  _stoneScrape(now, kind) {
    const dir = kind === 'fall' ? -1 : 1;
    const dur = 1.3 + Math.random() * 0.9;

    // Rough, gritty noise bed — brownish noise so it reads as coarse stone
    // rather than a hiss, run through a swept bandpass to suggest the
    // uneven friction of dragging a heavy block.
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.4 * white) / 1.4;
      data[i] = lastOut * 3.4;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const grit = this.ctx.createBiquadFilter();
    grit.type = 'bandpass';
    grit.Q.value = 1.1 + Math.random() * 0.6;
    const baseFreq = 150 + Math.random() * 60;
    grit.frequency.setValueAtTime(baseFreq, now);
    const steps = 6 + Math.floor(Math.random() * 4);
    for (let s = 1; s <= steps; s++) {
      const t = now + (dur * s) / steps;
      const drift = dir * (s / steps) * (60 + Math.random() * 40);
      const wobble = (Math.random() - 0.5) * 70;
      grit.frequency.linearRampToValueAtTime(Math.max(60, baseFreq + drift + wobble), t);
    }

    // Uneven, grainy amplitude — lots of short jagged ramps instead of a
    // smooth swell, so it catches and stutters like stone on stone.
    const scrapeGain = this.ctx.createGain();
    scrapeGain.gain.setValueAtTime(0, now);
    scrapeGain.gain.linearRampToValueAtTime(0.001, now + 0.02);
    const grains = 16 + Math.floor(Math.random() * 10);
    for (let g = 1; g <= grains; g++) {
      const t = now + (dur * g) / grains;
      const level = 0.05 + Math.random() * 0.1;
      scrapeGain.gain.linearRampToValueAtTime(level, Math.max(now, t - dur / grains / 2));
      scrapeGain.gain.linearRampToValueAtTime(level * 0.35, t);
    }
    scrapeGain.gain.linearRampToValueAtTime(0, now + dur);

    // Low mass rumble underneath, tracking the same directional drift.
    const rumble = this.ctx.createOscillator();
    rumble.type = 'sine';
    const rumbleStart = 34 + Math.random() * 10;
    rumble.frequency.setValueAtTime(rumbleStart, now);
    rumble.frequency.linearRampToValueAtTime(Math.max(18, rumbleStart + dir * 10), now + dur);
    const rumbleGain = this.ctx.createGain();
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.linearRampToValueAtTime(0.1, now + dur * 0.3);
    rumbleGain.gain.linearRampToValueAtTime(0, now + dur);

    // Initial thud as the block breaks static friction and starts moving.
    const startThud = this.ctx.createOscillator();
    startThud.type = 'sine';
    startThud.frequency.setValueAtTime(kind === 'fall' ? 68 : 92, now);
    startThud.frequency.exponentialRampToValueAtTime(28, now + 0.25);
    const startThudGain = this.ctx.createGain();
    startThudGain.gain.setValueAtTime(0.001, now);
    startThudGain.gain.linearRampToValueAtTime(0.24, now + 0.015);
    startThudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    // Settling thud as it comes to rest in its new position.
    const settleAt = now + dur - 0.06;
    const settleThud = this.ctx.createOscillator();
    settleThud.type = 'sine';
    settleThud.frequency.setValueAtTime(kind === 'fall' ? 52 : 78, settleAt);
    settleThud.frequency.exponentialRampToValueAtTime(24, settleAt + 0.3);
    const settleThudGain = this.ctx.createGain();
    settleThudGain.gain.setValueAtTime(0.001, settleAt);
    settleThudGain.gain.linearRampToValueAtTime(0.2, settleAt + 0.02);
    settleThudGain.gain.exponentialRampToValueAtTime(0.001, settleAt + 0.35);

    src.connect(grit);
    grit.connect(scrapeGain);
    scrapeGain.connect(this.master);

    rumble.connect(rumbleGain);
    rumbleGain.connect(this.master);

    startThud.connect(startThudGain);
    startThudGain.connect(this.master);

    settleThud.connect(settleThudGain);
    settleThudGain.connect(this.master);

    src.start(now);
    src.stop(now + dur);
    rumble.start(now);
    rumble.stop(now + dur);
    startThud.start(now);
    startThud.stop(now + 0.32);
    settleThud.start(settleAt);
    settleThud.stop(settleAt + 0.4);
  }

  start() {
    this._ensureContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.running = true;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(this._targetVolume, now + 2.5);
    if (!this._stingerTimer) this._scheduleStinger();
  }

  pause() {
    this.running = false;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + 0.4);
  }

  resume() {
    if (!this.ctx) {
      this.start();
      return;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.running = true;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(this._targetVolume, now + 0.6);
  }

  dispose() {
    this.running = false;
    if (this._stingerTimer) clearTimeout(this._stingerTimer);
    if (this.ctx) this.ctx.close();
  }
}