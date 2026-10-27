import { createRng, randomSeed, type Rng } from '../sketch/random';
import type { BrushFrame, StepFrame } from '../stage';
import {
  SOUND,
  crackleGap,
  cutoffForBlue,
  droneLevel,
  frequencyForStep,
  grainChance,
  grainInterval,
  grainShape,
  impulseResponse,
  panForX,
  reverbLevel,
  stepForY,
} from './mapping';

/** Grains ring an octave (five scale steps) above the drone. */
const GRAIN_LIFT = 5;
/** One drone per brush, up to this many fingers. */
const MAX_VOICES = 6;
/** Seconds to slide between notes, and to follow changes in tone and loudness. */
const GLIDE = 0.08;
const SMOOTH = 0.25;
const RELEASE = 0.4;
/** Parameters follow the picture this many times a second; grains are decided every step. */
const STEER_RATE = 30;
/** Crackles are scheduled this far ahead so they keep their rhythm between frames. */
const LOOKAHEAD = 0.1;
const OPEN_CUTOFF = 16000;

interface Graph {
  ctx: AudioContext;
  /** Everything melodic goes here, then through `tone`, which dissolving muffles. */
  mix: GainNode;
  tone: BiquadFilterNode;
  master: GainNode;
  reverbSend: GainNode;
  delaySend: GainNode;
  feedback: GainNode;
  noise: AudioBuffer;
}

interface Voice {
  body: OscillatorNode;
  sub: OscillatorNode;
  air: OscillatorNode;
  shimmer: GainNode;
  filter: BiquadFilterNode;
  amp: GainNode;
  pan: StereoPannerNode;
  step: number;
  /** How much the picture changes under this brush, smoothed over a few steps. */
  change: number;
}

/**
 * Generative sound that follows the picture:
 *
 * - each brush hums a drone whose pitch is its height and whose tone is its blue;
 * - the drone swells while it lays new paint on black and settles over old paint;
 * - painted circles ring out as bell grains, panned to where the circle sits, with
 *   their red and green choosing the note and how long it rings;
 * - the fuller the picture, the bigger the room;
 * - dissolving muffles and smears everything, and the black squares crackle.
 */
export class SoundEngine {
  readonly #rng: Rng;
  #graph: Graph | null = null;
  readonly #voices = new Map<number, Voice>();
  #on = false;
  #grains = 0;
  #steeredAt = -Infinity;
  #nextCrackle = 0;

