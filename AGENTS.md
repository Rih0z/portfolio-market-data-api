# Portfolio Market Data API - Codex エージェントガイド

> **注意**: このドキュメントはCodexエージェント向けのガイドラインです。詳細情報は各トピック専用ドキュメントを参照してください。

## プロジェクト概要

Portfolio Market Data APIは、投資ポートフォリオ管理のための金融データAPIサービスです。米国株、日本株、投資信託、為替レート情報を様々なデータソースから取得し、統一的なインターフェースで提供します。また、Google認証、Google Driveとの連携、キャッシュ機能、フォールバックデータ管理などの機能を備えています。

このAPIはAWS Lambda上で動作するように設計されており、DynamoDB、SNSなどのAWSサービスを活用しています。

## 主要な機能と特徴

1. **複数のデータソース対応**
   - Yahoo Finance API
   - スクレイピング（Yahoo Finance、Yahoo Finance Japan、Minkabu、Kabutan、MarketWatch）
   - モーニングスターCSVデータ
   - 為替レートAPI

2. **高い可用性**
   - キャッシュ機能
   - フォールバックデータ管理
   - 複数ソースからの段階的取得
   - スクレイピングブラックリスト

3. **認証とセキュリティ**
   - Google OAuth認証
   - セッション管理
   - API Keyベースの管理者認証

4. **Google Drive連携**
   - ポートフォリオデータの保存
   - ファイル一覧取得
   - データ読み込み

## プロジェクトドキュメント一覧

以下にプロジェクトの主要ドキュメントとその内容を示します：

### 設計・仕様書
- `document/specification.md` - 技術仕様書：システムアーキテクチャ、機能モジュール、データフロー、外部サービス連携などの詳細説明
- `document/structure-and-modules.md` - プロジェクト構造とモジュール説明：ディレクトリ構造、各ファイルの役割と機能の詳細解説

### コーディング規約
- `document/code-convention.md` - コード規約書：命名規則、スタイルガイド、ファイル構造、エラー処理など詳細なコーディング規約

### API・連携ガイド
- `document/how-to-call-api.md` - API利用ガイド：APIの基本的な使い方、認証、エラーハンドリング、Reactでの実装例など
- `document/google-auth-flow.mmd` - Google認証のシーケンス図
- `document/google-auth-process.mmd` - Google認証プロセスの詳細シーケンス図
- `document/google-drive.mmd` - Google Drive連携のシーケンス図
- `document/google.mmd` - Google連携の簡易シーケンス図
- `document/market-data-flow.mmd` - マーケットデータ取得のフローチャート

### テスト関連
- `document/how-to-make-test.md` - テストファイル作成ガイドライン：テストの実装方法、構造、ベストプラクティス
- `document/how-to-make-test-mock.md` - モックテスト戦略ガイド：モック化の問題と修正方針、具体的な実装例
- `document/how-to-test.md` - テスト実行ガイド：テスト環境のセットアップと実行方法
- `document/test-plan.md` - テスト計画書：現在のテスト実装状況、未実装テスト一覧、優先順位

### デプロイ・運用
- `document/deploy-guide.md` - MacBook向けデプロイガイド：開発・デプロイ手順、Docker不要のテスト環境構築方法、トラブルシューティング

## コーディング規約

### 一般規則

1. **コードスタイル**
   - セミコロンを使用する
   - シングルクォート（'）を使用する
   - インデントはスペース2文字
   - 関数宣言は `const functionName = () => {}` 形式を優先

2. **エラーハンドリング**
   - すべての非同期関数呼び出しは try/catch でラップする
   - 詳細なエラーメッセージを提供する
   - エラーは常にログに記録する

3. **ログ出力**
   - `logger.js` を使用し、直接 `console.log` を使用しない
   - 適切なログレベル（debug、info、warn、error、critical）を使用する

詳細な規約については `document/code-convention.md` を参照してください。

### モジュール構造

