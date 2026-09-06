export function getSupportedMimeType() {
  return ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) ?? '';
}

export function getVoiceRecordingConstraints(): MediaStreamConstraints {
  return {
    audio: {
      // Keep the browser's speech-processing pipeline off. In particular,
      // iOS auto gain can make sustained narration sound compressed or muffled.
      autoGainControl: false,
      echoCancellation: false,
      noiseSuppression: false,
      channelCount: { ideal: 1 },
      sampleRate: { ideal: 48_000 },
      sampleSize: { ideal: 16 },
    },
  };
}

export function createAudioContextCloser(context: Pick<AudioContext, 'state' | 'close'>) {
  let closed = false;
  return () => {
    if (closed || context.state === 'closed') return;
    closed = true;
    try {
      void context.close().catch(() => undefined);
    } catch {
      // 일부 브라우저는 이미 닫힌 컨텍스트에서 동기 예외를 던집니다.
    }
  };
}

export function createRecordingAudioGraph(stream: MediaStream) {
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const destination = context.createMediaStreamDestination();
  source.connect(destination);
  return { context, source, destination, stream: destination.stream, close: createAudioContextCloser(context) };
}

export function encodeAudioBufferAsWav(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels; const length = buffer.length * channels * 2 + 44; const output = new ArrayBuffer(length); const view = new DataView(output);
  const text = (offset: number, value: string) => Array.from(value).forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, length - 8, true); text(8, 'WAVEfmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, length - 44, true);
  let offset = 44; for (let frame = 0; frame < buffer.length; frame++) for (let channel = 0; channel < channels; channel++) { const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[frame])); view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true); offset += 2; }
  return new Blob([output], { type: 'audio/wav' });
}
