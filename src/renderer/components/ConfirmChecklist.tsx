import type { ConfirmItem } from "../../shared/types";

type ConfirmChecklistProps = {
  items: ConfirmItem[];
  checkedItemIds: Set<string>;
  onToggle: (confirmItemId: string) => void;
};

export function ConfirmChecklist({
  items,
  checkedItemIds,
  onToggle,
}: ConfirmChecklistProps) {
  return (
    <ul className="confirm-checklist">
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
              <span>{item.text}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
