import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createAudioManager, normalizeAudioSettings, MUSIC_CONTEXTS, SOUND_EFFECTS } from '../src/audio/audio.mjs';

class FakeContext {
  static instances = [];
  constructor() { this.currentTime = 1; this.destination = {}; this.state = 'suspended'; this.sources = []; this.gains = []; FakeContext.instances.push(this); }
  createGain() { const node = { gain: { value: 1, cancelScheduledValues() {}, setValueAtTime(value) { this.value = value; }, linearRampToValueAtTime(value) { this.value = value; } }, connect() {}, disconnect() {} }; this.gains.push(node); return node; }
  createBufferSource() { const node = { loop: false, started: false, stopped: false, buffer: null, onended: null, connect() {}, disconnect() {}, start(when = 0, offset = 0) { this.started = true; this.offset = offset; }, stop() { this.stopped = true; this.onended?.(); } }; this.sources.push(node); return node; }
  async decodeAudioData() { return { duration: 7.68 }; }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
}
const fetcher = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(32) });
const make = extras => createAudioManager({ AudioContextClass: FakeContext, fetcher, documentRef: null, ...extras });

test('settings normalize finite volume bounds and preserve explicit mute', () => {
  assert.deepEqual(normalizeAudioSettings(), { master: .6, music: .35, sfx: .6, muted: false });
  assert.deepEqual(normalizeAudioSettings({ master: 4, music: -3, sfx: NaN, muted: true }), { master: 1, music: 0, sfx: .6, muted: true });
});

test('audio context is created only at unlock and relative assets respect a repository base', async () => {
  const count = FakeContext.instances.length; const urls = [];
  const manager = make({ baseURL: '/a-project/', fetcher: async url => { urls.push(url); return fetcher(); } });
  await manager.setContext('interior'); await manager.effect('menu');
  assert.equal(FakeContext.instances.length, count); assert.deepEqual(urls, []);
  assert.equal(await manager.unlock(), true); assert.equal(FakeContext.instances.length, count + 1);
  assert.equal(manager.getState().playing, 'interior'); assert.equal(urls[0], '/a-project/audio/music-interior.wav');
  manager.dispose();
});

test('music changes replace loops, repeated context changes do not accumulate duplicate tracks', async () => {
  const manager = make(); await manager.unlock();
  const context = FakeContext.instances.at(-1);
  await manager.setContext('battle'); await manager.setContext('battle'); await manager.setContext('boss'); await manager.setContext('puzzle');
  assert.equal(manager.getState().playing, 'puzzle');
  assert.equal(context.sources.filter(source => source.loop && source.started && !source.stopped).length, 1);
  assert.equal(context.sources.filter(source => source.loop).length, 4);
  manager.dispose(); assert.equal(context.state, 'closed');
  assert.equal(await manager.unlock(), true, 'A manager reused after StrictMode cleanup can resume through a new gesture.');
  manager.dispose();
});

test('master/music/effect gains are distinct, mute blocks effects and effect overlap is bounded', async () => {
  const manager = make(); await manager.unlock(); const context = FakeContext.instances.at(-1);
  manager.setSettings({ master: .3, music: .2, sfx: .1 });
  assert.equal(context.gains[0].gain.value, .3); assert.equal(context.gains[1].gain.value, .2); assert.equal(context.gains[2].gain.value, .1);
  for (const name of SOUND_EFFECTS) { context.currentTime += .2; await manager.effect(name); }
  assert.ok(manager.getState().activeEffects <= 6);
  manager.setSettings({ muted: true }); assert.equal(context.gains[0].gain.value, 0); assert.equal(await manager.effect('attack'), false);
  manager.setSettings({ muted: false }); assert.equal(context.gains[0].gain.value, .3);
  manager.dispose();
});

