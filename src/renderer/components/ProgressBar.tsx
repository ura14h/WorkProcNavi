import { useEffect, useRef } from "react";
import type { ManualDocument } from "../../shared/types";

type ProgressBarProps = {
  manual: ManualDocument;
  currentPhaseId: string;
};

export function ProgressBar({ manual, currentPhaseId }: ProgressBarProps) {
  const currentNodeRef = useRef<HTMLDivElement | null>(null);
  const currentPhaseIndex =
    manual.phases.find((phase) => phase.phaseId === currentPhaseId)?.index ?? 1;

  useEffect(() => {
    currentNodeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [currentPhaseId]);

  return (
    <div className="progress-bar" aria-label="フェーズ進捗">
      {manual.phases.map((phase) => {
        const state =
          phase.phaseId === currentPhaseId
            ? "current"
            : phase.index < currentPhaseIndex
              ? "done"
              : "todo";

        return (
          <div
            className={`progress-node progress-node--${state}`}
            key={phase.phaseId}
            ref={phase.phaseId === currentPhaseId ? currentNodeRef : null}
            title={phase.title}
          >
            <span className="progress-node__index">{phase.index}</span>
            <span className="progress-node__title">{phase.title}</span>
          </div>
        );
      })}
    </div>
  );
}
