# WorkProcNavi

作業手順書をそのまま読み込み、フェーズごとに確認しながら進められるローカルデスクトップアプリです。Markdown 手順書や ZIP パッケージをドラッグ＆ドロップするだけで、手順の開始、途中保存、再開、エビデンス出力までを一貫して行えます。

## Overview

WorkProcNavi は、文書として管理されている手順書を「実行しやすい作業ナビ」に変えるための Electron アプリです。  
現場作業や定型業務で起こりやすい確認漏れや再開時の迷いを減らし、オフライン環境でも軽量に運用できることを重視しています。

## Features

- `.md` / `.zip` / `.session` ファイルのドラッグ＆ドロップ読込
- フェーズ数、ステップ数、確認項目数を含む概要表示
- フェーズ単位の作業ガイドと進捗表示
- 確認項目チェックの即時保存
- `保存して中断` によるセッション保存と再開
- 作業完了時のエビデンス Markdown 出力
- コードブロックのワンクリックコピー
- 手順本文リンクの安全な外部オープンと URI ホバー表示
- ローカル完結、オフライン利用前提

## Supported Files

- 手順書: `.md`
- 手順書パッケージ: `.zip`
- セッションファイル: `.session`
- 完了後の出力: `.log` (Markdown)

## Quick Start

### 1. 依存関係をインストール

```bash
npm install
```

### 2. 開発モードで起動

```bash
npm run dev
```

### 3. ビルド

```bash
npm run build
```

配布用アイコンは [`resources/icon.png`](./resources/icon.png) を `electron-builder` が直接参照します。
OS 依存の前処理は行わないため、通常ビルド自体は macOS 専用コマンドに依存しません。

ビルド成果物を削除する場合は、次のコマンドを実行します。

```bash
npm run clean
```

必要に応じて配布物も作成できます。

```bash
npm run dist:mac
npm run dist:win
```

`npm run dist:win` はポータブル版の `WorkProcNavi.exe` を生成し、その EXE を同名で含む ZIP を作成します。

## Usage

1. アプリを起動します。
2. 手順書ファイル (`.md` または `.zip`) をウィンドウへドラッグ＆ドロップします。
3. 概要画面でフェーズ数や確認項目数を確認し、`開始する` を押します。
4. 各ステップの確認項目をチェックしながら作業を進めます。
5. 中断する場合は `保存して中断` を押し、次回は `.session` ファイルをドロップして再開します。
6. 最終フェーズ完了後、エビデンスファイル (`.log`) が出力されます。

手順本文リンクにマウスカーソルを合わせると、0.5 秒後にリンク先 URI が表示されます。リンクの上から外れると表示は消えます。

## Manual Format

手順書は以下の Markdown 構造を前提としています。

- `#` : 手順書タイトル
- `##` : フェーズ
- `###` : ステップ
- `- [ ]` : 確認項目

画像の相対参照やコードブロックも利用できます。サンプルは [`samples/`](./samples) を参照してください。

## Project Documents

- [基本設計](./docs/basic_design.md)
- [詳細設計](./docs/detail_design.md)

## Development

- Tech stack: Electron, React, TypeScript, Vite
- Test:

```bash
npm test
```

## License

このリポジトリは [MIT License](./LICENSE) のもとで公開します。
