import type { ManualDocument } from "../../shared/types";

type ProgressBarProps = {
  manual: ManualDocument;
  currentPhaseId: string;
};

export function ProgressBar({ manual, currentPhaseId }: ProgressBarProps) {
  return (
    <div className="progress-bar" aria-label="フェーズ進捗">
      {manual.phases.map((phase) => {
        const state =
          phase.phaseId === currentPhaseId
            ? "current"
            : phase.index < manual.phases.find((item) => item.phaseId === currentPhaseId)!.index
              ? "done"
              : "todo";

        return (
          <div className={`progress-node progress-node--${state}`} key={phase.phaseId}>
            <span className="progress-node__index">{phase.index}</span>
            <span className="progress-node__title">{phase.title}</span>
          </div>
        );
      })}
    </div>
  );
}
