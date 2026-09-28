import { Fragment, type ReactNode } from "react";

/**
 * Renders a legal policy written in the Legal Manager.
 *
 * The policies are stored as plain text with a few Markdown conventions, so an
 * operator can edit them without learning HTML. This turns those conventions
 * into elements.
 *
 * It is deliberately small and deliberately not a Markdown library. Nothing it
 * produces comes from `dangerouslySetInnerHTML`: every piece of the text ends
 * up as a React text node, so a policy can never inject markup into the page
 * however it is edited. That matters more here than supporting tables.
 *
 * What it understands: `#` and `##` and `###` headings, blank-line-separated
 * paragraphs, `-` bullet lists, `1.` numbered lists, `**bold**` and
 * `[text](href)`. Anything else is shown as the words that were typed.
 */

/** `**bold**` and `[text](href)` inside a line. Everything else is text. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let n = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    if (match[1] !== undefined) {
      out.push(
        <strong key={`${keyPrefix}-b${n}`} className="font-semibold text-white">
          {match[1]}
        </strong>,
      );
    } else {
      const href = match[3] ?? "";
      const external = /^https?:\/\//i.test(href);
      out.push(
        <a
          key={`${keyPrefix}-a${n}`}
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
        >
          {match[2]}
        </a>,
      );
    }
    last = match.index + match[0].length;
    n += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function PolicyText({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];

  let paragraph: string[] = [];
  let bullets: string[] = [];
  let numbers: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ");
    blocks.push(
      <p key={`p${key++}`} className="mt-4 text-[15px] leading-7 text-gray-300">
        {inline(text, `p${key}`)}
      </p>,
    );
    paragraph = [];
  };

  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`u${key++}`} className="mt-4 list-disc space-y-2 pl-6 text-[15px] leading-7 text-gray-300">
        {bullets.map((item, i) => (
          <li key={i}>{inline(item, `u${key}-${i}`)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  const flushNumbers = () => {
    if (numbers.length === 0) return;
    blocks.push(
      <ol key={`o${key++}`} className="mt-4 list-decimal space-y-2 pl-6 text-[15px] leading-7 text-gray-300">
        {numbers.map((item, i) => (
          <li key={i}>{inline(item, `o${key}-${i}`)}</li>
        ))}
      </ol>,
    );
    numbers = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushBullets();
    flushNumbers();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim() === "") {
      flushAll();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const text = heading[2];
      if (level === 1) {
        blocks.push(
          <h1 key={`h${key++}`} className="mt-8 text-2xl font-bold text-white first:mt-0">
            {inline(text, `h${key}`)}
          </h1>,
        );
      } else if (level === 2) {
        blocks.push(
          <h2 key={`h${key++}`} className="mt-8 border-t border-white/10 pt-6 text-lg font-bold text-cyan-200">
            {inline(text, `h${key}`)}
          </h2>,
        );
      } else {
        blocks.push(
          <h3 key={`h${key++}`} className="mt-6 text-[15px] font-bold text-white">
            {inline(text, `h${key}`)}
          </h3>,
        );
      }
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      flushNumbers();
      bullets.push(bullet[1]);
      continue;
    }

    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      flushBullets();
      numbers.push(numbered[1]);
      continue;
    }

    flushBullets();
    flushNumbers();
    paragraph.push(line.trim());
  }
  flushAll();

  return <Fragment>{blocks}</Fragment>;
}

export default PolicyText;
