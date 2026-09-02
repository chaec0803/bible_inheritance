export const BGM_TRACKS = {
  aeternum: 'bgm/aeternum.mp3',
  'unto-thee': 'bgm/unto-thee.mp3',
  'the-kings-return': 'bgm/the-kings-return.mp3',
} as const;

export type BgmTrack = keyof typeof BGM_TRACKS;

export function getBgmObjectKey(track: string) {
  return Object.prototype.hasOwnProperty.call(BGM_TRACKS, track)
    ? BGM_TRACKS[track as BgmTrack]
    : null;
}
