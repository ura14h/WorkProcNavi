import type { ConfirmItem } from "../../shared/types";

type ConfirmChecklistProps = {
  items: ConfirmItem[];
  checkedItemIds: Set<string>;
  onToggle: (confirmItemId: string) => void;
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

export function ConfirmChecklist({
  items,
  checkedItemIds,
  onToggle,
  onCopyCode,
  onOpenLink,
  onLinkHoverStart,
  onLinkHoverMove,
  onLinkHoverEnd,
}: ConfirmChecklistProps) {
  function handleChecklistClick(event: React.MouseEvent<HTMLUListElement>) {
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

    event.preventDefault();
    event.stopPropagation();
    void onCopyCode(codeElement.textContent ?? "");
  }

  function handleChecklistMouseOver(event: React.MouseEvent<HTMLUListElement>) {
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

  function handleChecklistMouseMove(event: React.MouseEvent<HTMLUListElement>) {
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

  function handleChecklistMouseOut(event: React.MouseEvent<HTMLUListElement>) {
    const linkElement = getLinkElement(event.target);
    if (!linkElement || linkElement === getLinkElement(event.relatedTarget)) {
      return;
    }

    onLinkHoverEnd();
  }

  return (
    <ul
      className="confirm-checklist"
      onClick={handleChecklistClick}
      onMouseMove={handleChecklistMouseMove}
      onMouseOut={handleChecklistMouseOut}
      onMouseOver={handleChecklistMouseOver}
    >
      {items.map((item) => {
        const checked = checkedItemIds.has(item.confirmItemId);
        return (
          <li key={item.confirmItemId}>
            <label className={checked ? "is-checked" : undefined}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(item.confirmItemId)}
              />
              <span
                className="confirm-checklist__text"
                dangerouslySetInnerHTML={{ __html: item.html }}
              />
            </label>
          </li>
        );
      })}
    </ul>
  );
}
