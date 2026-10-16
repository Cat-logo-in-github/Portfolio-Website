# Original World of Work audio

The V4 score contains seven original slow ambient compositions, using soft sustained pads and sparse felt-key gestures without percussion. They replace V3's short motifs. No commercial-game recording, sample, character theme or third-party melody is used. The optional authoring script is `scripts/compose-ambient-audio.py` (Python + NumPy); it is not needed to build or host the site.

| File | Title | Duration |
| --- | --- | --- |
| `music-village.wav` | A Slow Morning | 3:12 |
| `music-interior.wav` | Lamplight and Pages | 3:12 |
| `music-mystery.wav` | The Glasshouse at Dusk | 2:24 |
| `music-puzzle.wav` | Small Discoveries | 3:12 |
| `music-battle.wav` | A Friendly Disagreement | 1:36 |
| `music-boss.wav` | A Question, Gently Asked | 1:36 |
| `music-victory.wav` | Room for Tomorrow | 1:36 |

The score totals **16 minutes 48 seconds**, approximately 32.3 MB of uncompressed files. All files are mono, 16-bit PCM WAV at 16 kHz. Tracks vary their voicings and original seeded melodies over slow six-second bars, fade at loop boundaries, and leave headroom below clipping. `music-manifest.json` records durations and waveform measurements. Fourteen retained short effects cover footsteps, interaction, menu, confirmation, collection, pages, puzzle success, unlocking, encounter reveal, attack, hit, guard, victory and defeat.

The files are offered under **CC0 1.0 Universal**, to the extent permitted by law. You may copy, modify, distribute, and use them without attribution or royalties. License: https://creativecommons.org/publicdomain/zero/1.0/

The central manager starts after a user gesture, fetches only requested audio, retains at most two decoded music files in its cache, limits effect overlap, and crossfades context changes. Returning to a music context resumes its playhead instead of restarting. Pause and hidden tabs suspend playback without advancing the score. Music, effects, master volume and mute have separate controls. A playing/fading voice can temporarily retain an additional buffer during a transition.

Automated checks cover actual file formats, lengths, distinct content, amplitude/boundary bounds, and manager behavior. The composition is intended for relaxed extended play; no listening or real-device autoplay test is claimed.
