/**
 * Converts rich HTML (such as text copied from ChatGPT, Claude, Gemini, or Notion)
 * into clean GitHub-Flavored Markdown.
 */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove scripts, styles, and copy buttons often included in AI chat UI
  const garbageSelectors = ['script', 'style', 'button', 'svg', '.copy-button', '.sr-only'];
  garbageSelectors.forEach((sel) => {
    doc.querySelectorAll(sel).forEach((el) => el.remove());
  });

  const body = doc.body;

  function cleanText(text: string): string {
    return text.replace(/\u00A0/g, ' ');
  }

  function processNode(node: Node, listDepth = 0): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return cleanText(node.textContent || '');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    // Ignore empty spans or styling wrappers
    if (tagName === 'span') {
      return processChildren(el, listDepth);
    }

    switch (tagName) {
      case 'h1':
        return `\n\n# ${processChildren(el, listDepth).trim()}\n\n`;
      case 'h2':
        return `\n\n## ${processChildren(el, listDepth).trim()}\n\n`;
      case 'h3':
        return `\n\n### ${processChildren(el, listDepth).trim()}\n\n`;
      case 'h4':
        return `\n\n#### ${processChildren(el, listDepth).trim()}\n\n`;
      case 'h5':
      case 'h6':
        return `\n\n##### ${processChildren(el, listDepth).trim()}\n\n`;

      case 'strong':
      case 'b': {
        const inner = processChildren(el, listDepth).trim();
        return inner ? `**${inner}**` : '';
      }

      case 'em':
      case 'i': {
        const inner = processChildren(el, listDepth).trim();
        return inner ? `*${inner}*` : '';
      }

      case 'del':
      case 's':
      case 'strike': {
        const inner = processChildren(el, listDepth).trim();
        return inner ? `~~${inner}~~` : '';
      }

      case 'code': {
        // If child of pre, let pre handle it
        if (el.parentElement && el.parentElement.tagName.toLowerCase() === 'pre') {
          return cleanText(el.textContent || '');
        }
        const inner = cleanText(el.textContent || '').trim();
        return inner ? `\`${inner}\`` : '';
      }

      case 'pre': {
        const codeEl = el.querySelector('code');
        const rawCode = codeEl ? codeEl.textContent : el.textContent;
        // Detect language class if available (e.g. language-python, lang-js)
        const className = (codeEl?.className || el.className || '');
        const match = className.match(/(?:language-|lang-)(\w+)/);
        const lang = match ? match[1] : '';
        return `\n\n\`\`\`${lang}\n${(rawCode || '').trim()}\n\`\`\`\n\n`;
      }

      case 'blockquote': {
        const inner = processChildren(el, listDepth).trim();
        const quoted = inner
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n');
        return `\n\n${quoted}\n\n`;
      }

      case 'ul': {
        let out = '\n';
        for (const child of Array.from(el.children)) {
          if (child.tagName.toLowerCase() === 'li') {
            out += processListItem(child as HTMLElement, false, 0, listDepth);
          }
        }
        return `${out}\n`;
      }

      case 'ol': {
        let out = '\n';
        let idx = 1;
        for (const child of Array.from(el.children)) {
          if (child.tagName.toLowerCase() === 'li') {
            out += processListItem(child as HTMLElement, true, idx++, listDepth);
          }
        }
        return `${out}\n`;
      }

      case 'table': {
        return processTable(el);
      }

      case 'a': {
        const href = el.getAttribute('href') || '';
        const linkText = processChildren(el, listDepth).trim();
        if (!href) return linkText;
        return `[${linkText || href}](${href})`;
      }

      case 'br':
        return '\n';

      case 'hr':
        return '\n\n---\n\n';

      case 'p':
      case 'div': {
        const inner = processChildren(el, listDepth);
        if (!inner.trim()) return '';
        return `\n\n${inner.trim()}\n\n`;
      }

      default:
        return processChildren(el, listDepth);
    }
  }

  function processChildren(el: HTMLElement, listDepth: number): string {
    let result = '';
    for (const child of Array.from(el.childNodes)) {
      result += processNode(child, listDepth);
    }
    return result;
  }

  function processListItem(
    li: HTMLElement,
    isOrdered: boolean,
    orderIndex: number,
    depth: number
  ): string {
    const indent = '  '.repeat(depth);
    const checkbox = li.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    let prefix: string;

    if (checkbox) {
      prefix = checkbox.checked ? '- [x] ' : '- [ ] ';
    } else if (isOrdered) {
      prefix = `${orderIndex}. `;
    } else {
      prefix = '- ';
    }

    // Process contents without the checkbox element
    let content = '';
    for (const child of Array.from(li.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName.toLowerCase() === 'input') {
        continue;
      }
      if (
        child.nodeType === Node.ELEMENT_NODE &&
        ['ul', 'ol'].includes((child as HTMLElement).tagName.toLowerCase())
      ) {
        content += processNode(child, depth + 1);
      } else {
        content += processNode(child, depth);
      }
    }

    return `${indent}${prefix}${content.trim()}\n`;
  }

  function processTable(table: HTMLElement): string {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length === 0) return '';

    let markdown = '\n\n';
    let hasHeader = false;

    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll('th, td'));
      if (cells.length === 0) return;

      const isHeaderRow = cells.some((cell) => cell.tagName.toLowerCase() === 'th') || rowIndex === 0;
      const rowContent = cells
        .map((c) => processChildren(c as HTMLElement, 0).trim().replace(/\|/g, '\\|'))
        .join(' | ');

      markdown += `| ${rowContent} |\n`;

      if (isHeaderRow && !hasHeader) {
        hasHeader = true;
        const separator = cells.map(() => '---').join(' | ');
        markdown += `| ${separator} |\n`;
      }
    });

    return `${markdown}\n`;
  }

  const rawMarkdown = processChildren(body, 0);

  // Normalize excessive newlines (max 2 consecutive newlines)
  return rawMarkdown
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
