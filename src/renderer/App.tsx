import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmChecklist } from "./components/ConfirmChecklist";
import { ProgressBar } from "./components/ProgressBar";
import { RenderBlocks } from "./components/RenderBlocks";
import { createInitialSession, upsertPhaseTransitionRecord } from "../shared/session-utils";
import type {
  AppError,
  ConfirmItem,
  ManualDocument,
  PhaseAdvanceMode,
  SessionData,
  Step,
} from "../shared/types";

type Screen = "home" | "overview" | "execution" | "completion";

type PendingAction =
  | {
      kind: "advance";
      targetPhaseIndex: number;
      pendingItems: ConfirmItem[];
    }
  | {
      kind: "complete";
      pendingItems: ConfirmItem[];
    };

function formatDuration(startedAt: string, completedAt: string | null) {
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt ?? Date.now()).getTime();
  const totalMinutes = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes} 分`;
  }
  return `${hours} 時間 ${minutes} 分`;
}

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [manual, setManual] = useState<ManualDocument | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [completionOutputPath, setCompletionOutputPath] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const stepRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const checkedItemIds = useMemo(() => new Set(session?.checkedItemIds ?? []), [session]);
  const currentPhase = useMemo(() => {
    if (!manual || !session) {
      return null;
    }
    return manual.phases.find((phase) => phase.phaseId === session.currentPhaseId) ?? manual.phases[0];
  }, [manual, session]);

  const currentStepIndex = useMemo(() => {
    if (!currentPhase || !session) {
      return 0;
    }
    const index = currentPhase.steps.findIndex((step) => step.stepId === session.currentStepId);
    return index >= 0 ? index : 0;
  }, [currentPhase, session]);

  async function cleanupCurrentRuntime() {
    if (manual) {
      await window.workProcNavi.abandonRuntime(manual.runtimeManualId);
    }
  }

  function resetToHomeState() {
    setScreen("home");
    setManual(null);
    setSession(null);
    setCompletionOutputPath(null);
    setPendingAction(null);
  }

  async function persistSession(nextSession: SessionData) {
    if (!manual) {
      return false;
    }

    setSession(nextSession);
    const result = await window.workProcNavi.saveSession({ manual, session: nextSession });
    if (!result.ok) {
      setError(result.error);
      return false;
    }

    setSession((current) =>
      current && current.sessionId === nextSession.sessionId
        ? { ...current, updatedAt: result.savedAt }
        : current,
    );
    return true;
  }

  async function handleDroppedFile(file: File) {
    const filePath = window.workProcNavi.getPathForFile(file);
    if (!filePath) {
      setError({
        code: "INPUT_READ_FAILED",
        message: "ドロップされたファイルのパスを取得できませんでした。",
        recoverable: true,
      });
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      await cleanupCurrentRuntime();
      const result = await window.workProcNavi.loadDroppedFile(filePath);
      if (!result.ok) {
        setError(result.error);
        resetToHomeState();
        return;
      }

      setManual(result.manual);
      setSession(result.session);
      setCompletionOutputPath(null);
      setScreen("overview");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleStart() {
    if (!manual) {
      return;
    }

    const nextSession = session ?? createInitialSession(manual);
    const saved = await persistSession(nextSession);
    if (!saved) {
      return;
    }
    setScreen("execution");
  }

  async function handleBackToHome() {
    await cleanupCurrentRuntime();
    setError(null);
    resetToHomeState();
  }

  async function handleSuspend() {
    if (!session) {
      return;
    }

    const saved = await persistSession({ ...session, updatedAt: new Date().toISOString() });
    if (!saved) {
      return;
    }

    await cleanupCurrentRuntime();
    setToast("セッションを保存しました。");
    resetToHomeState();
  }

  async function handleCopyCode(code: string) {
    try {
      await window.workProcNavi.copyText(code);
      setToast("コードをコピーしました。");
    } catch {
      setError({
        code: "COPY_FAILED",
        message: "コードのコピーに失敗しました。",
        recoverable: true,
      });
    }
  }

  async function handleToggleConfirm(confirmItemId: string) {
    if (!session) {
      return;
    }

    const nextCheckedIds = checkedItemIds.has(confirmItemId)
      ? session.checkedItemIds.filter((itemId) => itemId !== confirmItemId)
      : [...session.checkedItemIds, confirmItemId];

    await persistSession({
      ...session,
      checkedItemIds: nextCheckedIds,
      currentStepId: session.currentStepId,
    });
  }

  function scrollToStep(step: Step) {
    stepRefs.current[step.stepId]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function handleJumpStep(direction: -1 | 1) {
    if (!session || !currentPhase) {
      return;
    }

    const targetStep = currentPhase.steps[currentStepIndex + direction];
    if (!targetStep) {
      return;
    }

    const nextSession = {
      ...session,
      currentStepId: targetStep.stepId,
    };
    const saved = await persistSession(nextSession);
    if (saved) {
      scrollToStep(targetStep);
    }
  }

  function collectPendingItems(phaseId: string) {
    if (!manual) {
      return [];
    }

    const phase = manual.phases.find((item) => item.phaseId === phaseId);
    if (!phase) {
      return [];
    }

    return phase.steps.flatMap((step) =>
      step.confirmItems.filter((item) => !checkedItemIds.has(item.confirmItemId)),
    );
  }

  async function moveToPhase(
    targetPhaseIndex: number,
    mode: PhaseAdvanceMode,
    pendingItems: ConfirmItem[],
  ) {
    if (!manual || !session || !currentPhase) {
      return;
    }

    const targetPhase = manual.phases[targetPhaseIndex];
    if (!targetPhase) {
      return;
    }

    const nextSession = {
      ...session,
      currentPhaseId: targetPhase.phaseId,
      currentStepId: targetPhase.steps[0].stepId,
      phaseTransitionRecords:
        mode === "forced_with_pending" || pendingItems.length === 0
          ? upsertPhaseTransitionRecord(session.phaseTransitionRecords, {
              phaseId: currentPhase.phaseId,
              advanceMode: mode,
              pendingConfirmItemIds: pendingItems.map((item) => item.confirmItemId),
            })
          : session.phaseTransitionRecords,
    };

    const saved = await persistSession(nextSession);
    if (saved) {
      setPendingAction(null);
      stepRefs.current[targetPhase.steps[0].stepId]?.scrollIntoView({ block: "start" });
    }
  }

  async function finishManual(mode: PhaseAdvanceMode, pendingItems: ConfirmItem[]) {
    if (!manual || !session || !currentPhase) {
      return;
    }

    const completedAt = new Date().toISOString();
    const nextSession: SessionData = {
      ...session,
      status: "completed",
      completedAt,
      phaseTransitionRecords: upsertPhaseTransitionRecord(session.phaseTransitionRecords, {
        phaseId: currentPhase.phaseId,
        advanceMode: mode,
        pendingConfirmItemIds: pendingItems.map((item) => item.confirmItemId),
        leftAt: completedAt,
      }),
    };

    setIsBusy(true);
    try {
      setSession(nextSession);
      const exportResult = await window.workProcNavi.exportEvidence({
        manual,
        session: nextSession,
      });
      if (!exportResult.ok) {
        setError(exportResult.error);
        return;
      }

      setSession(nextSession);
      setCompletionOutputPath(exportResult.outputPath);
      setPendingAction(null);
      setScreen("completion");
    } finally {
      setIsBusy(false);
    }
  }

  function requestAdvance() {
    if (!manual || !currentPhase) {
      return;
    }

    const pendingItems = collectPendingItems(currentPhase.phaseId);
    const currentPhaseIndex = manual.phases.findIndex((phase) => phase.phaseId === currentPhase.phaseId);
    const targetPhaseIndex = currentPhaseIndex + 1;
    if (pendingItems.length > 0) {
      setPendingAction({ kind: "advance", targetPhaseIndex, pendingItems });
      return;
    }

    void moveToPhase(targetPhaseIndex, "all_confirmed", []);
  }

  function requestComplete() {
    if (!currentPhase) {
      return;
    }
    const pendingItems = collectPendingItems(currentPhase.phaseId);
    if (pendingItems.length > 0) {
      setPendingAction({ kind: "complete", pendingItems });
      return;
    }

    void finishManual("all_confirmed", []);
  }

  async function handleModalConfirm() {
    if (!pendingAction) {
      return;
    }

    if (pendingAction.kind === "advance") {
      await moveToPhase(
        pendingAction.targetPhaseIndex,
        "forced_with_pending",
        pendingAction.pendingItems,
      );
      return;
    }

    await finishManual("forced_with_pending", pendingAction.pendingItems);
  }

  async function handleMoveBackPhase() {
    if (!manual || !session || !currentPhase) {
      return;
    }

    const currentPhaseIndex = manual.phases.findIndex((phase) => phase.phaseId === currentPhase.phaseId);
    const previousPhase = manual.phases[currentPhaseIndex - 1];
    if (!previousPhase) {
      return;
    }

    await persistSession({
      ...session,
      currentPhaseId: previousPhase.phaseId,
      currentStepId: previousPhase.steps[0].stepId,
    });
  }

  const executionSummary = useMemo(() => {
    if (!manual || !currentPhase) {
      return null;
    }
    const pendingCount = collectPendingItems(currentPhase.phaseId).length;
    return {
      currentPhaseIndex: currentPhase.index,
      totalPhases: manual.totals.phaseCount,
      pendingCount,
    };
  }, [manual, currentPhase, checkedItemIds]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">作業手順ナビ</p>
          <h1>WorkProcNavi</h1>
        </div>
        {screen === "execution" && executionSummary ? (
          <div className="topbar__status">
            <span>
              フェーズ {executionSummary.currentPhaseIndex} / {executionSummary.totalPhases}
            </span>
            <strong>未確認 {executionSummary.pendingCount} 件</strong>
          </div>
        ) : null}
      </header>

      <main className="screen">
        {screen === "home" ? (
          <section
            className={`drop-zone ${isBusy ? "is-busy" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files[0];
              if (file) {
                void handleDroppedFile(file);
              }
            }}
          >
            <div className="drop-zone__panel">
              <p className="eyebrow">入力</p>
              <h2>.md / .zip / .session をドロップ</h2>
              <p>
                手順書またはセッションファイルをドラッグ＆ドロップすると、そのまま概要確認へ進みます。
              </p>
              <ul className="spec-list">
                <li>Markdown 単体読込</li>
                <li>ZIP 内画像の相対参照</li>
                <li>セッション再開とエビデンス出力</li>
              </ul>
            </div>
          </section>
        ) : null}

        {screen === "overview" && manual ? (
          <section className="overview-screen">
            <div className="card">
              <p className="eyebrow">概要</p>
              <h2>{manual.title}</h2>
              <dl className="stats-grid">
                <div>
                  <dt>フェーズ</dt>
                  <dd>{manual.totals.phaseCount}</dd>
                </div>
                <div>
                  <dt>ステップ</dt>
                  <dd>{manual.totals.stepCount}</dd>
                </div>
                <div>
                  <dt>確認項目</dt>
                  <dd>{manual.totals.confirmItemCount}</dd>
                </div>
              </dl>
              <RenderBlocks blocks={manual.overviewBlocks} onCopyCode={handleCopyCode} />
            </div>

            <div className="card">
              <h3>フェーズ一覧</h3>
              <ol className="phase-outline">
                {manual.phases.map((phase) => (
                  <li key={phase.phaseId}>
                    <strong>{phase.title}</strong>
                    <span>
                      {phase.totals.stepCount} ステップ / {phase.totals.confirmItemCount} 確認項目
                    </span>
                  </li>
                ))}
              </ol>
              <div className="button-row">
                <button type="button" className="button button--ghost" onClick={() => void handleBackToHome()}>
                  戻る
                </button>
                <button type="button" className="button" onClick={() => void handleStart()}>
                  {session ? "再開する" : "開始する"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {screen === "execution" && manual && session && currentPhase ? (
          <section className="execution-screen">
            <ProgressBar manual={manual} currentPhaseId={currentPhase.phaseId} />

            <div className="execution-layout">
              <aside className="execution-sidebar card">
                <p className="eyebrow">現在フェーズ</p>
                <h2>{currentPhase.title}</h2>
                <p>{currentPhase.totals.stepCount} ステップ</p>
                <div className="button-stack">
                  <button
                    type="button"
                    className="button button--ghost"
                    disabled={currentStepIndex === 0}
                    onClick={() => void handleJumpStep(-1)}
                  >
                    前のステップ
                  </button>
                  <button
                    type="button"
                    className="button button--ghost"
                    disabled={currentStepIndex >= currentPhase.steps.length - 1}
                    onClick={() => void handleJumpStep(1)}
                  >
                    次のステップ
                  </button>
                  <button type="button" className="button button--ghost" onClick={() => void handleSuspend()}>
                    中断して保存
                  </button>
                </div>
              </aside>

              <article className="execution-main card">
                <RenderBlocks blocks={currentPhase.introBlocks} onCopyCode={handleCopyCode} />

                {currentPhase.steps.map((step) => (
                  <section
                    className={`step-section ${step.stepId === session.currentStepId ? "is-current" : ""}`}
                    key={step.stepId}
                    ref={(element) => {
                      stepRefs.current[step.stepId] = element;
                    }}
                  >
                    <div className="step-section__header">
                      <span>Step {step.index}</span>
                      <h3>{step.title}</h3>
                    </div>
                    <RenderBlocks blocks={step.contentBlocks} onCopyCode={handleCopyCode} />
                    <ConfirmChecklist
                      items={step.confirmItems}
                      checkedItemIds={checkedItemIds}
                      onToggle={(confirmItemId) => void handleToggleConfirm(confirmItemId)}
                    />
                  </section>
                ))}
              </article>
            </div>

            <footer className="phase-footer card">
              <button
                type="button"
                className="button button--ghost"
                disabled={currentPhase.index === 1}
                onClick={() => void handleMoveBackPhase()}
              >
                戻る
              </button>
              {currentPhase.index < manual.phases.length ? (
                <button type="button" className="button" onClick={requestAdvance}>
                  次へ
                </button>
              ) : (
                <button type="button" className="button" onClick={requestComplete}>
                  完了
                </button>
              )}
            </footer>
          </section>
        ) : null}

        {screen === "completion" && manual && session ? (
          <section className="completion-screen card">
            <p className="eyebrow">完了</p>
            <h2>{manual.title}</h2>
            <p>エビデンスを出力し、今回の作業を完了しました。</p>
            <dl className="stats-grid">
              <div>
                <dt>開始</dt>
                <dd>{session.startedAt}</dd>
              </div>
              <div>
                <dt>完了</dt>
                <dd>{session.completedAt ?? "-"}</dd>
              </div>
              <div>
                <dt>所要時間</dt>
                <dd>{formatDuration(session.startedAt, session.completedAt)}</dd>
              </div>
            </dl>
            <div className="output-box">
              <span>出力先</span>
              <strong>{completionOutputPath}</strong>
            </div>
            <button type="button" className="button" onClick={() => resetToHomeState()}>
              ホームへ戻る
            </button>
          </section>
        ) : null}
      </main>

      {error ? (
        <div className="message-banner message-banner--error">
          <strong>{error.message}</strong>
          {error.detail ? <span>{error.detail}</span> : null}
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}

      {pendingAction ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" aria-modal="true" role="dialog">
            <p className="eyebrow">未確認項目あり</p>
            <h3>未確認項目が残っています。承知の上で次に進みますか。</h3>
            <ul className="pending-list">
              {pendingAction.pendingItems.map((item) => (
                <li key={item.confirmItemId}>{item.text}</li>
              ))}
            </ul>
            <div className="button-row">
              <button type="button" className="button button--ghost" onClick={() => setPendingAction(null)}>
                キャンセル
              </button>
              <button type="button" className="button" onClick={() => void handleModalConfirm()}>
                承知して進む
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default App;
