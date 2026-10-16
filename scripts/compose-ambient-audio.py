"""Rebuild the original V4 ambient music. Optional authoring dependency: NumPy.

This is not part of the site build: the finished WAVs are committed local assets.
No samples, commercial melodies, percussion loops or external services are used.
"""
from pathlib import Path
import json
import math
import wave
import numpy as np

OUT = Path(__file__).resolve().parents[1] / 'public' / 'audio'
RATE = 16000
BAR = 6.0
TRACKS = {
    'village': ('A Slow Morning', 192, [(50, 0), (45, 0), (47, 1), (43, 0), (50, 0), (43, 0), (47, 1), (45, 0)]),
    'interior': ('Lamplight and Pages', 192, [(48, 0), (43, 0), (45, 1), (41, 0), (48, 0), (45, 1), (41, 0), (43, 0)]),
    'mystery': ('The Glasshouse at Dusk', 144, [(45, 1), (41, 0), (48, 0), (43, 0), (45, 1), (48, 0), (41, 0), (43, 0)]),
    'puzzle': ('Small Discoveries', 192, [(43, 0), (50, 0), (47, 1), (48, 0), (43, 0), (48, 0), (50, 0), (43, 0)]),
    'battle': ('A Friendly Disagreement', 96, [(40, 1), (43, 0), (48, 0), (45, 1), (40, 1), (48, 0), (43, 0), (45, 1)]),
    'boss': ('A Question, Gently Asked', 96, [(38, 1), (41, 0), (46, 0), (43, 1), (38, 1), (46, 0), (41, 0), (45, 1)]),
    'victory': ('Room for Tomorrow', 96, [(41, 0), (48, 0), (50, 1), (46, 0), (41, 0), (46, 0), (48, 0), (41, 0)]),
}

def hz(midi):
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)

def layer(mix, at, duration, midi, amplitude, mode='pad', phase=0):
    start = int(at * RATE)
    end = min(len(mix), start + int(duration * RATE))
    if start >= end:
        return
    t = np.arange(end - start, dtype=np.float64) / RATE
    frequency = hz(midi)
    if mode == 'pad':
        attack = np.sin(np.minimum(t / 1.8, 1) * math.pi / 2) ** 2
        release = np.sin(np.minimum(np.maximum(duration - t, 0) / 2.4, 1) * math.pi / 2) ** 2
        tone = (.76 * np.sin(math.tau * frequency * t + phase)
                + .17 * np.sin(math.tau * frequency * 1.0012 * t + phase + .6)
                + .07 * np.sin(math.tau * frequency * 2 * t + phase))
        envelope = attack * release * (.91 + .09 * np.sin(math.tau * .10 * t + phase))
    else:
        envelope = (1 - np.exp(-t / .045)) * np.exp(-t / 1.25)
        envelope *= np.minimum(np.maximum(duration - t, 0) / .3, 1)
        tone = (np.sin(math.tau * frequency * t)
                + .10 * np.sin(math.tau * frequency * 2 * t) * np.exp(-t / .8)
                + .025 * np.sin(math.tau * frequency * 3 * t) * np.exp(-t / .4))
    mix[start:end] += (tone * envelope * amplitude).astype(np.float32)

def compose(index, name, title, seconds, progression):
    rng = np.random.default_rng(41000 + index * 173)
    mix = np.zeros(seconds * RATE, dtype=np.float32)
    for bar in range(seconds // int(BAR)):
        root, minor = progression[bar % len(progression)]
        third = 3 if minor else 4
        # Four voiced tones breathe across bar boundaries; later passages invert them.
        voicing = [0, 7, 12 + third, 14] if bar // 8 % 2 == 0 else [7, 12, third, 9]
        strength = .040 + .006 * math.sin(bar * .47)
        for voice, interval in enumerate(voicing):
            layer(mix, bar * BAR + voice * .045, 8.4, root + interval, strength / (1 + voice * .12), phase=voice * .31)
        layer(mix, bar * BAR, 7.6, root - 12, .027)
        # Sparse, original pentatonic/chord-tone gestures with rests and small variations.
        if bar % 8 != 7:
            choices = [0, third, 7, 9, 12]
            for beat in range(2 if bar % 4 in [0, 2] else 1):
                if rng.random() < .12:
                    continue
                at = bar * BAR + 1.0 + beat * 2.7 + float(rng.uniform(-.08, .08))
                note = root + choices[int(rng.integers(0, len(choices)))]
                level = float(rng.uniform(.045, .066))
                layer(mix, at, 4.5, note, level, 'felt')
                layer(mix, at + .72, 4.0, note, level * .17, 'felt')
    timeline = np.arange(len(mix), dtype=np.float32) / RATE
    mix *= np.minimum(timeline / 1.6, 1) * np.minimum((seconds - timeline) / 3.0, 1)
    mix *= .38 / max(float(np.max(np.abs(mix))), .001)
    pcm = np.round(np.clip(mix, -1, 1) * 32767).astype('<i2')
    target = OUT / f'music-{name}.wav'
    with wave.open(str(target), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())
    return {'context': name, 'title': title, 'seconds': seconds, 'sampleRate': RATE,
            'peak': round(float(np.max(np.abs(mix))), 5), 'rms': round(float(np.sqrt(np.mean(mix * mix))), 5),
            'largestAdjacentStep': round(float(np.max(np.abs(np.diff(mix)))), 5), 'bytes': target.stat().st_size}

if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = [compose(index, context, *spec) for index, (context, spec) in enumerate(TRACKS.items())]
    (OUT / 'music-manifest.json').write_text(json.dumps({'version': 4, 'style': 'slow ambient pads and soft felt keys; no percussion', 'tracks': manifest}, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(manifest))
