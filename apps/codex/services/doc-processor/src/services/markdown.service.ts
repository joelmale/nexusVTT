import { unified } from 'unified';
import remarkParse from 'remark-parse';

class MarkdownService {
  /**
   * Parse markdown and extract plain text for search indexing
   */
  async extractText(markdown: string): Promise<string> {
    try {
      // Parse markdown to AST
      const processor = unified().use(remarkParse);
      const tree = processor.parse(markdown);

      // Extract all text nodes
      const textNodes: string[] = [];
      this.extractTextNodes(tree, textNodes);

      return textNodes.join(' ').trim();
    } catch (error) {
      console.error('Markdown text extraction error:', error);
      throw new Error(`Markdown extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract headings from markdown for sectioning
   */
  async extractHeadings(markdown: string): Promise<Array<{ level: number; text: string }>> {
    try {
      const processor = unified().use(remarkParse);
      const tree = processor.parse(markdown);

      const headings: Array<{ level: number; text: string }> = [];
      this.extractHeadingNodes(tree, headings);

      return headings;
    } catch (error) {
      console.error('Markdown heading extraction error:', error);
      return [];
    }
  }

  /**
   * Recursively extract text from AST nodes
   */
  private extractTextNodes(node: any, textNodes: string[]): void {
    if (node.type === 'text') {
      textNodes.push(node.value);
    }

    if (node.children) {
      for (const child of node.children) {
        this.extractTextNodes(child, textNodes);
      }
    }
  }

  /**
   * Recursively extract heading nodes
   */
  private extractHeadingNodes(node: any, headings: Array<{ level: number; text: string }>): void {
    if (node.type === 'heading') {
      const textNodes: string[] = [];
      this.extractTextNodes(node, textNodes);
      headings.push({
        level: node.depth,
        text: textNodes.join(' ').trim(),
      });
    }

    if (node.children) {
      for (const child of node.children) {
        this.extractHeadingNodes(child, headings);
      }
    }
  }

  /**
   * Validate markdown file
   */
  isValidMarkdown(content: string): boolean {
    try {
      const processor = unified().use(remarkParse);
      processor.parse(content);
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const markdownService = new MarkdownService();
