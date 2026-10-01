import { describe, expect, it } from 'vitest';

import {
  activeMention,
  applyMention,
  findMentions,
  formatMention,
  mentionIds,
  splitMentions,
} from './mentions';

describe('mention tokens', () => {
  it('finds mentions with their position and ignores plain @ text', () => {
    const text = 'Ask @[Mira](ref:npc-1) about a@b.com and @[The Docks](ref:abc-123).';
    expect(findMentions(text).map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 'npc-1', label: 'Mira' },
      { id: 'abc-123', label: 'The Docks' },
    ]);
    const [first] = findMentions(text);
    expect(text.slice(first.start, first.end)).toBe('@[Mira](ref:npc-1)');
  });

  it('lists distinct ids in first-seen order', () => {
    expect(
      mentionIds('@[A](ref:1) and @[B](ref:2) and @[A again](ref:1)'),
    ).toEqual(['1', '2']);
    expect(mentionIds('nothing here')).toEqual([]);
  });

  it('splits text into text and mention segments', () => {
    expect(splitMentions('Meet @[Mira](ref:n1) today')).toEqual([
      { type: 'text', text: 'Meet ' },
      { type: 'mention', id: 'n1', label: 'Mira' },
      { type: 'text', text: ' today' },
    ]);
    expect(splitMentions('plain')).toEqual([{ type: 'text', text: 'plain' }]);
    expect(splitMentions('')).toEqual([]);
  });

  it('formats labels so they cannot break the token', () => {
    expect(formatMention('Mira', 'n1')).toBe('@[Mira](ref:n1)');
    expect(formatMention('A [bad]\nname', 'n1')).toBe('@[A  bad  name](ref:n1)');
    expect(formatMention('  ', 'n1')).toBe('@[Untitled](ref:n1)');
  });
});

describe('activeMention', () => {
  it('detects an @ being typed at the start or after whitespace', () => {
    expect(activeMention('@mi', 3)).toEqual({ start: 0, query: 'mi' });
    expect(activeMention('Ask @', 5)).toEqual({ start: 4, query: '' });
    expect(activeMention('line one\n@do', 12)).toEqual({ start: 9, query: 'do' });
  });

  it('uses only text before the caret', () => {
    expect(activeMention('hello @mira there', 9)).toEqual({
      start: 6,
      query: 'mi',
    });
  });

  it('ignores emails, finished tokens and stale carets', () => {
    expect(activeMention('mail a@b', 8)).toBeNull();
    expect(activeMention('@[Mira](ref:n1)', 15)).toBeNull();
    expect(activeMention('@[Mi', 4)).toBeNull();
    expect(activeMention('no mention', 10)).toBeNull();
    expect(activeMention('@mira and more', 14)).toBeNull();
    expect(activeMention('', 0)).toBeNull();
  });
});

describe('applyMention', () => {
  it('replaces the typed query with a token and moves the caret after it', () => {
    const text = 'Ask @mi about the docks';
    const active = activeMention(text, 7)!;
    const result = applyMention(text, active, 7, 'Mira', 'n1');
    expect(result.text).toBe('Ask @[Mira](ref:n1)  about the docks');
    expect(result.text.slice(0, result.caret)).toBe('Ask @[Mira](ref:n1) ');
  });

  it('works at the end of the text', () => {
    const active = activeMention('See @', 5)!;
    expect(applyMention('See @', active, 5, 'Docks', 'l1')).toEqual({
      text: 'See @[Docks](ref:l1) ',
      caret: 21,
    });
  });
});
