"""Render original house ambience auditions with NumPy, no sample downloads.

Run: python3 tools/build-home-ambience.py
Outputs: assets/audio/home-review/*.wav (48 s, stereo, 44.1 kHz).
Noise is periodic; events and their room reflections wrap around the loop.
These are review assets, not imported by the game.
"""
from pathlib import Path
import argparse
import json
import wave

import numpy as np

RATE = 44100
SECONDS = 48
N = RATE * SECONDS
OUT = Path(__file__).resolve().parents[1] / 'assets/audio/home-review'
RNG = np.random.default_rng(61006)
TIME = np.arange(N) / RATE
FREQ = np.fft.rfftfreq(N, 1 / RATE)


def noise(low, high, slope=0.0):
    """Smooth band-limited periodic noise, unit RMS."""
    f = np.maximum(FREQ, 1)
    shape = (1 - np.exp(-(f / low) ** 4)) * np.exp(-(f / high) ** 4)
    shape *= f ** (-slope / 2)
    spectrum = (RNG.normal(size=len(f)) + 1j * RNG.normal(size=len(f))) * shape
    spectrum[0] = 0
    spectrum[-1] = spectrum[-1].real
    y = np.fft.irfft(spectrum, n=N)
    return y / np.sqrt(np.mean(y * y))


def stereo_bed(level, low, high, slope=1):
    common = noise(low, high, slope)
    side = noise(low, high, slope)
    # Integer cycles ensure breathing returns to exactly the same phase.
    breathe = 0.86 + 0.09 * np.sin(2 * np.pi * TIME / 24) + 0.05 * np.cos(2 * np.pi * TIME / 16)
    return level * breathe[:, None] * np.column_stack((common + 0.2 * side, common - 0.2 * side))


def add_event(mix, signal, start, pan=0, reflections=False):
    gains = np.array([np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)])
    indices = (int(start * RATE) + np.arange(len(signal))) % N
    mix[indices] += signal[:, None] * gains
    if reflections:
        for delay, gain in [(0.081, 0.14), (0.143, 0.09), (0.229, 0.055), (0.367, 0.03)]:
            mix[(indices + int(delay * RATE)) % N] += signal[:, None] * gains[::-1] * gain


def bird(mix, start, pan, base=1850):
    # Soft distant whistle phrases rather than foreground tweeting.
    for i in range(3):
        duration = 0.15 + RNG.uniform(0.04, 0.12)
        t = np.arange(int(duration * RATE)) / RATE
        frequency = base + 250 * np.sin(np.pi * t / duration) + 55 * np.sin(2 * np.pi * 17 * t)
        phase = np.cumsum(frequency) * (2 * np.pi / RATE)
        env = np.sin(np.pi * t / duration) ** 2
        signal = 0.016 * env * (np.sin(phase) + 0.045 * np.sin(2 * phase))
        add_event(mix, signal, start + i * 0.28, pan, True)


def note(mix, start, midi, level, pan):
    t = np.arange(7 * RATE) / RATE
    hz = 440 * 2 ** ((midi - 69) / 12)
    # Soft electric-key timbre: rounded attack, no sharp metallic upper partials.
    env = (1 - np.exp(-t / 0.045)) * np.exp(-t / 1.6)
    end = np.clip((7 - t) / 0.5, 0, 1)
    signal = level * env * end * (
        np.sin(2 * np.pi * hz * t)
        + 0.22 * np.exp(-t / 0.8) * np.sin(2 * np.pi * 2 * hz * t)
        + 0.07 * np.exp(-t / 0.4) * np.sin(2 * np.pi * 3 * hz * t)
    )
    add_event(mix, signal, start, pan, True)
    # Diffuse, darker trails; circular placement preserves notes at the seam.
    for delay, gain in [(0.47, 0.17), (0.83, 0.11), (1.31, 0.055)]:
        add_event(mix, signal, start + delay, -pan * 0.7, False)


def save(name, mix, description, rms_dbfs=-26):
    # Common listening level, with a peak limit; no silence at the loop boundary.
    target_rms = 10 ** (rms_dbfs / 20)
    mix *= min(target_rms / np.sqrt(np.mean(mix * mix)), 0.32 / np.max(np.abs(mix)))
    pcm = np.round(np.clip(mix, -1, 1) * 32767).astype('<i2')
    path = OUT / (name + '.wav')
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())
    delta = np.abs(np.diff(mix, axis=0))
    seam = float(np.max(np.abs(mix[0] - mix[-1])))
    # A seam must be comparable to ordinary adjacent samples, not a click.
    assert seam < float(np.quantile(delta, 0.999)), (name, seam)
    report = dict(file=path.name, description=description, seconds=SECONDS,
                  sample_rate=RATE, channels=2,
                  rms_dbfs=round(float(20 * np.log10(np.sqrt(np.mean(mix * mix)))), 2),
                  peak_dbfs=round(float(20 * np.log10(np.max(np.abs(mix)))), 2),
                  seam_delta=round(seam, 7), clipping_samples=int(np.sum(np.abs(mix) >= 1)))
    print(json.dumps(report))
    return report


