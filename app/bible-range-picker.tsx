import { bibleBooks } from './bible-metadata';
import {
  changeRangeBook,
  type BiblePoint,
  type BibleRange,
} from '@/lib/bible-scope';

function PointPicker({
  edge,
  value,
  range,
  onChange,
}: {
  edge: 'start' | 'end';
  value: BiblePoint;
  range: BibleRange;
  onChange: (range: BibleRange) => void;
}) {
  const book =
    bibleBooks.find((item) => item.code === value.bookCode) ?? bibleBooks[0];
  const setPoint = (point: BiblePoint) => onChange({ ...range, [edge]: point });
  return (
    <fieldset className="bible-range-point">
      <legend>{edge === 'start' ? '부터' : '까지'}</legend>
      <label>
        <span>성경책</span>
        <select
          value={value.bookCode}
          onChange={(event) =>
            onChange(
              changeRangeBook(range, edge, event.target.value, bibleBooks),
            )
          }
        >
          {bibleBooks.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>장</span>
        <select
          value={value.chapter}
          onChange={(event) => {
            const chapter = Number(event.target.value);
            const verse = edge === 'start' ? 1 : book.chapters[chapter - 1];
            setPoint({ ...value, chapter, verse });
          }}
        >
          {book.chapters.map((_, index) => (
            <option key={index} value={index + 1}>
              {index + 1}장
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>절</span>
        <select
          value={value.verse}
          onChange={(event) =>
            setPoint({ ...value, verse: Number(event.target.value) })
          }
        >
          {Array.from(
            { length: book.chapters[value.chapter - 1] },
            (_, index) => (
              <option key={index} value={index + 1}>
                {index + 1}절
              </option>
            ),
          )}
        </select>
      </label>
    </fieldset>
  );
}

export function BibleRangePicker({
  value,
  onChange,
  mode = 'range',
}: {
  value: BibleRange;
  onChange: (range: BibleRange) => void;
  mode?: 'chapter' | 'range';
}) {
  if (mode === 'chapter') {
    const book =
      bibleBooks.find((item) => item.code === value.start.bookCode) ??
      bibleBooks[0];
    return (
      <div className="bible-range-picker chapter" aria-label="한 장 읽기">
        <fieldset className="bible-range-point">
          <legend>읽을 장</legend>
          <label>
            <span>성경책</span>
            <select
              value={book.code}
              onChange={(event) => {
                const selected =
                  bibleBooks.find((item) => item.code === event.target.value) ??
                  bibleBooks[0];
                onChange({
                  start: { bookCode: selected.code, chapter: 1, verse: 1 },
                  end: {
                    bookCode: selected.code,
                    chapter: 1,
                    verse: selected.chapters[0],
                  },
                });
              }}
            >
              {bibleBooks.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>장</span>
            <select
              value={value.start.chapter}
              onChange={(event) => {
                const chapter = Number(event.target.value);
                onChange({
                  start: { bookCode: book.code, chapter, verse: 1 },
                  end: {
                    bookCode: book.code,
                    chapter,
                    verse: book.chapters[chapter - 1],
                  },
                });
              }}
            >
              {book.chapters.map((_, index) => (
                <option key={index} value={index + 1}>
                  {index + 1}장
                </option>
              ))}
            </select>
          </label>
        </fieldset>
      </div>
    );
  }
  return (
    <div className="bible-range-picker" aria-label="말씀 범위">
      <PointPicker
        edge="start"
        value={value.start}
        range={value}
        onChange={onChange}
      />
      <span className="bible-range-arrow" aria-hidden="true">
        →
      </span>
      <PointPicker
        edge="end"
        value={value.end}
        range={value}
        onChange={onChange}
      />
    </div>
  );
}