1. **サービスモジュール設計**
   - 自己参照オブジェクトパターンを使用する
   ```javascript
   // 推奨パターン
   const serviceModule = {
     method1: function(param1) {
       // 実装...
     },
     
     method2: function(param1) {
       // 同じモジュール内の他のメソッドを呼び出す場合
       return serviceModule.method1(param1);
     }
   };
   
   module.exports = serviceModule;
   ```

2. **インポート/エクスポートの一貫性**
   ```javascript
   // 推奨パターン
   const service = {
     method1: () => { /* 実装 */ },
     method2: () => { /* 実装 */ }
   };
   module.exports = service;
   
   // 避けるべきパターン
   exports.method1 = () => { /* 実装 */ };
   module.exports.method2 = () => { /* 実装 */ };
   ```

## API規約

### エンドポイント構造

- **マーケットデータ**: `/api/market-data`
- **認証**: `/auth/*`
- **Google Drive連携**: `/drive/*`
- **管理者**: `/admin/*`

詳細なAPI仕様については、[API利用ガイド](document/how-to-call-api.md)を参照してください。

## テスト戦略

### テスト種類

1. **ユニットテスト**: 個々の関数やクラスの機能をテスト
2. **統合テスト**: 複数のコンポーネントの連携をテスト
3. **E2Eテスト**: エンドユーザーの視点からシステム全体の動作をテスト

詳細なテスト方法については以下のドキュメントを参照してください：
- [テスト作成ガイドライン](document/how-to-make-test.md)
- [テスト実行ガイド](document/how-to-test.md)
- [モックテスト戦略ガイド](document/how-to-make-test-mock.md)
- [テスト計画書](document/test-plan.md)

## 主要ファイル構造

```
src/
├── config/            # 設定ファイル
│   ├── constants.js   # 定数定義
│   └── envConfig.js   # 環境変数設定
├── function/          # Lambda関数ハンドラー
│   ├── admin/         # 管理者向けAPI
│   ├── auth/          # 認証関連API
│   ├── drive/         # Google Drive連携API
│   ├── marketData.js  # 市場データAPI
│   └── preWarmCache.js # キャッシュ予熱
├── services/          # サービスモジュール
│   ├── alerts.js      # アラート通知
│   ├── cache.js       # キャッシュ
│   ├── googleAuthService.js # Google認証
│   └── sources/       # データソース別サービス
└── utils/             # ユーティリティ関数
    ├── awsConfig.js   # AWS設定
    ├── logger.js      # ロギング
    └── responseUtils.js # レスポンス処理
```

詳細なファイル構造とモジュール説明は[プロジェクト構造とモジュール説明ドキュメント](document/structure-and-modules.md)を参照してください。

## ドキュメント更新ポリシー

> **重要**: システムの更新・機能追加・バグ修正を行った場合は、必ず関連するドキュメントも更新してください。ドキュメントとコードの整合性を保つことは、プロジェクトの保守性と品質向上に不可欠です。

更新すべきドキュメントの判断基準：
- APIインターフェースの変更 → `how-to-call-api.md`
- データフローやアーキテクチャの変更 → `specification.md` および関連する `.mmd` ファイル
- 新しいモジュールの追加 → `structure-and-modules.md`
- テスト手法の変更 → テスト関連ドキュメント
- デプロイ手順の変更 → `deploy-guide.md`

コードレビュー時には、ドキュメント更新の有無も確認事項に含めてください。

## 推奨する開発フロー

1. **機能追加/変更プロセス**
   - 仕様理解と設計
   - ユニットテスト作成
   - 実装
   - ユニットテストの実行・修正
   - 統合テスト
   - E2Eテスト
   - ドキュメント更新
   - デプロイ

2. **コードレビュープロセス**
   - コーディング規約準拠
   - 適切なエラーハンドリング
   - テストカバレッジ確認 (目標: 80%)
   - パフォーマンス考慮点
   - ドキュメント更新確認

3. **テスト実行方法**
   ```bash
   # 開発中はリアルタイムテスト
   npm run test:dev
   
   # プルリクエスト前に全テスト
   npm run test:full:mock
   
   # デプロイ前に実環境テスト
   npm run test:full:auto
   ```

詳細なテスト実行方法については[テスト実行ガイド](document/how-to-test.md)を参照してください。
