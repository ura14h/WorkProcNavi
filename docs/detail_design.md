# 作業手順ナビ / WorkProcNavi 詳細設計

## 1. 文書の目的

本書は、[`basic_design.md`](/Users/ishiura/Developer/Product/WorkProcNavi/docs/basic_design.md) をもとに、
WorkProcNavi を実装可能な粒度まで具体化した詳細設計を定義する。

本書で定義する対象は以下とする。

- Electron を採用したアプリケーション構成
- 手順書読込、解析、表示、リンクオープン、進捗保存、再開、エビデンス出力の仕様
- 画面責務、状態遷移、エラー処理
- 内部データモデルとファイル形式
- モジュール責務とテスト観点

## 2. 前提と設計方針

### 2.1 前提

- 本アプリはオフラインで動作するローカルデスクトップアプリとする
- 対応プラットフォームは macOS / Windows / Linux とする
- 開発基盤は Electron とする
- 初期版の UI 言語は日本語のみとする
- 入力形式は `.md`、`.zip`、`.session` のみとする

### 2.2 設計方針

- ファイル I/O、ZIP 展開、エビデンス出力などの OS 資源アクセスは Electron Main Process に集約する
- Renderer Process は UI 表示と画面状態管理に専念する
- Renderer から Node.js API を直接利用しない
- 手順本文内リンクを開く処理は Main Process に集約し、Renderer は画面内遷移や任意 URL の直接実行を行わない
- 手順書構造と UI 状態を分離し、将来の編集機能追加に備える
- セッション保存は即時性よりも整合性を優先し、原子的なファイル更新で行う
- ZIP 内アセットやローカル画像は、Renderer から安全に参照できる経路に限定する
- 本文レンダリングに用いる内蔵スタイルシートは GitHub ライクな `default.css` とする

## 3. システム構成

### 3.1 Electron 構成

アプリは以下の 3 層で構成する。

1. Main Process
   ウィンドウ生成、ファイル操作、ZIP 展開、リンクオープン、セッション保存、エビデンス出力、カスタムプロトコル提供を担当する。
2. Preload
   Renderer に対して限定 API を公開し、IPC の窓口を提供する。
3. Renderer Process
   画面描画、ユーザー操作受付、画面状態遷移、Markdown レンダリングを担当する。

### 3.2 セキュリティ設定

BrowserWindow は以下の設定を前提とする。

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `webSecurity: true`
- `preload` で明示的に API を公開する

Renderer に公開する API は、手順書読込、セッション保存要求、エビデンス出力要求、クリップボードコピーなど必要最小限に限定する。

### 3.3 ランタイム責務

#### Main Process の責務

- ドロップされたファイルパスの受理
- ファイル種別判定
- Markdown 読込
- ZIP 展開と一時フォルダ管理
- セッションファイルの読込と保存
- エビデンスファイルの出力
- 外部サイト URL の既定ブラウザオープン
- `file://` URL のファイルエクスプローラまたは Finder 表示
- 一時フォルダ削除
- 画像参照用カスタムプロトコルの提供
- エラー内容の整形

#### Preload の責務

- IPC を Renderer 向け API に束ねる
- Renderer が必要な入力・出力 DTO を変換する
- テキストコピー API を提供する
- 手順本文内リンクオープン API を提供する

#### Renderer Process の責務

- 画面表示
- ドラッグ＆ドロップ受付
- 概要画面、実行画面、完了画面の状態遷移
- チェック状態更新
- 現在ステップ位置の保持
- 手順本文内リンククリックの捕捉と Main Process への委譲
- Main Process から返却された手順データの描画

## 4. 用語定義

- 手順書: `.md` または `.zip` から読込まれる作業手順の元データ
- フェーズ: `##` 見出しで表現される大きな作業単位
- ステップ: `###` 見出しで表現される作業単位
- 確認項目: ステップ配下のチェックボックス箇条書き
- セッション: 作業途中の進捗を表す `.session` JSON ファイル
- エビデンス: 作業完了後に出力される `.log` Markdown ファイル
- ソースルート: 画像など相対パス解決の基準となるディレクトリ
- 展開ディレクトリ: ZIP を一時展開する OS 一時領域配下のフォルダ
- 手順本文内リンク: 手順本文の Markdown リンク記法から生成されるクリック可能な参照

## 5. 入力仕様