test('pause and visibility suspend playback; unlock resumes without a second context', async () => {
  let listener; const doc = { hidden: false, addEventListener(type, value) { listener = value; }, removeEventListener() { listener = null; } };
  const manager = make({ documentRef: doc }); await manager.unlock(); const context = FakeContext.instances.at(-1); const count = FakeContext.instances.length;
  doc.hidden = true; listener(); assert.equal(context.state, 'suspended'); assert.equal(manager.getState().playing, null); assert.equal(await manager.effect('attack'), false);
  doc.hidden = false; listener(); await Promise.resolve(); await Promise.resolve();
  await manager.suspend(); assert.equal(manager.getState().suspended, true);
  await manager.unlock(); assert.equal(FakeContext.instances.length, count); assert.equal(manager.getState().playing, 'village');
  manager.dispose(); assert.equal(listener, null);
});

test('missing audio files and missing browser support never reject into the UI', async () => {
  const manager = make({ fetcher: async () => { throw Error('missing'); } });
  assert.equal(await manager.unlock(), true); assert.equal(await manager.effect('attack'), false); assert.equal(manager.getState().playing, null);
  assert.match(manager.getState().lastError, /missing/); manager.dispose();
  const absent = createAudioManager({ documentRef: null }); assert.equal(await absent.unlock(), false); absent.dispose();
});

test('actual local tracks and effects are nonempty distinct PCM audio assets', async () => {
  const hashes = new Set();
  for (const name of MUSIC_CONTEXTS) {
    const bytes = await readFile(new URL(`../public/audio/music-${name}.wav`, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
    assert.equal(bytes.readUInt32LE(24), 16000); assert.ok(bytes.length > 200000);
    assert.ok(bytes.subarray(44).some(value => value !== 0)); hashes.add(createHash('sha256').update(bytes).digest('hex'));
  }
  assert.equal(hashes.size, MUSIC_CONTEXTS.length);
  for (const name of SOUND_EFFECTS) {
    const bytes = await readFile(new URL(`../public/audio/sfx-${name}.wav`, import.meta.url)); assert.ok(bytes.length > 1000); assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  }
});

test('long-form music resumes its place across scene changes and paused time', async () => {
  const manager = make(); await manager.unlock(); const context = FakeContext.instances.at(-1);
  context.currentTime = 4; await manager.setContext('interior');
  context.currentTime = 5; await manager.setContext('village');
  assert.equal(context.sources.at(-1).offset, 3, 'Village resumes the three seconds already played.');
  context.currentTime = 7; await manager.suspend(); context.currentTime = 100;
  await manager.unlock(); assert.equal(context.sources.at(-1).offset, 5, 'Paused time never advances the score.');
  manager.dispose();
});
test('long-form decoded music cache remains bounded while keeping playback offsets', async () => {
  const urls = [], manager = make({ fetcher: async url => { urls.push(url); return fetcher(); } });
  await manager.unlock(); await manager.setContext('interior'); await manager.setContext('puzzle'); await manager.setContext('boss');
  await manager.setContext('village');
  assert.equal(urls.filter(url => url.endsWith('music-village.wav')).length, 2, 'Old decoded tracks are evicted instead of retaining the full album in memory.');
  assert.equal(manager.getState().playing, 'village'); manager.dispose();
});
test('the shipped ambient score has full-length tracks with gentle unclipped boundaries', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/audio/music-manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.tracks.length, MUSIC_CONTEXTS.length);
  for (const track of manifest.tracks) {
    assert.ok(track.seconds >= 96); assert.ok(track.peak <= .5); assert.ok(track.rms > .03 && track.rms < .25);
    assert.ok(track.largestAdjacentStep < .04, 'Soft waves have no abrupt square-wave jumps.');
    const bytes = await readFile(new URL(`../public/audio/music-${track.context}.wav`, import.meta.url));
    assert.equal((bytes.length - 44) / 32000, track.seconds);
    assert.ok(Math.abs(bytes.readInt16LE(44)) < 4); assert.ok(Math.abs(bytes.readInt16LE(bytes.length - 2)) < 4);
  }
  for (const name of ['village', 'interior', 'puzzle']) assert.ok(manifest.tracks.find(track => track.context === name).seconds >= 180);
});
