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

for(const scenario of [{volume:0,bgmWorks:false,track:'Aeternum'},{volume:30,bgmWorks:false,track:'Aeternum'},{volume:30,bgmWorks:true,track:'Aeternum'},{volume:30,bgmWorks:true,track:'Unto Thee'},{volume:30,bgmWorks:true,track:"The King's Return"}]) test(`voice continues with BGM ${scenario.bgmWorks ? 'available' : 'failed'} at ${scenario.volume}% ${scenario.track}`, async ({page}) => {
  const {volume,bgmWorks}=scenario;
  const errors: string[]=[];
  page.on('pageerror', error=>errors.push(error.message));
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
  const audio=tone(6);
  await page.route('**/api/user-state', route=>route.fulfill({json:{state:null}}));
  await page.route('**/api/recordings', route=>route.fulfill({json:{recordings:[1,2].map(verse=>({id:`audio-fixture-${verse}`,projectId:'free-recording',projectTitle:'자유 녹음',book:'창세기',chapter:1,verse,verseText:`테스트 ${verse}절`,bgmId:'still-waters',mimeType:'audio/wav',sizeBytes:audio.length,durationSeconds:6,createdAt:Date.now()}))}}));
  await page.route('**/api/recordings/*/audio', route=>route.fulfill({contentType:'audio/wav',body:audio}));
  await page.route('**/api/bgm/**', route => {
    const track = new URL(route.request().url()).pathname.split('/').pop();
    const real = process.env.BGM_QA_DIR;
    return route.fulfill(bgmWorks ? {contentType:real ? 'audio/mpeg' : 'audio/wav',body:real ? readFileSync(`${real}/${track}.mp3`) : audio} : {status:404,body:'missing BGM fixture'});
  });
  await page.goto('/');
  await expect(page.getByText('무엇을 선택할까요?')).toBeVisible();
  await page.goto('/#library');
  const start=page.getByRole('button',{name:'전체 이어듣기',exact:true});
  await expect(start).toBeVisible();
  await page.locator('.library-bgm-picker').getByRole('button', {name: scenario.track, exact: true}).click();
  await page.getByLabel('이어듣기 배경음악 음량').fill(String(volume));
  await start.click();
  const bank=page.locator('.chapter-audio-bank audio');
  await expect.poll(()=>bank.nth(0).evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0.1);
  if(bgmWorks) {
    await expect.poll(() => page.evaluate(() => (window as unknown as { bgmSignal: () => number }).bgmSignal())).toBeGreaterThan(0.00001);
    await page.getByRole('dialog').getByRole('button',{name:'일시정지',exact:true}).click();
    await expect.poll(()=>bank.nth(0).evaluate((el:HTMLAudioElement)=>el.paused)).toBe(true);
    const pausedAt=await bank.nth(0).evaluate((el:HTMLAudioElement)=>el.currentTime);
    await page.getByRole('dialog').getByRole('button',{name:'계속 듣기',exact:true}).click();
    await expect.poll(()=>bank.nth(0).evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(pausedAt);
    await page.getByLabel('이어듣기 재생 중 배경음악 음량').fill('0');
    await page.getByLabel('이어듣기 재생 중 배경음악 음량').fill('30');
    await expect.poll(() => page.evaluate(() => (window as unknown as { bgmSignal: () => number }).bgmSignal())).toBeGreaterThan(0.00001);
  }
  await expect.poll(()=>bank.nth(1).evaluate((el:HTMLAudioElement)=>el.currentTime),{timeout:8000}).toBeGreaterThan(0.1);
  if (bgmWorks) await expect.poll(() => page.evaluate(() => (window as unknown as { bgmSignal: () => number }).bgmSignal())).toBeGreaterThan(0.00001);
  expect(errors).toEqual([]);
  await expect(page.getByText('목소리와 BGM을 함께 재생하지 못했어요. 다시 한 번 눌러 주세요.')).toHaveCount(0);
});