### 5.1 対応ファイル

アプリが受け付けるファイルは以下の 3 種類とする。

- Markdown 手順書: `.md`
- ZIP 手順書パッケージ: `.zip`
- セッションファイル: `.session`

複数ファイル同時ドロップは初期版では未対応とし、最初の 1 件のみ処理対象とする。

### 5.2 ファイル種別判定

拡張子で一次判定し、内容で二次検証する。

| 拡張子 | 一次判定 | 二次検証 |
| --- | --- | --- |
| `.md` | Markdown 手順書候補 | UTF-8 テキストとして読めること |
| `.zip` | ZIP 手順書候補 | ZIP 展開でき、Markdown ファイルを 1 つだけ含むこと |
| `.session` | セッション候補 | JSON として読め、必須項目を満たすこと |

### 5.3 Markdown 手順書ルール

Markdown は以下の構造を前提とする。

- 最初の `#` 見出しを手順書タイトルとする
- `##` 見出しをフェーズとする
- `###` 見出しをステップとする
- ステップ配下のタスクリスト項目を確認項目とする
- それ以外の段落、通常リスト、表、引用、コードブロック、画像、リンクは本文要素として保持する

初期版の構文制約は以下とする。

- 手順書タイトルは 1 つ必須
- フェーズは 1 つ以上必須
- 各フェーズにステップは 1 つ以上必須
- 各ステップに確認項目は 1 つ以上必須
- `####` 以降の深い見出しは本文要素として扱い、構造化しない
- 手順本文内リンクとして開く対象プロトコルは `http://`、`https://`、`file://` とする
- `javascript:`、`data:`、独自スキームなどの未許可プロトコルは開く対象にしない

### 5.4 ZIP パッケージルール

ZIP パッケージは以下の条件を満たすこと。

- Markdown ファイルを 1 つだけ含む
- 画像などの関連ファイルは任意で含めてよい
- Markdown 内の相対パスは ZIP 展開後の Markdown ファイル位置を基準に解決する
- パスは ZIP 外を指してはならない

ZIP 内に Markdown ファイルが 0 件または 2 件以上ある場合は、開始前エラーとする。

### 5.5 セッションファイルルール

セッションファイルは JSON 形式とする。

- 手順書本体のキャッシュは持たない
- 元手順書のパスと種別を保持する
- 進捗再現に必要なフェーズ ID、ステップ ID、確認項目状態を保持する
- 読込時は元手順書を再解析し、セッション状態を再適用する

## 6. 解析設計

### 6.1 解析フロー

手順書読込時の処理順は以下とする。

1. 入力ファイル種別を判定する
2. `.md` は直接読込む
3. `.zip` は展開ディレクトリに展開する
4. Markdown を AST へ解析する
5. AST から手順書構造を抽出する
6. 画像参照などの本文要素を表示用ブロックに正規化する
7. 概要情報と実行用モデルを生成する

### 6.2 構造抽出ルール

Markdown AST から以下の規則でモデル化する。

- `#` 見出しの最初の 1 件を `manual.title` とする
- `##` 見出しが現れた時点で新しい Phase を開始する
- `###` 見出しが現れた時点で現在 Phase 配下に新しい Step を開始する
- Step 配下のタスクリスト項目は ConfirmItem として抽出する
- ConfirmItem 以外の要素は、所属する Manual / Phase / Step の本文ブロックへ格納する

### 6.3 本文ブロックの扱い

表示用本文は以下のブロック種別へ正規化する。

- paragraph
- list
- blockquote
- code
- image
- table
- heading4plus
- thematicBreak

Renderer はこのブロック群をそのまま描画するのではなく、一度 HTML 相当へ変換して表示する。
ただし ConfirmItem は本文 HTML へ埋め込まず、専用 UI コンポーネントとして描画する。
リンクは paragraph / list / blockquote / table などの `html` 内に `<a href="...">` として保持する。
Main Process 側の HTML 変換時に、許可プロトコル以外の `href` は除去する。
Renderer はリンククリックを捕捉して既定動作をキャンセルし、`href` を Main Process へ渡して開く。
Renderer 内の WebView 遷移、別ウィンドウ生成、任意 JavaScript 実行は行わない。

