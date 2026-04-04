import type { RenderBlock } from "../../shared/types";

type RenderBlocksProps = {
  blocks: RenderBlock[];
  onCopyCode: (code: string) => void;
};

export function RenderBlocks({ blocks, onCopyCode }: RenderBlocksProps) {
  return (
    <div className="render-blocks">
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
