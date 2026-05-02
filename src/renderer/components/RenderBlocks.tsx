import type { RenderBlock } from "../../shared/types";

type RenderBlocksProps = {
  blocks: RenderBlock[];
  onCopyCode: (code: string) => void;
  onOpenLink: (href: string) => void;
  onLinkHoverStart: (href: string, rect: DOMRect) => void;
  onLinkHoverMove: (href: string, rect: DOMRect) => void;
  onLinkHoverEnd: () => void;
};

function getLinkElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const linkElement = target.closest("a");
  return linkElement instanceof HTMLAnchorElement ? linkElement : null;
}

export function RenderBlocks({
  blocks,
  onCopyCode,
  onOpenLink,
  onLinkHoverStart,
  onLinkHoverMove,
  onLinkHoverEnd,
}: RenderBlocksProps) {
  function handleBlockClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const linkElement = target.closest("a");
    if (linkElement) {
      const href = linkElement.getAttribute("href");
      if (href) {
        event.preventDefault();
        event.stopPropagation();
        void onOpenLink(href);
      }
      return;
    }

    const codeElement = target.closest("code");
    if (!codeElement || codeElement.closest("pre")) {
      return;
    }

    const codeText = codeElement.textContent;
    if (!codeText) {
      return;
    }

    void onCopyCode(codeText);
  }

  function handleBlockMouseOver(event: React.MouseEvent<HTMLDivElement>) {
    const linkElement = getLinkElement(event.target);
    if (!linkElement || linkElement === getLinkElement(event.relatedTarget)) {
      return;
    }

    const href = linkElement.getAttribute("href");
    if (!href) {
      return;
    }

    onLinkHoverStart(href, linkElement.getBoundingClientRect());
  }

  function handleBlockMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const linkElement = getLinkElement(event.target);
    if (!linkElement) {
      return;
    }

    const href = linkElement.getAttribute("href");
    if (!href) {
      return;
    }

    onLinkHoverMove(href, linkElement.getBoundingClientRect());
  }

  function handleBlockMouseOut(event: React.MouseEvent<HTMLDivElement>) {
    const linkElement = getLinkElement(event.target);
    if (!linkElement || linkElement === getLinkElement(event.relatedTarget)) {
      return;
    }

    onLinkHoverEnd();
  }

  return (
    <div
      className="render-blocks"
      onClick={handleBlockClick}
      onMouseMove={handleBlockMouseMove}
      onMouseOut={handleBlockMouseOut}
      onMouseOver={handleBlockMouseOver}
    >
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        if (block.type === "paragraph") {
          return <div className="markdown-block" key={key} dangerouslySetInnerHTML={{ __html: block.html }} />;
        }

        if (block.type === "list") {
          return <div className="markdown-block" key={key} dangerouslySetInnerHTML={{ __html: block.html }} />;
        }

        if (block.type === "blockquote") {
          return <div className="markdown-block" key={key} dangerouslySetInnerHTML={{ __html: block.html }} />;
        }

        if (block.type === "table") {
          return <div className="markdown-block" key={key} dangerouslySetInnerHTML={{ __html: block.html }} />;
        }

        if (block.type === "heading4plus") {
          const headingLevel = Math.min(block.level, 6);
          if (headingLevel === 4) {
            return <h4 key={key}>{block.text}</h4>;
          }
          if (headingLevel === 5) {
            return <h5 key={key}>{block.text}</h5>;
          }
          return <h6 key={key}>{block.text}</h6>;
        }

        if (block.type === "thematicBreak") {
          return <hr key={key} />;
        }

        if (block.type === "image") {
          return (
            <figure className="image-block" key={key}>
              <img src={block.assetUrl} alt={block.alt} />
              {block.alt ? <figcaption>{block.alt}</figcaption> : null}
            </figure>
          );
        }

        return (
          <section className="code-block" key={key}>
            <header className="code-block__header">
              <span>{block.language ?? "text"}</span>
              <button type="button" onClick={() => onCopyCode(block.code)}>
                コピー
              </button>
            </header>
            <pre>
              <code>{block.code}</code>
            </pre>
          </section>
        );
      })}
    </div>
  );
}