本文表示にはアプリ内蔵の [`default.css`](/Users/ishiura/Developer/Product/WorkProcNavi/default.css) を適用する。
`default.css` は GitHub ライクな可読性を持つ Markdown 表示を目的とし、少なくとも以下の要素を対象とする。

- 見出し
- 段落
- リスト
- 引用
- 表
- コードブロック
- インラインコード
- 画像
- 水平線

### 6.4 相対画像パス解決

画像パスは以下の基準で解決する。

- `.md`: Markdown ファイルの親ディレクトリをソースルートとする
- `.zip`: 展開後 Markdown ファイルの親ディレクトリをソースルートとする

Renderer に渡す画像 URL は、生ファイルパスではなくカスタムプロトコル URL に変換する。

例:

```text
wpn-asset://manual/<runtimeManualId>/assets/image-01.png
```

Main Process は `runtimeManualId` に紐づく許可済みソースルート配下のみを参照させる。

### 6.5 手順本文内リンク解決

手順本文内リンクは以下のプロトコルを対象とする。

| プロトコル | 開き方 | 備考 |
| --- | --- | --- |
| `http://` | OS の既定外部ブラウザで開く | アプリ内画面は遷移しない |
| `https://` | OS の既定外部ブラウザで開く | アプリ内画面は遷移しない |
| `file://` | 標準ファイルエクスプローラまたは Finder で表示する | ファイル本体は直接開かない |

外部サイト URL は Electron Main Process で検証したうえで、OS の既定ブラウザへ委譲する。
Renderer で `<a target="_blank">` の既定動作に任せて開かない。

`file://` URL は Electron Main Process で WHATWG URL として解析し、実行 OS のパス規則に合わせて正規化する。

- macOS / Linux は `/Users/...` や `/home/...` などの `/` 区切りパスとして扱う
- Windows は `file:///C:/Users/...` のドライブ文字形式と `file://server/share/...` の UNC 形式を扱う
- URL エンコードされた空白や日本語などはデコードしてから OS パスへ変換する
- `..`、重複区切り、末尾区切りなどは OS 標準のパス正規化を通す
- 解析不能な URL、対象が存在しない URL、許可プロトコル以外の URL は開かずエラーとして扱う

`file://` の対象が存在する場合の動作は以下とする。

1. 対象がディレクトリの場合、標準ファイルエクスプローラまたは Finder でそのディレクトリを開く
2. 対象がファイルの場合、ファイルを直接開かず、親ディレクトリを開いて対象ファイルを選択または表示する
3. OS がファイル選択表示を提供できない場合は、親ディレクトリを開く

この仕様により、手順書内リンクから実行ファイル、スクリプト、Office 文書などが直接起動されることを防ぐ。
リンクオープンは作業進捗、現在ステップ位置、チェック状態、セッション保存内容を変更しない。

### 6.6 不正構造時の扱い

以下は開始前エラーとする。

- タイトルが存在しない
- フェーズが存在しない
- フェーズ配下にステップが存在しない
- ステップ配下に確認項目が存在しない
- セッションに記録された ID が再解析結果と一致しない

## 7. 内部データモデル設計

### 7.1 識別子設計

内部 ID は、解析順序に基づく決定的 ID とする。

- `manualId`: 元ファイル名の拡張子を除いた値
- `phaseId`: `phase-001` 形式
- `stepId`: `phase-001-step-001` 形式
- `confirmItemId`: `phase-001-step-001-check-001` 形式

同一手順書を再解析した際に同じ構造であれば同じ ID が再生成されることを前提とする。

### 7.2 手順書モデル

```ts
type SourceType = "markdown" | "zip";

type ManualDocument = {
  manualId: string;
  runtimeManualId: string;
  title: string;
  sourceType: SourceType;
  sourcePath: string;
  sourceRootPath: string;
  displayName: string;
  overviewBlocks: RenderBlock[];
  phases: Phase[];
  totals: ManualTotals;
};

type Phase = {
  phaseId: string;
  index: number;
  title: string;
  introBlocks: RenderBlock[];
  steps: Step[];
  totals: PhaseTotals;
};

type Step = {
  stepId: string;
  index: number;
  title: string;
  contentBlocks: RenderBlock[];
  confirmItems: ConfirmItem[];
};

type ConfirmItem = {
  confirmItemId: string;
  index: number;
  text: string;
};
```

### 7.3 表示ブロックモデル

