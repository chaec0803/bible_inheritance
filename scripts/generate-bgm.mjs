import { mkdirSync, writeFileSync } from 'node:fs';

const sampleRate = 22050;
const seconds = 48;
const tracks = [
  { file: 'still-waters.wav', root: 146.83, chords: [[1, 1.25, 1.5], [0.75, 1, 1.25], [0.833, 1.04, 1.25], [0.667, 1, 1.2]] },
  { file: 'peaceful-morning.wav', root: 164.81, chords: [[1, 1.25, 1.5], [1.125, 1.4, 1.667], [0.833, 1.25, 1.5], [0.75, 1, 1.25]] },
  { file: 'breath-of-word.wav', root: 130.81, chords: [[1, 1.2, 1.5], [0.8, 1, 1.2], [0.667, 1, 1.25], [0.75, 1.125, 1.5]] },
];

function createTrack({ file, root, chords }) {
  const frames = sampleRate * seconds;
  const pcm = new Int16Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    const time = frame / sampleRate;
    const chord = chords[Math.floor(time / 12) % chords.length];
    const phase = time % 12;
    const fade = Math.min(1, phase / 2, (12 - phase) / 2);
    const breath = 0.82 + 0.18 * Math.sin(time * Math.PI / 4);
    let sample = 0;
    chord.forEach((ratio, index) => {
      const frequency = root * ratio;
      sample += Math.sin(2 * Math.PI * frequency * time + index * 0.7) * (0.16 / (index + 1));
      sample += Math.sin(2 * Math.PI * frequency * 2 * time + index) * (0.035 / (index + 1));
    });
    const bellStep = Math.floor(time / 3) % chord.length;
    const bellPhase = time % 3;
    sample += Math.sin(2 * Math.PI * root * chord[bellStep] * 2 * time) * Math.exp(-bellPhase * 1.8) * 0.045;
    pcm[frame] = Math.max(-32767, Math.min(32767, Math.round(sample * fade * breath * 32767)));
  }
  const bytes = Buffer.alloc(44 + pcm.byteLength);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVE', 8);
  bytes.write('fmt ', 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(pcm.byteLength, 40);
  Buffer.from(pcm.buffer).copy(bytes, 44);
  writeFileSync(new URL(`../public/bgm/${file}`, import.meta.url), bytes);
}

mkdirSync(new URL('../public/bgm', import.meta.url), { recursive: true });
tracks.forEach(createTrack);
