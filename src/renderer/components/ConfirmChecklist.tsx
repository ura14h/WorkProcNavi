import type { ConfirmItem } from "../../shared/types";

type ConfirmChecklistProps = {
  items: ConfirmItem[];
  checkedItemIds: Set<string>;
  onToggle: (confirmItemId: string) => void;
  onCopyCode: (code: string) => void;
  onOpenLink: (href: string) => void;
};

export function ConfirmChecklist({
  items,
  checkedItemIds,
  onToggle,
  onCopyCode,
  onOpenLink,
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

  return (
    <ul className="confirm-checklist" onClick={handleChecklistClick}>
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