```ts
type RenderBlock =
  | { type: "paragraph"; html: string }
  | { type: "list"; html: string }
  | { type: "blockquote"; html: string }
  | { type: "code"; language: string | null; code: string }
  | { type: "image"; alt: string; assetUrl: string; title?: string }
  | { type: "table"; html: string }
  | { type: "heading4plus"; level: number; text: string }
  | { type: "thematicBreak" };
```

`html` を持つブロックは、Main Process 側で安全な HTML に変換した結果を保持する。
Renderer は任意 Markdown を再解釈しない。

### 7.4 集計モデル

```ts
type ManualTotals = {
  phaseCount: number;
  stepCount: number;
  confirmItemCount: number;
};

type PhaseTotals = {
  stepCount: number;
  confirmItemCount: number;
};
```

### 7.5 セッション状態モデル

```ts
type SessionStatus = "in_progress" | "completed";

type PhaseAdvanceMode = "all_confirmed" | "forced_with_pending";

type PhaseTransitionRecord = {
  phaseId: string;
  leftAt: string;
  advanceMode: PhaseAdvanceMode;
  pendingConfirmItemIds: string[];
};

type SessionData = {
  sessionId: string;
  appVersion: string;
  manualId: string;
  sourcePath: string;
  sourceType: SourceType;
  sessionFilePath: string;
  status: SessionStatus;
  currentPhaseId: string;
  currentStepId: string;
  checkedItemIds: string[];
  phaseTransitionRecords: PhaseTransitionRecord[];
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
};
```

### 7.6 実行時 UI 状態モデル

```ts
type AppScreen = "home" | "overview" | "execution" | "completion";

type RuntimeState = {
  screen: AppScreen;
  manual: ManualDocument | null;
  session: SessionData | null;
  checkedItemIds: Set<string>;
  currentPhaseId: string | null;
  currentStepId: string | null;
  lastError: AppError | null;
  dirty: boolean;
};
```

`dirty` は未保存変更の有無を表し、保存成功時に `false` に戻す。
`phaseTransitionRecords` は、各フェーズを離脱した時点の確認状況を履歴として保持する。
同じフェーズを複数回離脱した場合は、最新の 1 件で上書きする。

### 7.7 リンクオープン結果モデル

```ts
type ManualLinkKind = "externalUrl" | "fileDirectory" | "fileItem";

type OpenManualLinkInput = {
  href: string;
};

type OpenManualLinkResult =
  | { ok: true; kind: ManualLinkKind; openedPath?: string }
  | { ok: false; error: AppError };
```

`fileDirectory` はディレクトリを開いたことを表す。
`fileItem` はファイル本体ではなく親ディレクトリ内で対象ファイルを表示したことを表す。
`openedPath` は `file://` の場合のみ、正規化後の OS パスを返す。

## 8. セッション保存・再開設計

### 8.1 保存ファイル名

保存先は元手順書と同じディレクトリとし、命名規則は以下とする。

- 元が `sample-proc-001.md` の場合: `sample-proc-001.session`
- 元が `sample-proc-001.zip` の場合: `sample-proc-001.session`

保存内容の例は以下とする。

```json
{
  "sessionId": "session-20260404-001",
  "appVersion": "0.1.0",
  "manualId": "sample-proc-001",
  "sourcePath": "/path/to/sample-proc-001.zip",
  "sourceType": "zip",
  "sessionFilePath": "/path/to/sample-proc-001.session",
  "status": "in_progress",
  "currentPhaseId": "phase-001",
  "currentStepId": "phase-001-step-001",
  "checkedItemIds": [
    "phase-001-step-001-check-001"
  ],
  "phaseTransitionRecords": [
    {
      "phaseId": "phase-001",
      "leftAt": "2026-04-04T09:12:00+09:00",
      "advanceMode": "forced_with_pending",
      "pendingConfirmItemIds": [
        "phase-001-step-001-check-002"
      ]
    }
  ],
  "startedAt": "2026-04-04T09:00:00+09:00",
  "updatedAt": "2026-04-04T09:10:00+09:00",
  "completedAt": null
}
```

### 8.2 保存タイミング

以下のイベントで保存を試行する。

- 確認項目のチェック変更時
- ステップジャンプ時
- フェーズ移動時
- 未確認項目ありで移動することを承認した時
- 手動中断時

