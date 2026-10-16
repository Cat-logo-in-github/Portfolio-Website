export const MUSIC_CONTEXTS = ['village', 'interior', 'mystery', 'puzzle', 'battle', 'boss', 'victory'];
export const SOUND_EFFECTS = ['footstep', 'interact', 'menu', 'confirm', 'collect', 'page', 'puzzle', 'unlock', 'encounter', 'attack', 'hit', 'guard', 'win', 'lose'];
export const DEFAULT_AUDIO_SETTINGS = Object.freeze({ master: .6, music: .35, sfx: .6, muted: false });
const clamp = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;

export function normalizeAudioSettings(value = {}) {
  return { master: clamp(value?.master, .6), music: clamp(value?.music, .35), sfx: clamp(value?.sfx, .6), muted: typeof value?.muted === 'boolean' ? value.muted : false };
}

/** Web Audio stays lazy: constructing/importing this manager never starts sound. */
export function createAudioManager(options = {}) {
  const baseURL = String(options.baseURL || './').replace(/\/?$/, '/');
  const fetcher = options.fetcher || ((...args) => globalThis.fetch(...args));
  const documentRef = options.documentRef === undefined ? globalThis.document : options.documentRef;
  let settings = normalizeAudioSettings(options.settings), context = null, master = null, musicGain = null, sfxGain = null;
  let desired = 'village', current = null, fading = null, ready = false, disposed = false, suspended = false, visibilitySuspended = false;
  let generation = 0, epoch = 0, requested = '', lastError = '';
  const cache = new Map(), sfx = new Set(), lastEffect = new Map(), musicPositions = new Map();
  const now = () => context?.currentTime || 0;
  const gain = (node, value, fade = .04) => {
    if (!node?.gain) return;
    try { node.gain.cancelScheduledValues?.(now()); node.gain.setValueAtTime?.(node.gain.value, now()); if (node.gain.linearRampToValueAtTime) node.gain.linearRampToValueAtTime(value, now() + fade); else node.gain.value = value; } catch { node.gain.value = value; }
  };
  const applySettings = () => { gain(master, settings.muted ? 0 : settings.master); gain(musicGain, settings.music); gain(sfxGain, settings.sfx); };
  const stopVoice = (voice, fade = 0) => {
    if (!voice) return;
    if (voice.name && !voice.stopped && voice.duration > 0) {
      musicPositions.set(voice.name, (voice.offset + Math.max(0, now() - voice.startedAt)) % voice.duration);
      voice.stopped = true;
    }
    try { if (fade) gain(voice.node, 0, fade); voice.source.stop(now() + fade); } catch { /* A source may already have ended. */ }
    if (!fade) { try { voice.source.disconnect?.(); voice.node?.disconnect?.(); } catch {} }
  };
  async function buffer(name, music) {
    const filename = `${music ? 'music' : 'sfx'}-${name}.wav`;
    if (cache.has(filename)) {
      const value = cache.get(filename); cache.delete(filename); cache.set(filename, value); return value;
    }
    const promise = (async () => {
      try {
        const response = await fetcher(`${baseURL}audio/${filename}`);
        if (!response?.ok) throw Error(`Audio file could not load: ${filename}`);
        const bytes = await response.arrayBuffer();
        if (!context || disposed) return null;
        return await context.decodeAudioData(bytes.slice(0));
      } catch (error) { lastError = error?.message || 'Audio is unavailable.'; return null; }
    })();
    cache.set(filename, promise);
    // Long-form tracks decode to larger buffers. Keep only two music assets cached.
    if (music) for (const key of [...cache.keys()].filter(key => key.startsWith('music-'))) {
      if ([...cache.keys()].filter(key => key.startsWith('music-')).length <= 2) break;
      if (key !== filename && key !== `music-${current?.name}.wav`) cache.delete(key);
    }
    return promise;
  }
  async function playMusic() {
    if (!ready || disposed || suspended || visibilitySuspended || !context) return;
    if (current?.name === desired || requested === desired) return;
    const target = desired, token = ++generation; requested = target;
    const decoded = await buffer(target, true);
    if (token !== generation || disposed || suspended || visibilitySuspended || !decoded || !context) { if (token === generation) requested = ''; return; }
    stopVoice(fading); fading = current;
    if (fading) stopVoice(fading, .75);
    try {
      const source = context.createBufferSource(), node = context.createGain();
      source.buffer = decoded; source.loop = true; node.gain.value = 0; source.connect(node); node.connect(musicGain);
      const duration = Number.isFinite(decoded.duration) && decoded.duration > 0 ? decoded.duration : 0;
      const offset = duration ? (musicPositions.get(target) || 0) % duration : 0;
      const voice = { source, node, name: target, duration, offset, startedAt: now(), stopped: false };
      source.onended = () => { if (fading === voice) fading = null; try { source.disconnect?.(); node.disconnect?.(); } catch {} };
      current = voice; requested = ''; source.start(0, offset); gain(node, 1, .75);
    } catch (error) { requested = ''; lastError = error?.message || 'Audio playback is unavailable.'; }
  }
  const stopMusic = () => { generation++; requested = ''; stopVoice(current); stopVoice(fading); current = null; fading = null; };
  const stopEffects = () => { for (const voice of sfx) stopVoice(voice); sfx.clear(); };
  const visibility = () => {
    if (!context || !ready || disposed) return;
    if (documentRef?.hidden) { visibilitySuspended = true; stopMusic(); stopEffects(); Promise.resolve(context.suspend?.()).catch(() => {}); }
    else if (visibilitySuspended) { visibilitySuspended = false; if (!suspended) Promise.resolve(context.resume?.()).then(playMusic).catch(() => {}); }
  };
  return {
    async unlock() {
      // React StrictMode can clean up an effect and then reuse this manager.
      if (disposed) disposed = false;
      const session = epoch;
      try {
        if (!context) {
          const Constructor = options.AudioContextClass || globalThis.AudioContext || globalThis.webkitAudioContext;
          if (!Constructor) { lastError = 'This browser does not provide Web Audio.'; return false; }
          context = new Constructor(); master = context.createGain(); musicGain = context.createGain(); sfxGain = context.createGain();
          musicGain.connect(master); sfxGain.connect(master); master.connect(context.destination); applySettings();
          documentRef?.addEventListener?.('visibilitychange', visibility);
        }
        suspended = false; visibilitySuspended = Boolean(documentRef?.hidden);
        if (visibilitySuspended) return false;
        await context.resume?.(); if (disposed || session !== epoch) return false; ready = true; await playMusic(); return true;
      } catch (error) { lastError = error?.message || 'Audio could not start.'; return false; }
    },
    setContext(name) {
      const alias = { archive: 'interior', dangerous: 'mystery', encounter: 'battle', story: 'victory' };
      const next = alias[name] || name;
      desired = MUSIC_CONTEXTS.includes(next) ? next : 'village';
      return playMusic();
    },
    async effect(name) {
      const aliases = { interaction: 'interact', inspection: 'interact', journal: 'page', success: 'puzzle', door: 'unlock', victory: 'win', defeat: 'lose' };
      name = aliases[name] || name;
      if (!SOUND_EFFECTS.includes(name) || !ready || disposed || suspended || visibilitySuspended || settings.muted || !settings.master || !settings.sfx) return false;
      const time = now();
      if (time - (lastEffect.get(name) ?? -100) < (name === 'footstep' ? .17 : .06)) return false;
      lastEffect.set(name, time);
      const session = epoch;
      const decoded = await buffer(name, false);
      if (!decoded || !context || suspended || visibilitySuspended || disposed || settings.muted || session !== epoch) return false;
      try {
        if (sfx.size >= 6) { const oldest = sfx.values().next().value; stopVoice(oldest); sfx.delete(oldest); }
        const source = context.createBufferSource(), node = context.createGain(); source.buffer = decoded; source.connect(node); node.connect(sfxGain); node.gain.value = name === 'footstep' ? .25 : .65;
        const voice = { source, node }; sfx.add(voice);
        source.onended = () => { sfx.delete(voice); try { source.disconnect?.(); node.disconnect?.(); } catch {} };
        source.start(); return true;
      } catch { return false; }
    },
    setSettings(value) { settings = normalizeAudioSettings({ ...settings, ...value }); applySettings(); return { ...settings }; },
    getSettings() { return { ...settings }; },
    getState() { return { ready, suspended: suspended || visibilitySuspended, context: desired, playing: current?.name || null, activeEffects: sfx.size, lastError, disposed }; },
    suspend() { suspended = true; stopMusic(); stopEffects(); if (context) return Promise.resolve(context.suspend?.()).catch(() => {}); return Promise.resolve(); },
    dispose() { if (disposed) return; epoch++; disposed = true; ready = false; stopMusic(); stopEffects(); cache.clear(); lastEffect.clear(); musicPositions.clear(); documentRef?.removeEventListener?.('visibilitychange', visibility); if (context) Promise.resolve(context.close?.()).catch(() => {}); context = null; master = null; musicGain = null; sfxGain = null; }
  };
}

export const audio = createAudioManager();
