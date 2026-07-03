// Minimal, dependency-free Markdown renderer — enough for our legal pages
// (headings, paragraphs, lists, simple tables, blockquotes, bold/italic/code,
// links, and horizontal rules). Not a general-purpose renderer.
import { Fragment, type ReactNode } from 'react';

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // links [text](url) → then bold/italic/code on the remaining text
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  const pushStyled = (s: string) => {
    // **bold**, `code`, _italic_
    const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g).filter(Boolean);
    for (const p of parts) {
      if (p.startsWith('**') && p.endsWith('**')) nodes.push(<strong key={k++}>{p.slice(2, -2)}</strong>);
      else if (p.startsWith('`') && p.endsWith('`')) nodes.push(<code key={k++} className="px-1 rounded bg-zinc-100 text-indigo-700 text-[0.9em]">{p.slice(1, -1)}</code>);
      else if (p.startsWith('_') && p.endsWith('_')) nodes.push(<em key={k++}>{p.slice(1, -1)}</em>);
      else nodes.push(<Fragment key={k++}>{p}</Fragment>);
    }
  };
  while ((m = linkRe.exec(text))) {
    pushStyled(text.slice(last, m.index));
    nodes.push(<a key={k++} href={m[2]} className="text-indigo-600 underline hover:text-indigo-500">{m[1]}</a>);
    last = m.index + m[0].length;
  }
  pushStyled(text.slice(last));
  return nodes;
}

export function MarkdownView({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('# ')) { out.push(<h1 key={key++} className="text-3xl font-semibold text-zinc-900 mb-4">{inline(line.slice(2))}</h1>); i++; continue; }
    if (line.startsWith('## ')) { out.push(<h2 key={key++} className="text-xl font-semibold text-zinc-900 mt-8 mb-3">{inline(line.slice(3))}</h2>); i++; continue; }
    if (line.startsWith('### ')) { out.push(<h3 key={key++} className="text-base font-semibold text-zinc-800 mt-5 mb-2">{inline(line.slice(4))}</h3>); i++; continue; }
    if (line.startsWith('---')) { out.push(<hr key={key++} className="my-6 border-zinc-200" />); i++; continue; }
    if (line.startsWith('> ')) {
      const block: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) { block.push(lines[i].slice(2)); i++; }
      out.push(<blockquote key={key++} className="border-l-2 border-indigo-300 pl-4 my-3 text-zinc-600">{block.map((b, j) => <div key={j}>{inline(b)}</div>)}</blockquote>);
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i]); i++; }
      const cells = (r: string) => r.split('|').slice(1, -1).map((c) => c.trim());
      const header = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push(
        <div key={key++} className="my-4 overflow-x-auto">
          <table className="w-full text-sm border border-zinc-200 rounded">
            <thead><tr className="bg-zinc-50">{header.map((h, j) => <th key={j} className="text-left px-3 py-2 border-b border-zinc-200 font-semibold text-zinc-700">{inline(h)}</th>)}</tr></thead>
            <tbody>{body.map((r, ri) => <tr key={ri} className="border-b border-zinc-100">{r.map((c, ci) => <td key={ci} className="px-3 py-2 align-top text-zinc-600">{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) { items.push(lines[i].replace(/^[-*] /, '')); i++; }
      out.push(<ul key={key++} className="list-disc pl-6 my-3 space-y-1 text-zinc-600">{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>);
      continue;
    }
    // paragraph
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#|>|\||[-*] |---)/.test(lines[i])) { para.push(lines[i]); i++; }
    out.push(<p key={key++} className="my-3 leading-relaxed text-zinc-600">{inline(para.join(' '))}</p>);
  }
  return <div className="prose-none">{out}</div>;
}