アプリ終了時は保存を行わず、進行中画面では確認ダイアログを表示したうえでウィンドウを閉じる。
完了処理では `.log` 出力時に `completedAt` を含むセッション内容を利用するが、完了済み `.session` の保存は行わない。

### 8.3 保存方式

セッション保存は原子的に行う。

1. `<session>.tmp` へ JSON を書き込む
2. 書込成功後に既存 `.session` を置換する
3. 成功時に `dirty = false` とする

保存失敗時は画面を維持し、再試行可能なエラー通知を表示する。

### 8.4 再開処理

`.session` 読込時の処理順は以下とする。

1. JSON を読込む
2. 必須項目と型を検証する
3. `sourcePath` の存在確認を行う
4. 元手順書を再解析する
5. `currentPhaseId`、`currentStepId`、`checkedItemIds`、`phaseTransitionRecords` を再適用する
6. 不整合があれば開始前エラーとする

### 8.5 完了時の扱い

手順書完了時は以下を実施する。

1. 最終フェーズ離脱時の `phaseTransitionRecords` を確定する
2. セッションに `status = completed` と `completedAt` を設定する
3. 未確認項目が残っていても、利用者が承認済みであれば完了を許可する
4. エビデンス出力を行う
5. エビデンス出力後に `.session` を削除する
6. `.session` 削除後に ZIP 展開ディレクトリを削除する
7. 完了画面を表示する

`.session` 削除または ZIP 展開ディレクトリ削除に失敗した場合は、完了遷移を中断し、エビデンス出力失敗として扱う。

## 9. エビデンス出力設計

### 9.1 出力ファイル名

エビデンスは元手順書と同じディレクトリに、以下の規則で出力する。

- `sample-proc-001.log`

既存ファイルが存在する場合は上書きする。

### 9.2 出力形式

出力形式は Markdown とする。

文書構造は以下とする。

1. YAML front matter
2. タイトル
3. フェーズごとの結果
4. ステップごとの確認項目結果

### 9.3 出力内容

```md
---
実施開始: 2026-04-04T09:00:00+09:00
実施完了: 2026-04-04T09:35:00+09:00
手順書名: sample-proc-001.zip
---

# 機器セットアップ手順 実施記録

## 事前確認

### 電源状態を確認する

- [x] 端末の電源ランプが消灯している
- [ ] 電源ケーブルの状態に問題がない
```

YAML front matter に記録する項目は `実施開始`、`実施完了`、`手順書名` のみとする。
エビデンスには本文ブロックや統計情報を再掲しない。
初期版では、実施結果の証跡として確認項目結果と最小限のメタ情報の出力を優先する。
確認項目自体の状態は、最終保存時点の `checkedItemIds` を基準に `- [x]` または `- [ ]` で出力する。

### 9.4 出力失敗時の扱い

エビデンス出力失敗時は完了遷移を中断し、作業画面上で再試行可能なエラーを表示する。
この時点では `.session` を削除しない。

## 10. 画面設計

### 10.1 画面一覧

#### ホーム画面

責務:

- `.md` / `.zip` / `.session` のドロップ受付
- 対応形式の案内
- 読込エラー表示

主表示要素:

- ドロップ領域
- 対応ファイル説明
- エラーメッセージ領域

#### 手順書概要画面

責務:

- 手順書タイトル、フェーズ数、ステップ数、確認項目数の表示
- フェーズ一覧の確認
- 開始または再開の明示

主表示要素:

- 手順書タイトル
- 概要サマリー
- フェーズ一覧
- `開始` ボタン
- `戻る` ボタン

#### 作業実行画面

責務:

- 現在フェーズの本文表示
- ステップジャンプ
- 確認項目チェック
- コードブロックコピー
- 手順本文内リンクオープン
- フェーズ移動
- 未確認項目ありでの移動確認
- 中断保存とホーム復帰

主表示要素:

- 上部プログレスバー
- 現在フェーズタイトル
- フェーズ本文
- ステップセクション
- 確認項目チェック UI
- 手順本文内リンク
- `前のステップ` / `次のステップ`
- `戻る` / `次へ`
- `保存して中断`
- 未確認項目あり時の確認ダイアログ

#### 完了サマリー画面

責務:

- ローカル時刻での開始日時/完了日時表示
- 所要時間表示
- 出力済みエビデンスファイルの案内
- 出力先を OS のファイルブラウザで開く
- ホーム画面へ戻る導線

