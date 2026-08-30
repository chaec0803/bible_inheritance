import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const books = [
  ['old', '창', '창세기'], ['old', '출', '출애굽기'], ['old', '레', '레위기'], ['old', '민', '민수기'], ['old', '신', '신명기'],
  ['old', '수', '여호수아'], ['old', '삿', '사사기'], ['old', '룻', '룻기'], ['old', '삼상', '사무엘상'], ['old', '삼하', '사무엘하'],
  ['old', '왕상', '열왕기상'], ['old', '왕하', '열왕기하'], ['old', '대상', '역대상'], ['old', '대하', '역대하'], ['old', '스', '에스라'],
  ['old', '느', '느헤미야'], ['old', '에', '에스더'], ['old', '욥', '욥기'], ['old', '시', '시편'], ['old', '잠', '잠언'],
  ['old', '전', '전도서'], ['old', '아', '아가'], ['old', '사', '이사야'], ['old', '렘', '예레미야'], ['old', '애', '예레미야애가'],
  ['old', '겔', '에스겔'], ['old', '단', '다니엘'], ['old', '호', '호세아'], ['old', '욜', '요엘'], ['old', '암', '아모스'],
  ['old', '옵', '오바댜'], ['old', '욘', '요나'], ['old', '미', '미가'], ['old', '나', '나훔'], ['old', '합', '하박국'],
  ['old', '습', '스바냐'], ['old', '학', '학개'], ['old', '슥', '스가랴'], ['old', '말', '말라기'],
  ['new', '마', '마태복음'], ['new', '막', '마가복음'], ['new', '눅', '누가복음'], ['new', '요', '요한복음'], ['new', '행', '사도행전'],
  ['new', '롬', '로마서'], ['new', '고전', '고린도전서'], ['new', '고후', '고린도후서'], ['new', '갈', '갈라디아서'], ['new', '엡', '에베소서'],
  ['new', '빌', '빌립보서'], ['new', '골', '골로새서'], ['new', '살전', '데살로니가전서'], ['new', '살후', '데살로니가후서'], ['new', '딤전', '디모데전서'],
  ['new', '딤후', '디모데후서'], ['new', '딛', '디도서'], ['new', '몬', '빌레몬서'], ['new', '히', '히브리서'], ['new', '약', '야고보서'],
  ['new', '벧전', '베드로전서'], ['new', '벧후', '베드로후서'], ['new', '요일', '요한1서'], ['new', '요이', '요한2서'], ['new', '요삼', '요한3서'],
  ['new', '유', '유다서'], ['new', '계', '요한계시록'],
];

const [inputPath, projectRoot] = process.argv.slice(2);
if (!inputPath || !projectRoot) throw new Error('Usage: node scripts/prepare-bible-data.mjs INPUT_JSON PROJECT_ROOT');

const allVerses = JSON.parse(await readFile(inputPath, 'utf8'));
const outputDir = path.join(projectRoot, 'public', 'data', 'bible');
await mkdir(outputDir, { recursive: true });

const metadata = [];
for (const [testament, code, name] of books) {
  const pattern = new RegExp(`^${code}(\\d+):(\\d+)$`);
  const chapters = {};
  for (const [key, text] of Object.entries(allVerses)) {
    const match = key.match(pattern);
    if (!match) continue;
    const chapter = Number(match[1]);
    const verse = Number(match[2]);
    chapters[chapter] ??= [];
    chapters[chapter][verse - 1] = text;
  }
  const chapterList = Object.keys(chapters).map(Number).sort((a, b) => a - b).map((chapter) => chapters[chapter]);
  if (!chapterList.length) throw new Error(`Missing book data: ${name}`);
  await writeFile(path.join(outputDir, `${code}.json`), JSON.stringify(chapterList));
  metadata.push({ testament, code, name, chapters: chapterList.map((chapter) => chapter.length) });
}

const moduleSource = `export type BibleBook = { testament: 'old' | 'new'; code: string; name: string; chapters: number[] };\n\nexport const bibleBooks: BibleBook[] = ${JSON.stringify(metadata, null, 2)};\n`;
await writeFile(path.join(projectRoot, 'app', 'bible-metadata.ts'), moduleSource);
