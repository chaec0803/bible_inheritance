import { toAudibleBgmGain } from './audio-volume';

type GiftMp3Options = {
  title: string;
  voiceUrls: string[];
  bgmUrl: string | null;
  bgmVolume: number;
};

const OUTPUT_SAMPLE_RATE = 44_100;

export function getGiftMixDuration(durations: number[]) {
  return durations.reduce((total, duration) => total + Math.max(0, duration), 0);
}

export function getGiftDownloadName(title: string) {
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || '말씀선물';
  return `${safeTitle}-말씀선물.mp3`;
}

async function fetchAndDecode(context: BaseAudioContext, url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('선물 음성을 불러오지 못했어요.');
  return context.decodeAudioData(await response.arrayBuffer());
}

async function renderGiftMix(voiceUrls: string[], bgmUrl: string | null, bgmVolume: number) {
  const decodeContext = new AudioContext();
  try {
    const voiceBuffers: AudioBuffer[] = [];
    for (const url of voiceUrls) voiceBuffers.push(await fetchAndDecode(decodeContext, url));
    if (!voiceBuffers.length) throw new Error('MP3로 만들 녹음이 없어요.');
    const bgmBuffer = bgmUrl ? await fetchAndDecode(decodeContext, bgmUrl) : null;
    const duration = getGiftMixDuration(voiceBuffers.map((buffer) => buffer.duration));
    const offline = new OfflineAudioContext(2, Math.max(1, Math.ceil(duration * OUTPUT_SAMPLE_RATE)), OUTPUT_SAMPLE_RATE);

    let cursor = 0;
    for (const buffer of voiceBuffers) {
      const source = offline.createBufferSource();
      source.buffer = buffer;
      source.connect(offline.destination);
      source.start(cursor);
      cursor += buffer.duration;
    }

    if (bgmBuffer && bgmVolume > 0) {
      const bgmSource = offline.createBufferSource();
      const bgmGain = offline.createGain();
      bgmSource.buffer = bgmBuffer;
      bgmSource.loop = true;
      bgmGain.gain.value = toAudibleBgmGain(bgmVolume);
      bgmSource.connect(bgmGain).connect(offline.destination);
      bgmSource.start(0);
      bgmSource.stop(duration);
    }

    return await offline.startRendering();
  } finally {
    await decodeContext.close();
  }
}

export async function createGiftMp3(options: GiftMp3Options) {
  const renderedAudio = await renderGiftMix(options.voiceUrls, options.bgmUrl, options.bgmVolume);
  const [media, mp3] = await Promise.all([import('mediabunny'), import('@mediabunny/mp3-encoder')]);
  const quality = new media.Quality({ bitrate: 192_000, bitrateMode: 'constant' });
  if (!(await media.canEncodeAudio('mp3', { numberOfChannels: 2, sampleRate: OUTPUT_SAMPLE_RATE, quality })))
    mp3.registerMp3Encoder();

  const target = new media.BufferTarget();
  const output = new media.Output({ format: new media.Mp3OutputFormat(), target });
  const source = new media.AudioBufferSource({
    codec: 'mp3',
    quality,
  });
  output.addAudioTrack(source);
  await output.start();
  await source.add(renderedAudio);
  source.close();
  await output.finalize();
  if (!target.buffer) throw new Error('MP3 파일을 완성하지 못했어요.');
  return {
    blob: new Blob([target.buffer], { type: 'audio/mpeg' }),
    filename: getGiftDownloadName(options.title),
  };
}
