import { createHash } from 'node:crypto';

// Preserve these upstream license bytes verbatim, including their whitespace.
// Not a path-wide exclusion: an edited copy must pass the ordinary audit.
const verbatimLicenses = new Map([
  ['public/backroad/fonts/Fraunces-OFL.txt', 'bdf4c22802eaf804f998195871c6b8938aac2ac14b2d78a8bd66a6f1eced833b'],
  ['public/backroad/fonts/OFL.txt', '186d750eb496a4c17a76385f82be6aea2ac1cf2de074a811d63786cf374ea73f'],
]);

export function textFailures(path, contents) {
  if (contents.includes(0)) return [];
  const hash = createHash('sha256').update(contents).digest('hex');
  if (verbatimLicenses.get(path) === hash) return [];
  const text = contents.toString('utf8');
  const failures = [];
  for (const [index, line] of text.split('\n').entries()) {
    if (/[\t ]+$/u.test(line)) failures.push(`${path}:${index + 1}: trailing whitespace`);
  }
  if (text.endsWith('\n\n')) failures.push(`${path}: blank line at end of file`);
  return failures;
}
