import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const directory = new URL('../public/cards/', import.meta.url);
const directoryPath = fileURLToPath(directory);
const files = (await readdir(directory)).filter((file) => extname(file) === '.png' && file.startsWith('bible-character-sprite'));

await Promise.all(files.map(async (file) => {
  const input = join(directoryPath, file);
  const output = join(directoryPath, file.replace(/\.png$/, '.webp'));
  await sharp(input).webp({ quality: 76, effort: 6, smartSubsample: true }).toFile(output);
}));
