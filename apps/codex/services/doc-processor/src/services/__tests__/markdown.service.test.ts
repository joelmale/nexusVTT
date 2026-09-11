import { markdownService } from '../markdown.service';

describe('MarkdownService', () => {
  describe('extractText', () => {
    it('should extract plain text from simple markdown', async () => {
      const markdown = '# Hello World\n\nThis is a paragraph.';
      const text = await markdownService.extractText(markdown);

      expect(text).toContain('Hello World');
      expect(text).toContain('This is a paragraph');
    });

    it('should remove markdown formatting', async () => {
      const markdown = '**Bold text** and *italic text*';
      const text = await markdownService.extractText(markdown);

      expect(text).toContain('Bold text');
      expect(text).toContain('italic text');
      expect(text).not.toContain('**');
      expect(text).not.toContain('*');
    });

    it('should extract text from lists', async () => {
      const markdown = `
- Item 1
- Item 2
- Item 3
      `;
      const text = await markdownService.extractText(markdown);

      expect(text).toContain('Item 1');
      expect(text).toContain('Item 2');
      expect(text).toContain('Item 3');
    });

    it('should extract text from code blocks', async () => {
      const markdown = '```javascript\nconst x = 42;\n```';
      const text = await markdownService.extractText(markdown);

      expect(text).toContain('const x = 42');
    });

    it('should handle empty markdown', async () => {
      const text = await markdownService.extractText('');
      expect(text).toBe('');
    });
  });

  describe('extractHeadings', () => {
    it('should extract all headings with levels', async () => {
      const markdown = `
# Heading 1
## Heading 2
### Heading 3
      `;
      const headings = await markdownService.extractHeadings(markdown);

      expect(headings).toHaveLength(3);
      expect(headings[0]).toEqual({ level: 1, text: 'Heading 1' });
      expect(headings[1]).toEqual({ level: 2, text: 'Heading 2' });
      expect(headings[2]).toEqual({ level: 3, text: 'Heading 3' });
    });

    it('should handle mixed content', async () => {
      const markdown = `
# Title

Some paragraph text here.

## Subtitle

More content.

### Section
      `;
      const headings = await markdownService.extractHeadings(markdown);

      expect(headings).toHaveLength(3);
      expect(headings[0].text).toBe('Title');
      expect(headings[1].text).toBe('Subtitle');
      expect(headings[2].text).toBe('Section');
    });

    it('should return empty array when no headings', async () => {
      const markdown = 'Just regular paragraph text without any headings.';
      const headings = await markdownService.extractHeadings(markdown);

      expect(headings).toHaveLength(0);
    });

    it('should handle alternate heading syntax', async () => {
      const markdown = `
Heading 1
=========

Heading 2
---------
      `;
      const headings = await markdownService.extractHeadings(markdown);

      expect(headings.length).toBeGreaterThan(0);
      expect(headings[0].text).toBe('Heading 1');
    });
  });

  describe('isValidMarkdown', () => {
    it('should return true for valid markdown', () => {
      const markdown = '# Hello\n\nThis is valid.';
      expect(markdownService.isValidMarkdown(markdown)).toBe(true);
    });

    it('should return true for empty string', () => {
      expect(markdownService.isValidMarkdown('')).toBe(true);
    });

    it('should return true for plain text', () => {
      const text = 'This is just plain text without any markdown.';
      expect(markdownService.isValidMarkdown(text)).toBe(true);
    });

    it('should return true for markdown with formatting', () => {
      const markdown = `
# Title
**Bold** and *italic*
- List item
[Link](https://example.com)
      `;
      expect(markdownService.isValidMarkdown(markdown)).toBe(true);
    });
  });
});