主表示要素:

- 完了メッセージ
- 実施サマリー
- 出力先パス表示
- `開く`
- 下段アクションカード内の `ホームへ戻る`

### 10.2 実行画面レイアウト

実行画面は以下の縦配置を基本とする。

1. 固定ヘッダ
2. フェーズ進捗バー
3. スクロール可能な本文領域
4. ステップジャンプ操作
5. フェーズ移動操作と `保存して中断`

小さいウィンドウでは、固定ヘッダと移動ボタンを優先表示し、本文領域を可変縮小する。
`保存して中断` はフェーズ移動操作の左側に配置し、`戻る` / `次へ` / `完了` は右下に寄せる。保存成功後はホーム画面へ戻る。

### 10.3 コードブロック表示

コードブロックは以下の UI を持つ。

- 言語ラベル
- 整形表示
- `コピー` ボタン
- コピー成功 / 失敗のトースト通知

### 10.4 手順本文内リンク表示

手順本文内リンクは Markdown 本文の一部として表示し、クリック時に以下を行う。

1. Renderer がクリックイベントを捕捉する
2. ブラウザ既定の画面遷移をキャンセルする
3. `href` を `openManualLink` API へ渡す
4. 成功時は必要に応じて短い通知を表示する
5. 失敗時はエラーバナーまたはトーストで理由を通知する

リンククリック中も画面状態は維持し、フェーズ位置、ステップ位置、確認項目状態は変更しない。
外部サイト URL を開く場合も、アプリ内には外部ページを表示しない。

## 11. 画面状態遷移設計

### 11.1 状態一覧

| 現在画面 | イベント | 条件 | 遷移先 |
| --- | --- | --- | --- |
| home | `.md` / `.zip` 読込成功 | 解析成功 | overview |
| home | `.session` 読込成功 | 元手順書再解析成功 | overview |
| home | 読込失敗 | なし | home |
| overview | 開始押下 | 手順書あり | execution |
| overview | 戻る押下 | なし | home |
| execution | 前/次フェーズ押下 | ガード条件を満たす | execution |
| execution | 手順本文内リンク押下 | リンクオープン成功または失敗 | execution |
| execution | 完了押下 | 最終フェーズで完了確認済み | completion |
| execution | 保存して中断押下 | 保存成功 | home |
| completion | ホームへ戻る | なし | home |

### 11.2 フェーズ移動ガード

- `次へ` は常に活性化する
- 現在フェーズの確認項目が全件完了している場合は、そのまま次フェーズへ進む
- 未確認項目が残っている場合に `次へ` を押すと、件数と未確認項目一覧を表示した確認ダイアログを出す
- 確認ダイアログで利用者が承認した場合のみ、`advanceMode = forced_with_pending` を記録して次フェーズへ進む
- 最終フェーズでは `次へ` の代わりに `完了` を表示し、未確認項目がある場合も同様の確認ダイアログを経て完了できる
- `戻る` は先頭フェーズでは非活性とする

確認ダイアログの文言は、「未確認項目が残っています。承知の上で次に進みますか。」を基本とし、未確認件数と対象項目を併記する。

### 11.3 ステップジャンプ

ステップジャンプは表示位置制御のみを行い、進捗状態は変更しない。

- `前のステップ`: 現在表示位置より前のステップ見出しへスクロール
- `次のステップ`: 現在表示位置より次のステップ見出しへスクロール

現在ステップ ID は表示位置の更新に追従して保持する。
ただしセッション保存対象として更新するのは、チェック変更時とフェーズ移動時を基本とする。

## 12. IPC / アプリケーション API 設計

### 12.1 Renderer から利用する API

Preload は以下の API を Renderer に公開する。

```ts
type WorkProcNaviApi = {
  loadDroppedFile(path: string): Promise<LoadManualResult>;
  saveSession(input: SaveSessionInput): Promise<SaveSessionResult>;
  exportEvidence(input: ExportEvidenceInput): Promise<ExportEvidenceResult>;
  abandonRuntime(runtimeManualId: string): Promise<void>;
  copyText(text: string): Promise<void>;
  openManualLink(input: OpenManualLinkInput): Promise<OpenManualLinkResult>;
  revealPath(path: string): Promise<void>;
  setCloseGuardEnabled(enabled: boolean): Promise<void>;
  getPathForFile(file: File): string | null;
};
```

