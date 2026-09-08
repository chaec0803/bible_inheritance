import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
function tone(seconds: number) {
  const rate=16000, samples=rate*seconds, wav=Buffer.alloc(44+samples*2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length-8,4); wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(rate,24); wav.writeUInt32LE(rate*2,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34);
  wav.write('data',36); wav.writeUInt32LE(samples*2,40);
  for(let i=0;i<samples;i++) wav.writeInt16LE(Math.round(Math.sin(i*440*2*Math.PI/rate)*1000),44+i*2);
  return wav;
}


for (const surface of ['received', 'preview'] as const) test(`gift BGM signal: ${surface}`, async ({page}) => {
  await page.addInitScript(() => {
    // oxlint-disable-next-line typescript/unbound-method -- explicitly rebound with call(this) below
    const original = AudioContext.prototype.createBufferSource;
    const probes: AnalyserNode[] = [];
    (window as unknown as { bgmSignal: () => number }).bgmSignal = () => Math.max(0, ...probes.map(probe => {
      const samples = new Float32Array(probe.fftSize);
      probe.getFloatTimeDomainData(samples);
      return Math.max(...samples.map(Math.abs));
    }));
    AudioContext.prototype.createBufferSource = function() {
      const source = original.call(this);
      const connect = source.connect.bind(source);
      source.connect = ((target: AudioNode) => {
        const result = connect(target);
        const probe = this.createAnalyser();
        const mute = this.createGain();
        mute.gain.value = 0;
        target.connect(probe); probe.connect(mute); mute.connect(this.destination);
        probes.push(probe);
        return result;
      }) as typeof source.connect;
      return source;
    };
  });

  const audio = tone(7);
  const items = [0,1].map(position => ({ position, book:'창세기', chapter:1, verse:position+1, verseText:'테스트 본문', recorded:true, durationSeconds:7 }));
  const draft = {id:'qa-draft',title:'QA 선물',bgmId:'still-waters',bgmVolume:30,nextPosition:null,items};
  await page.route('**/api/user-state', r=>r.fulfill({json:{state:null}}));
  await page.route('**/api/recordings', r=>r.fulfill({json:{recordings:[]}}));
  await page.route('**/api/friends', r=>r.fulfill({json:{friends:[]}}));
  await page.route('**/api/gift-drafts', r=>r.fulfill({json:{drafts:[draft]}}));
  await page.route('**/api/gifts', r=>r.fulfill({json:{gifts:[{id:'qa-gift',title:'QA 선물',senderNickname:'테스트',bgmId:'still-waters',bgmVolume:30,recordingCount:2,totalSizeBytes:audio.length*2,createdAt:Date.now(),openedAt:Date.now(),hasLetter:false,recordings:items}],sentGifts:[]}}));
  await page.route('**/api/gifts/*/audio/*', r=>r.fulfill({contentType:'audio/wav',body:audio}));
  await page.route('**/api/gift-drafts/*/items/*/audio', r=>r.fulfill({contentType:'audio/wav',body:audio}));
  await page.route('**/api/bgm/**', r=>r.fulfill({contentType:'audio/mpeg',body:readFileSync(`${process.env.BGM_QA_DIR ?? '/private/tmp'}/aeternum.mp3`)}));
  await page.goto('/');
  await expect(page.getByText('무엇을 선택할까요?')).toBeVisible();
  await page.goto(surface === 'received' ? '/#gifts' : '/#gift-studio');
  if (surface === 'received') {
    await page.getByRole('button').filter({has:page.getByRole('heading',{name:'QA 선물'})}).click();
    await page.getByRole('button',{name:'들어보기',exact:true}).click();
  } else {
    await page.getByRole('button').filter({hasText:'QA 선물'}).first().click();
    await page.getByRole('button',{name:'전체 미리 듣기',exact:true}).click();
  }
  const signal = () => page.evaluate(() => (window as unknown as {bgmSignal:()=>number}).bgmSignal());
  await expect.poll(signal).toBeGreaterThan(0.00001);
  const pause = surface === 'received' ? page.getByRole('dialog').getByRole('button',{name:'일시정지',exact:true}) : page.getByRole('button',{name:'미리 듣기 일시정지',exact:true});
  await pause.click();
  await expect.poll(signal).toBeLessThan(0.00001);
  const resume = surface === 'received' ? page.getByRole('dialog').getByRole('button',{name:'계속 듣기',exact:true}) : page.getByRole('button',{name:'전체 미리 듣기',exact:true});
  await resume.click();
  await expect.poll(signal).toBeGreaterThan(0.00001);
  // Wait for native playback of the second verse, while music remains audible.
  await expect.poll(()=>page.locator('audio').evaluateAll((elements: HTMLAudioElement[]) => elements.some(el => (el.src.includes('/audio/1') || el.src.includes('/items/1/audio')) && el.currentTime > 0.1)),{timeout:12000}).toBe(true);
  await expect.poll(signal).toBeGreaterThan(0.00001);
});