def render_ac():
    OUT.mkdir(parents=True, exist_ok=True)
    # A small indoor fan: low motor harmonics under filtered, soft air.
    # Narrow stereo image and very little variation keep it unobtrusive.
    air = noise(70, 620, 1.4)
    side = noise(90, 460, 1.5)
    breathe = 1 + 0.015 * np.sin(2 * np.pi * TIME / 24)
    motor = (np.sin(2 * np.pi * 100 * TIME)
             + 0.20 * np.sin(2 * np.pi * 200 * TIME)
             + 0.08 * np.sin(2 * np.pi * 300 * TIME))
    bed = breathe * (0.68 * air + 0.72 * motor)
    mix = np.column_stack((bed + 0.035 * side, bed - 0.035 * side))
    report = save('04-soft-ac-hum', mix,
        'Revised direction: barely-there steady AC motor hum and soft filtered airflow only.',
        rms_dbfs=-44)
    (OUT / 'ac-render-report.json').write_text(json.dumps(report, indent=2) + '\n')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    reports = []

    afternoon = stereo_bed(0.021, 65, 510, 1.2)
    afternoon += stereo_bed(0.006, 300, 1500, 0.7)
    for start, pan, base in [(4, -0.5, 1620), (17.3, 0.35, 2090), (32.5, -0.2, 1760), (42, 0.5, 1960)]:
        bird(afternoon, start, pan, base)
    reports.append(save('01-sunlit-room', afternoon,
        'Environmental: soft indoor airflow with occasional distant birds through the glass; no music.'))

    rain = stereo_bed(0.011, 55, 400, 1.4)
    rain += stereo_bed(0.025, 180, 3600, 0.9)
    rain += stereo_bed(0.005, 900, 5700, 0.2)
    # Small scattered taps on glass, varied in size and stereo position.
    for start in RNG.uniform(0, SECONDS, 170):
        duration = 0.10
        t = np.arange(int(duration * RATE)) / RATE
        hz = RNG.uniform(750, 2100)
        env = (1 - np.exp(-t / 0.0015)) * np.exp(-t / RNG.uniform(0.009, 0.022))
        signal = RNG.uniform(0.009, 0.025) * env * (
            0.75 * RNG.normal(size=len(t)) + 0.25 * np.sin(2 * np.pi * hz * t))
        # Smooth the impact's noise so it doesn't become sharp white clicks.
        signal = np.convolve(signal, np.ones(7) / 7, mode='same')
        add_event(rain, signal, start, RNG.uniform(-0.8, 0.8))
    reports.append(save('02-rain-at-the-window', rain,
        'Environmental: sheltered steady rain, gentle glass taps and a low room bed; no thunder or music.'))

    evening = stereo_bed(0.005, 65, 580, 1.2)
    # Slowly overlapping Fmaj9 / Am7 / Cmaj9 / Gsus2 pads, no percussion.
    for start, chord in [(0, [53, 57, 60, 64]), (12, [45, 55, 60, 64]),
                         (24, [48, 55, 59, 62]), (36, [43, 57, 62, 67])]:
        t = np.arange(20 * RATE) / RATE
        env = np.sin(np.pi * t / 20) ** 2
        pad = np.zeros_like(t)
        for midi in chord:
            hz = 440 * 2 ** ((midi - 69) / 12)
            pad += np.sin(2 * np.pi * hz * t) + 0.11 * np.sin(2 * np.pi * hz * 2 * t)
        add_event(evening, 0.006 * env * pad, start - 4, -0.25, True)
    for start, midi, pan in [(1.2, 72, -0.2), (5, 76, 0.3), (10, 67, -0.1),
                             (15.8, 71, 0.25), (20.4, 64, -0.3), (26, 74, 0.1),
                             (30.5, 71, -0.25), (35.2, 67, 0.25),
                             (39.7, 69, -0.1), (45.8, 74, 0.2)]:
        note(evening, start, midi, 0.027, pan)
    reports.append(save('03-soft-keys-at-home', evening,
        'Musical: sparse rounded electric-key notes and warm slow chords over soft room air; no beat.'))
    (OUT / 'render-report.json').write_text(json.dumps(reports, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ac-only', action='store_true', help='Render only the quieter revised AC audition.')
    args = parser.parse_args()
    if args.ac_only:
        render_ac()
    else:
        main()
