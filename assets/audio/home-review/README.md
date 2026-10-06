# House ambience auditions — 6 October 2026

Three original, synthesized 48-second stereo WAV loops for Leonard to review.
They are standalone auditions; the game does not import them.

**Approved direction:** Leonard chose `04-soft-ac-hum.wav`: steady low motor hum with a little filtered airflow, no birds, rain, or music. It averages -44 dBFS, 18 dB below the earlier samples. Regenerate this audition with `python3 tools/build-home-ambience.py --ac-only`. The game now synthesizes this direction live in `src/three/HomeAmbience.tsx`, approximately matching the audition's level, with gain/fade settings in `HOME.ambience`. The WAV itself is not shipped. Final in-game listening feedback is pending.

1. **Sunlit room:** soft indoor airflow, slightly brighter window air, and occasional distant synthesized birds. Environmental ambience, no music.
2. **Rain at the window:** sheltered steady rain with small scattered glass taps over a low room bed. No thunder or music. An alternative mood rather than a reflection of the town's current sunny weather.
3. **Soft keys at home:** sparse, rounded electric-key notes and slowly overlapping warm chords over quiet room air. Musical ambience without percussion.

Rendered at 44.1 kHz, stereo, 16-bit PCM. All three average -26 dBFS with peaks near -12 dBFS so comparison does not favour the loudest sample. Start at a comfortable listening volume; in-game gain can be tuned after selection.

Regenerate with `python3 tools/build-home-ambience.py` (NumPy required). The deterministic seed reproduces all three mixes. Periodic noise and circular placement of sounds/reflections keep the loops continuous. `render-report.json` records levels, clipping counts, and boundary differences. Numerical checks passed; listening approval is pending.

The selected AC direction starts on the first home visit, retries audio unlock on pointer/key gestures, fades on entry/exit, and suspends outside the room or while the tab is hidden. Build, focused lint, and mocked audio/state lifecycle checks pass; in-game listening remains the final check on timbre and loudness.