### 12.2 主な DTO

```ts
type LoadManualResult =
  | { ok: true; manual: ManualDocument; session: SessionData | null }
  | { ok: false; error: AppError };

type SaveSessionInput = {
  manual: ManualDocument;
  session: SessionData;
};

type SaveSessionResult =
  | { ok: true; savedAt: string }
  | { ok: false; error: AppError };

type ExportEvidenceInput = {
  manual: ManualDocument;
  session: SessionData;
};

type ExportEvidenceResult =
  | { ok: true; outputPath: string }
  | { ok: false; error: AppError };

type OpenManualLinkInput = {
  href: string;
};

type ManualLinkKind = "externalUrl" | "fileDirectory" | "fileItem";

type OpenManualLinkResult =
  | { ok: true; kind: ManualLinkKind; openedPath?: string }
  | { ok: false; error: AppError };

type AppError = {
  code: string;
  message: string;
  recoverable: boolean;
  detail?: string;
};
```

### 12.3 手順本文内リンク API

`openManualLink` の Main Process 側処理は以下とする。

1. `href` を URL として解析する
2. プロトコルが `http:` または `https:` の場合、OS の既定外部ブラウザで開く
3. プロトコルが `file:` の場合、URL を実行 OS のパスへ変換する
4. `file:` の対象存在確認とファイル種別判定を行う
5. ディレクトリなら標準ファイルエクスプローラまたは Finder で開く
6. ファイルならファイル本体を開かず、親ディレクトリ内で対象ファイルを選択または表示する
7. 失敗時は `AppError` を返す

外部サイト URL のオープン失敗は `LINK_OPEN_FAILED` とする。
`file://` URL の解析失敗は `LINK_INVALID_URL`、対象不存在は `LINK_TARGET_NOT_FOUND`、OS への表示委譲失敗は `LINK_OPEN_FAILED` とする。
未許可プロトコルは `LINK_UNSUPPORTED_PROTOCOL` とする。

## 13. 一時ファイル・ライフサイクル設計

### 13.1 展開ディレクトリ

ZIP 展開先は OS 一時ディレクトリ配下とし、以下の命名規則を用いる。

```text
<os-temp>/work-proc-navi/<runtimeManualId>/
```

`runtimeManualId` はアプリ起動中に一意な UUID とする。

### 13.2 削除タイミング

展開ディレクトリは以下の契機で削除する。

- ZIP 由来手順書の完了時
- ホーム画面へ戻る際に現在手順を破棄した時
- アプリ終了時

削除失敗時はログ出力し、次回起動時に不要ディレクトリ掃除を試行する。

## 14. エラー処理設計

### 14.1 エラー分類

| 分類 | 例 | 画面動作 |
| --- | --- | --- |
| 入力エラー | 拡張子不正、ZIP 構造不正 | ホーム画面に留まる |
| 構造エラー | フェーズ不足、確認項目不足 | ホーム画面に留まる |
| 再開エラー | 元ファイル不存在、ID 不整合 | ホーム画面に留まる |
| 保存エラー | `.session` 書込失敗 | 実行画面に留まり再試行可能 |
| 出力エラー | `.log` 書込失敗 | 実行画面に留まり再試行可能 |
| 参照エラー | 画像ファイル不存在 | 該当箇所に代替表示し処理継続 |
| リンクオープンエラー | 未許可プロトコル、対象不存在、OS 委譲失敗 | 実行画面を維持して通知 |

### 14.2 エラーコード

初期版では以下のコードを定義する。

- `INPUT_UNSUPPORTED_EXTENSION`
- `INPUT_READ_FAILED`
- `ZIP_INVALID_STRUCTURE`
- `ZIP_MARKDOWN_NOT_FOUND`
- `ZIP_MARKDOWN_MULTIPLE`
- `MARKDOWN_INVALID_STRUCTURE`
- `SESSION_INVALID_JSON`
- `SESSION_SOURCE_NOT_FOUND`
- `SESSION_STATE_MISMATCH`
- `SESSION_SAVE_FAILED`
- `EVIDENCE_EXPORT_FAILED`
- `OUTPUT_REVEAL_FAILED`
- `ASSET_NOT_FOUND`
- `LINK_INVALID_URL`
- `LINK_UNSUPPORTED_PROTOCOL`
- `LINK_TARGET_NOT_FOUND`
- `LINK_OPEN_FAILED`