  constructor(seed = randomSeed()) {
    this.#rng = createRng(seed);
    document.addEventListener('visibilitychange', () => {
      const ctx = this.#graph?.ctx;
      if (!ctx || !this.#on) return;
      void (document.hidden ? ctx.suspend() : ctx.resume());
    });
  }

  get on(): boolean {
    return this.#on;
  }

  /** Browsers only let sound start inside a click, tap or key press, so call it from one. */
  start(): void {
    const graph = (this.#graph ??= build(this.#rng));
    this.#on = true;
    // Safari: play even with the ringer switch on silent, like a video would.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
    void graph.ctx.resume();
    graph.master.gain.setTargetAtTime(SOUND.masterGain, graph.ctx.currentTime, 0.3);
  }

  stop(): void {
    const graph = this.#graph;
    this.#on = false;
    if (!graph) return;
    graph.master.gain.setTargetAtTime(0, graph.ctx.currentTime, 0.12);
    setTimeout(() => {
      if (!this.#on) void graph.ctx.suspend();
    }, 800);
  }

  /** Called once per animation step with what was just painted. */
  update(frame: StepFrame): void {
    const graph = this.#graph;
    if (!this.#on || !graph || graph.ctx.state !== 'running') return;
    const now = graph.ctx.currentTime;
    const steer = now - this.#steeredAt >= 1 / STEER_RATE;
    if (steer) this.#steeredAt = now;

    const present = new Set<number>();
    for (const brush of frame.brushes) {
      let voice = this.#voices.get(brush.id);
      if (!voice) {
        if (this.#voices.size >= MAX_VOICES) continue;
        voice = createVoice(graph, now);
        this.#voices.set(brush.id, voice);
      }
      present.add(brush.id);
      voice.change += (brush.change - voice.change) * 0.2;
      if (steer || voice.step < 0) this.#steer(voice, brush, frame, now);
      if (this.#rng() < grainChance(voice.change)) this.#grain(graph, voice.step, brush, frame.width, now);
    }
    for (const [id, voice] of this.#voices) {
      if (present.has(id)) continue;
      releaseVoice(voice, now);
      this.#voices.delete(id);
    }

    if (steer) {
      const dissolving = frame.dissolving;
      graph.reverbSend.gain.setTargetAtTime(reverbLevel(frame.fullness), now, 0.5);
      graph.tone.frequency.setTargetAtTime(
        dissolving ? SOUND.dissolve.cutoffHz : OPEN_CUTOFF,
        now,
        dissolving ? 0.35 : 0.6,
      );
      graph.delaySend.gain.setTargetAtTime(dissolving ? 0.45 : 0.08, now, 0.3);
      graph.feedback.gain.setTargetAtTime(dissolving ? 0.6 : 0.25, now, 0.3);
    }
    if (frame.dissolving) {
      this.#nextCrackle = Math.max(this.#nextCrackle, now);
      while (this.#nextCrackle < now + LOOKAHEAD) {
        this.#crackle(graph, this.#nextCrackle);
        this.#nextCrackle += crackleGap(this.#rng);
      }
    }
  }

  #steer(voice: Voice, brush: BrushFrame, frame: StepFrame, now: number): void {
    const step = stepForY(brush.y, frame.height);
    if (step !== voice.step) {
      const f = frequencyForStep(step);
      for (const [osc, ratio] of [
        [voice.body, 1],
        [voice.sub, 0.5],
        [voice.air, 2],
      ] as const) {
        if (voice.step < 0) osc.frequency.setValueAtTime(f * ratio, now);
        else osc.frequency.setTargetAtTime(f * ratio, now, GLIDE);
      }
      voice.step = step;
    }
    const pale = brush.blue / 255;
    voice.filter.frequency.setTargetAtTime(cutoffForBlue(brush.blue) * (frame.dissolving ? 0.5 : 1), now, SMOOTH);
    voice.shimmer.gain.setTargetAtTime(0.35 * pale, now, SMOOTH);
    voice.amp.gain.setTargetAtTime(droneLevel(voice.change), now, SMOOTH);
    voice.pan.pan.setTargetAtTime(panForX(brush.x, frame.width) * 0.5, now, SMOOTH);
    // Dissolving also loosens the tuning, like a blurred image loses its edges.
    voice.body.detune.setTargetAtTime(frame.dissolving ? (this.#rng() * 2 - 1) * 30 : 0, now, 0.3);
  }

  #grain(graph: Graph, droneStep: number, brush: BrushFrame, width: number, now: number): void {
    if (this.#grains >= SOUND.grains.maxPlaying) return;
    const { ctx } = graph;
    const { x, red, green } = brush.circle;
    const f = frequencyForStep(droneStep + GRAIN_LIFT + grainInterval(red, green, this.#rng));
    const { peak, decay } = grainShape(red, green);
    const start = now + 0.01;
    const end = start + decay;

    const envelope = new GainNode(ctx, { gain: 0 });
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(peak, start + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    const pan = new StereoPannerNode(ctx, { pan: panForX(x, width) * 0.8 });
    const tone = new OscillatorNode(ctx, { frequency: f });
    // Paler circles get a brighter overtone.
    const partial = new OscillatorNode(ctx, { frequency: f * (brush.blue > 170 ? 3 : 2) });
    const partialLevel = new GainNode(ctx, { gain: 0.08 + 0.22 * (brush.blue / 255) });

    tone.connect(envelope);
    partial.connect(partialLevel).connect(envelope);
    envelope.connect(pan).connect(graph.mix);
    for (const osc of [tone, partial]) {
      osc.start(start);
      osc.stop(end + 0.05);
    }
    this.#grains++;
    tone.onended = () => {
      this.#grains--;
      pan.disconnect();
    };
  }

  /** A speck of noise for a black square. Bypasses the muffling so it stays crisp. */
  #crackle(graph: Graph, at: number): void {
    const { ctx, noise } = graph;
    const rng = this.#rng;
    const length = 0.003 + rng() * 0.01;
    const source = new AudioBufferSourceNode(ctx, { buffer: noise });
    const band = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 1500 + rng() * 4500, Q: 1.2 });
    const level = new GainNode(ctx, { gain: 0.02 + rng() * 0.07 });
    const pan = new StereoPannerNode(ctx, { pan: rng() * 2 - 1 });
    source.connect(band).connect(level).connect(pan).connect(graph.master);
    source.start(at, rng() * (noise.duration - length), length);
    source.onended = () => pan.disconnect();
  }
}

function build(rng: Rng): Graph {
  const ctx = new AudioContext({ latencyHint: 'playback' });

  const master = new GainNode(ctx, { gain: 0 });
  const limiter = new DynamicsCompressorNode(ctx, {
    threshold: -14,
    knee: 8,
    ratio: 6,
    attack: 0.005,
    release: 0.25,
  });
  master.connect(limiter).connect(ctx.destination);

  const tone = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: OPEN_CUTOFF, Q: 0.5 });
  tone.connect(master);
  const mix = new GainNode(ctx);
  mix.connect(tone);

  const reverb = new ConvolverNode(ctx);
  const channels = impulseResponse(rng, ctx.sampleRate, SOUND.reverb.seconds);
  const impulse = ctx.createBuffer(channels.length, channels[0]!.length, ctx.sampleRate);
  channels.forEach((data, i) => impulse.getChannelData(i).set(data));
  reverb.buffer = impulse;
  const reverbSend = new GainNode(ctx, { gain: reverbLevel(0) });
  mix.connect(reverbSend).connect(reverb).connect(tone);

  const delay = new DelayNode(ctx, { delayTime: 0.37, maxDelayTime: 1 });
  const feedback = new GainNode(ctx, { gain: 0.25 });
  const delaySend = new GainNode(ctx, { gain: 0.08 });
  mix.connect(delaySend).connect(delay).connect(tone);
  delay.connect(feedback).connect(delay);

  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = rng() * 2 - 1;

  return { ctx, mix, tone, master, reverbSend, delaySend, feedback, noise };
}

function createVoice(graph: Graph, now: number): Voice {
  const { ctx } = graph;
  const body = new OscillatorNode(ctx, { type: 'triangle' });
  const sub = new OscillatorNode(ctx, { type: 'sine' });
  const air = new OscillatorNode(ctx, { type: 'sine', detune: 5 });
  const subLevel = new GainNode(ctx, { gain: 0.5 });
  const shimmer = new GainNode(ctx, { gain: 0 });
  const filter = new BiquadFilterNode(ctx, { type: 'lowpass', Q: 0.7 });
  const amp = new GainNode(ctx, { gain: 0 });
  const pan = new StereoPannerNode(ctx);

  body.connect(filter);
  sub.connect(subLevel).connect(filter);
  air.connect(shimmer).connect(filter);
  filter.connect(amp).connect(pan).connect(graph.mix);
  for (const osc of [body, sub, air]) osc.start(now);
  return { body, sub, air, shimmer, filter, amp, pan, step: -1, change: 0 };
}

function releaseVoice(voice: Voice, now: number): void {
  voice.amp.gain.setTargetAtTime(0, now, RELEASE / 3);
  for (const osc of [voice.body, voice.sub, voice.air]) osc.stop(now + RELEASE * 3);
  voice.body.onended = () => voice.pan.disconnect();
}
