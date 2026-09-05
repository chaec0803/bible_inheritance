'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Mic, Pause, Play, RotateCcw } from 'lucide-react';
import { GIFT_LETTER_AUDIO_MAX_SECONDS, GIFT_LETTER_TEXT_MAX_LENGTH, type GiftLetterInput } from '@/lib/gift-letter';
import { createRecordingAudioGraph, getSupportedMimeType } from '@/lib/recording-audio';

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('음성 편지를 읽지 못했어요.'));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function GiftLetterComposer({ value, disabled, onChange }: { value: GiftLetterInput; disabled?: boolean; onChange: (letter: GiftLetterInput) => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [voiceCandidate, setVoiceCandidate] = useState<Extract<GiftLetterInput, { type: 'voice' }> | null>(null);
  const [selectedType, setSelectedType] = useState<GiftLetterInput['type']>(value.type);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const closeGraphRef = useRef<(() => void) | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);

  useEffect(() => () => {
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    closeGraphRef.current?.();
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      const elapsed = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      setSeconds(elapsed);
      if (elapsed >= GIFT_LETTER_AUDIO_MAX_SECONDS) recorderRef.current?.stop();
    }, 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  const selectType = (type: GiftLetterInput['type']) => {
    if (recording) recorderRef.current?.stop();
    setError('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setVoiceCandidate(null);
    setSelectedType(type);
    onChange(type === 'text' ? { type, text: '' } : { type: 'none' });
  };

  const startVoice = async () => {
    setError('');
    setVoiceCandidate(null);
    onChange({ type: 'none' });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const graph = createRecordingAudioGraph(stream);
      const recorder = new MediaRecorder(graph.stream, { mimeType: getSupportedMimeType() || undefined });
      chunksRef.current = [];
      streamRef.current = stream;
      closeGraphRef.current = graph.close;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        const durationSeconds = Math.max(1, Math.min(GIFT_LETTER_AUDIO_MAX_SECONDS, Math.round((Date.now() - startedAtRef.current) / 1000)));
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        stream.getTracks().forEach((track) => track.stop());
        graph.close();
        streamRef.current = null;
        closeGraphRef.current = null;
        setRecording(false);
        if (!blob.size) return setError('음성 편지가 녹음되지 않았어요. 다시 시도해 주세요.');
        if (blob.size > 5 * 1024 * 1024) return setError('음성 편지가 너무 커요. 90초 안으로 다시 녹음해 주세요.');
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        setVoiceCandidate({ type: 'voice', dataUrl: await blobToDataUrl(blob), mimeType: blob.type, sizeBytes: blob.size, durationSeconds });
      };
      startedAtRef.current = Date.now();
      setSeconds(0);
      recorder.start(1000);
      setRecording(true);
    } catch {
      setError('마이크를 사용할 수 없어요. 권한을 확인해 주세요.');
    }
  };

  const mode = selectedType;
  return <section className="gift-letter-composer" aria-labelledby="gift-letter-title">
    <div><p className="eyebrow">A NOTE WITH YOUR GIFT</p><h3 id="gift-letter-title">편지 덧붙이기 <small>선택</small></h3><p>말씀과 함께 전하고 싶은 마음이 있나요?</p></div>
    <div className="gift-letter-types">
      <button className={mode === 'none' ? 'selected' : ''} type="button" disabled={disabled || recording} onClick={() => selectType('none')}>편지 없이</button>
      <button className={mode === 'text' ? 'selected' : ''} type="button" disabled={disabled || recording} onClick={() => selectType('text')}><FileText size={16} /> 텍스트 편지</button>
      <button className={mode === 'voice' ? 'selected' : ''} type="button" disabled={disabled || recording} onClick={() => selectType('voice')}><Mic size={16} /> 음성 편지</button>
    </div>
    {value.type === 'text' && <label className="gift-letter-text"><span>짧은 편지</span><textarea rows={4} maxLength={GIFT_LETTER_TEXT_MAX_LENGTH} disabled={disabled} value={value.text} placeholder="말씀을 선물하는 마음을 적어 주세요." onChange={(event) => onChange({ type: 'text', text: event.currentTarget.value })} /><small>{value.text.length}/{GIFT_LETTER_TEXT_MAX_LENGTH}</small></label>}
    {recording && <div className="gift-letter-recording"><span><Mic size={18} /> 녹음 중 · {seconds}초 / {GIFT_LETTER_AUDIO_MAX_SECONDS}초</span><button type="button" onClick={() => recorderRef.current?.stop()}><Pause size={16} /> 녹음 마치기</button></div>}
    {mode === 'voice' && !recording && !previewUrl && <div className="gift-letter-voice-ready"><div><Mic size={19} /><span><strong>짧은 음성 편지를 남겨 보세요</strong><small>최대 {GIFT_LETTER_AUDIO_MAX_SECONDS}초까지 녹음할 수 있어요.</small></span></div><button type="button" disabled={disabled} onClick={() => void startVoice()}><Mic size={16} /> 녹음 시작</button></div>}
    {mode === 'voice' && previewUrl && <div className="gift-letter-preview"><strong>{value.type === 'voice' ? '음성 편지를 확정했어요' : '음성 편지가 준비됐어요'}</strong>{/* oxlint-disable-next-line jsx-a11y/media-has-caption -- 사용자가 방금 녹음한 음성 편지에는 별도 자막 파일이 없습니다. */}<audio controls src={previewUrl} /><div><button type="button" disabled={disabled} onClick={() => void startVoice()}><RotateCcw size={15} /> 재녹음</button>{voiceCandidate && value.type !== 'voice' && <button type="button" disabled={disabled} onClick={() => onChange(voiceCandidate)}><Play size={15} /> 음성 편지 확정</button>}</div><span><Play size={14} /> 재생해 본 뒤 확정해 주세요.</span></div>}
    {error && <small className="gift-letter-error" role="alert">{error}</small>}
  </section>;
}