### 14.3 表示方針

- 開始前エラーはホーム画面のメッセージ領域に表示する
- 実行中エラーは画面内のエラーバナーで通知する
- 画像参照失敗は本文内にプレースホルダを表示する
- リンクオープン失敗は画面遷移せず、エラーバナーまたはトーストで通知する

## 15. モジュール構成

### 15.1 Main Process 側モジュール

- `src/main.ts`
  Electron 起動、BrowserWindow 生成、終了処理
- `src/preload.ts`
  Renderer に公開する API の定義と IPC ブリッジ
- `src/main/ipc.ts`
  IPC ハンドラ定義
- `src/main/manual-loader.ts`
  入力ファイル種別判定、ZIP 展開、Markdown 読込
- `src/main/manual-parser.ts`
  AST 解析と `ManualDocument` 生成
- `src/main/session-store.ts`
  セッション読込・保存・削除
- `src/main/evidence-writer.ts`
  `.log` 生成
- `src/main/link-opener.ts`
  手順本文内リンクのプロトコル検証、`file://` URL の OS パス変換、既定ブラウザまたはファイルブラウザへの委譲
- `src/main/asset-protocol.ts`
  画像カスタムプロトコル提供
- `src/main/runtime-registry.ts`
  `runtimeManualId` とソースルートの対応管理
- `src/main/path-utils.ts`
  手順書、セッション、エビデンスのファイルパス規則
- `src/main/errors.ts`
  アプリ内エラー DTO の生成と整形

### 15.2 Renderer 側モジュール

- `src/renderer/App.tsx`
  画面状態、イベント処理、ホーム/概要/実行/完了画面の描画
- `src/renderer/components/ProgressBar.tsx`
  フェーズ進捗バー
- `src/renderer/components/RenderBlocks.tsx`
  本文ブロック描画、手順本文内リンククリック捕捉
- `src/renderer/components/ConfirmChecklist.tsx`
  確認項目表示
- `src/renderer/main.tsx`
  Renderer のエントリポイント
- `src/renderer/styles.css`
  アプリ全体のスタイル定義

## 16. テスト観点

### 16.1 単体テスト

- Markdown 構造抽出
- ZIP 内 Markdown 検出
- 画像相対パス解決
- 手順本文内リンクの許可プロトコル判定
- `file://` URL の OS 別パス正規化
- `file://` がファイルを指す場合にファイル本体を直接開かず親フォルダ表示になること
- セッション JSON バリデーション
- エビデンス Markdown 生成
- フェーズ移動ガード判定
- 未確認項目ありでの強制遷移記録
- 強制遷移を含むエビデンス Markdown 生成

### 16.2 結合テスト

- `.md` ドロップから開始まで
- `.zip` ドロップから画像表示まで
- `.session` ドロップから再開まで
- 外部サイト URL のクリックで既定ブラウザへ委譲され、アプリ画面が遷移しないこと
- `file://` フォルダリンクのクリックで標準ファイルエクスプローラまたは Finder が開くこと
- `file://` ファイルリンクのクリックでファイル本体が開かず、親フォルダで対象が表示されること
- チェック更新から `.session` 保存まで
- 完了から `.log` 出力、`.session` 削除まで
- 未確認項目ありで次フェーズへ進み、再開後も履歴が維持されること

### 16.3 異常系テスト

- ZIP 内 Markdown 0 件
- ZIP 内 Markdown 複数件
- 手順書構造不足
- セッション JSON 破損
- 元手順書消失
- 保存先権限不足
- 画像ファイル欠損
- 未許可プロトコルのリンク
- 存在しない `file://` リンク
- 未確認項目ありで完了し、エビデンスに注意書きが出ること

## 17. 実装優先順

実装は以下の順で進める。

1. Electron 起動基盤と IPC の土台
2. `.md` / `.zip` / `.session` 読込
3. Markdown 解析と `ManualDocument` 生成
4. 概要画面と実行画面
5. 手順本文内リンクの安全な外部オープン
6. チェック更新とセッション保存
7. 完了処理とエビデンス出力
8. 異常系処理と後始末

この順序により、まず読める、次に進められる、最後に保存・証跡化できる、という価値の高い順に機能を積み上げる。
