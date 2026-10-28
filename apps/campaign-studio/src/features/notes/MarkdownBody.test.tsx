import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarkdownBody } from './MarkdownBody';

describe('MarkdownBody', () => {
  it('renders paragraphs with bold, italic, and code formatting', () => {
    const markdown = 'Here is **bold text** and *italic text* and `inline code`.';
    render(<MarkdownBody source={markdown} />);

    expect(screen.getByText('bold text')).toBeInTheDocument();
    expect(screen.getByText('bold text').tagName).toBe('STRONG');

    expect(screen.getByText('italic text')).toBeInTheDocument();
    expect(screen.getByText('italic text').tagName).toBe('EM');

    expect(screen.getByText('inline code')).toBeInTheDocument();
    expect(screen.getByText('inline code').tagName).toBe('CODE');
  });

  it('renders bullet lists and numbered lists', () => {
    const markdown = `- Item 1\n- Item 2\n\n1. First\n2. Second`;
    render(<MarkdownBody source={markdown} />);

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('renders headings and mentions through renderMention', () => {
    const markdown = `## Secret Chambers\nMet @[Gundren](ref:npc-1) in the tavern.`;
    render(
      <MarkdownBody
        source={markdown}
        renderMention={(id, label) => <a href={`/entities/${id}`}>{label}</a>}
      />,
    );

    expect(screen.getByText('Secret Chambers')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Gundren' });
    expect(link).toHaveAttribute('href', '/entities/npc-1');
  });
});
