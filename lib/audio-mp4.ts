const MP4_AUDIO_BITRATE = 160_000;

function sliceAudioBuffer(buffer: AudioBuffer, startMs: number, endMs: number) {
  const startFrame = Math.max(0, Math.floor((startMs / 1_000) * buffer.sampleRate));
  const endFrame = Math.min(buffer.length, Math.ceil((endMs / 1_000) * buffer.sampleRate));
  const length = Math.max(1, endFrame - startFrame);
  const sliced = new AudioBuffer({
    length,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    sliced.copyToChannel(buffer.getChannelData(channel).subarray(startFrame, endFrame), channel);
  }
  return sliced;
}

export async function encodeAudioBufferAsMp4(buffer: AudioBuffer) {
  const [media, mp3] = await Promise.all([import('mediabunny'), import('@mediabunny/mp3-encoder')]);
  const quality = new media.Quality({ bitrate: MP4_AUDIO_BITRATE, bitrateMode: 'constant' });
  if (!(await media.canEncodeAudio('mp3', {
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
    quality,
  }))) mp3.registerMp3Encoder();

  const target = new media.BufferTarget();
  const output = new media.Output({ format: new media.Mp4OutputFormat(), target });
  const source = new media.AudioBufferSource({ codec: 'mp3', quality });
  output.addAudioTrack(source);
  await output.start();
  await source.add(buffer);
  source.close();
  await output.finalize();
  if (!target.buffer) throw new Error('MP4 오디오를 완성하지 못했어요.');
  return new Blob([target.buffer], { type: 'audio/mp4' });
}

export function encodeAudioBufferSegmentAsMp4(buffer: AudioBuffer, startMs: number, endMs: number) {
  return encodeAudioBufferAsMp4(sliceAudioBuffer(buffer, startMs, endMs));
}
