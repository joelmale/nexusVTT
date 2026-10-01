import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { MarkdownBody } from '@/features/notes/MarkdownBody';
import { renderInSection } from '@/features/section-shell/testUtils';

import { mentionCandidates } from './mentionCandidates';
import { MentionChip, MentionText } from './MentionText';
import { MentionTextarea } from './MentionTextarea';

function Field({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label>
        Note body
        <MentionTextarea onChange={setValue} value={value} />
      </label>
      <output data-testid="value">{value}</output>
    </>
  );
}

const body = () => screen.getByLabelText('Note body') as HTMLTextAreaElement;
const value = () => screen.getByTestId('value').textContent;

describe('MentionTextarea', () => {
  it('suggests campaign objects after @ and inserts a stable token on Enter', async () => {
    const { user } = renderInSection(<Field />);
    await user.type(body(), 'Ask @serin');

    const list = screen.getByRole('listbox', { name: 'Mention suggestions' });
    expect(
      within(list).getByRole('option', { name: /Captain Serin Dhal/ }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(body()).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Enter}');
    expect(value()).toBe('Ask @[Captain Serin Dhal](ref:npc-captain-serin) ');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(body().selectionStart).toBe(value()!.length);
  });

  it('moves the highlight with the arrow keys and picks with Tab', async () => {
    const { user } = renderInSection(<Field />);
    await user.type(body(), '@');
    const options = within(
      screen.getByRole('listbox'),
    ).getAllByRole('option');
    expect(options.length).toBeGreaterThan(1);

    await user.keyboard('{ArrowDown}');
    expect(
      within(screen.getByRole('listbox')).getAllByRole('option')[1],
    ).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(
      within(screen.getByRole('listbox')).getAllByRole('option')[
        options.length - 1
      ],
    ).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Tab}');
    expect(value()).toMatch(/^@\[.+\]\(ref:[\w-]+\) $/);
  });

  it('closes on Escape and offers nothing for a query with no match', async () => {
    const { user } = renderInSection(<Field />);
    await user.type(body(), '@ser');
    expect(screen.getByRole('listbox')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(value()).toBe('@ser');

    await user.clear(body());
    await user.type(body(), '@zzzzqqq');
    expect(screen.queryByRole('listbox')).toBeNull();
    await user.keyboard('{Enter}');
    expect(value()).toBe('@zzzzqqq\n');
  });

  it('picks with the mouse and ignores @ inside words', async () => {
    const { user } = renderInSection(<Field />);
    await user.type(body(), 'mail me@serin');
    expect(screen.queryByRole('listbox')).toBeNull();

    await user.clear(body());
    await user.type(body(), '@serin');
    fireEvent.mouseDown(
      screen.getByRole('option', { name: /Captain Serin Dhal/ }),
    );
    expect(value()).toContain('(ref:npc-captain-serin)');
  });

  it('leaves existing text and mentions alone while editing around them', async () => {
    const { user } = renderInSection(
      <Field initial="Meet @[Captain Serin Dhal](ref:npc-captain-serin) soon" />,
    );
    await user.click(body());
    fireEvent.change(body(), {
      target: {
        value: 'Meet @[Captain Serin Dhal](ref:npc-captain-serin) soon!',
        selectionStart: 56,
      },
    });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(value()).toBe(
      'Meet @[Captain Serin Dhal](ref:npc-captain-serin) soon!',
    );
  });
});

describe('mention rendering', () => {
  it('shows the current title, not the label typed at the time', () => {
    renderInSection(
      <MarkdownBody
        renderMention={(id, label) => <MentionChip id={id} label={label} />}
        source="Talk to @[Old Name](ref:npc-captain-serin) about **it**."
      />,
    );
    const link = screen.getByRole('link', { name: /Captain Serin Dhal/ });
    expect(link).toHaveAttribute(
      'href',
      '/demo/ashes-of-veyra/npcs/npc-captain-serin',
    );
    expect(screen.queryByText(/Old Name/)).toBeNull();
    expect(screen.getByText('it').tagName).toBe('STRONG');
  });

  it('marks a mention whose target is gone, keeping its last known label', () => {
    renderInSection(
      <p>
        <MentionText text="See @[Vanished Keep](ref:gone-123) there" />
      </p>,
    );
    const missing = screen.getByText('Missing: Vanished Keep');
    expect(missing).toHaveAttribute('data-missing-id', 'gone-123');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('leaves mentions as plain text when no renderer is given', () => {
    renderInSection(
      <MarkdownBody source="Plain @[Mira](ref:n1) text" />,
    );
    expect(screen.getByText('Plain @[Mira](ref:n1) text')).toBeVisible();
  });
});

describe('mentionCandidates', () => {
  const entities = [
    { id: '1', kind: 'npc' as const, label: 'Mira Vale' },
    { id: '2', kind: 'location' as const, label: 'Harbor Mirage' },
    { id: '3', kind: 'quest' as const, label: 'Find the Key' },
    { id: '4', kind: 'npc' as const, label: 'Admiral Mirren' },
  ];

  it('ranks prefix matches before substring matches, then by name', () => {
    expect(
      mentionCandidates(entities, 'mir').map((entity) => entity.label),
    ).toEqual(['Mira Vale', 'Admiral Mirren', 'Harbor Mirage']);
  });

  it('returns everything for an empty query, capped', () => {
    const many = Array.from({ length: 20 }, (_, index) => ({
      id: String(index),
      kind: 'npc' as const,
      label: `NPC ${String(index).padStart(2, '0')}`,
    }));
    expect(mentionCandidates(many, '')).toHaveLength(6);
    expect(mentionCandidates(entities, 'nothing')).toEqual([]);
  });
});
