import type { ConfirmItem } from "../../shared/types";

type ConfirmChecklistProps = {
  items: ConfirmItem[];
  checkedItemIds: Set<string>;
  onToggle: (confirmItemId: string) => void;
  onCopyCode: (code: string) => void;
};

export function ConfirmChecklist({
  items,
  checkedItemIds,
  onToggle,
  onCopyCode,
}: ConfirmChecklistProps) {
  function handleInlineCodeClick(event: React.MouseEvent<HTMLUListElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
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
    <ul className="confirm-checklist" onClick={handleInlineCodeClick}>
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
