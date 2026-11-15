import { parse } from '@astrojs/compiler-rs';
import ts from 'typescript';

// Inspect syntax, not words: prose, comments, strings and property names may say
// “any”. Astro's parser covers frontmatter, template expressions and scripts.
export function explicitAnyCount(source, filename) {
  let count = 0;
  if (filename.endsWith('.astro')) {
    const result = parse(source);
    if (result.diagnostics.some(item => item.severity === 'error')) {
      throw new Error(`Cannot audit invalid Astro syntax: ${filename}`);
    }
    const visit = node => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'TSAnyKeyword') count += 1;
      for (const child of Object.values(node)) {
        if (Array.isArray(child)) child.forEach(visit);
        else if (child && typeof child === 'object') visit(child);
      }
    };
    visit(result.ast);
  } else {
    const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
    if (tree.parseDiagnostics.length) {
      throw new Error(`Cannot audit invalid TypeScript syntax: ${filename}`);
    }
    const visit = node => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) count += 1;
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  return count;
}
