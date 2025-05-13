
# Portfolio Market Data API テストログ
実行日時: 2025-05-13T09:43:50.382Z
所要時間: 1174ms

## 統計情報
- 合計テスト数: 27
- 成功: 27
- 失敗: 0
- 保留: 0

## コードカバレッジ情報
- ステートメント: 5.73% (目標: 80%)
- ブランチ: 5.82% (目標: 70%)
- 関数: 4.08% (目標: 80%)
- 行: 5.89% (目標: 80%)

全体のコードカバレッジは 5.38% です。
これは、テストによって動作が保証されているコードの割合を示しています。

## テストスイート別結果

### googleLogin.test.js
- 合計: 6
- 成功: 6
- 失敗: 0
- 成功率: 100.0%


#### Google Login Handler 正常なGoogleログイン処理の実行
- 状態: ✓ 合格


#### Google Login Handler 認証コードなしでの呼び出し
- 状態: ✓ 合格


#### Google Login Handler 認証コード交換エラー時の処理
- 状態: ✓ 合格


#### Google Login Handler IDトークン検証エラー時の処理
- 状態: ✓ 合格


#### Google Login Handler セッション作成エラー時の処理
- 状態: ✓ 合格


#### Google Login Handler 完全な認証フロー（ログイン→セッション確認→ログアウト）
- 状態: ✓ 合格



### API_test.js
- 合計: 9
- 成功: 9
- 失敗: 0
- 成功率: 100.0%


#### Portfolio Market Data API E2Eテスト マーケットデータAPI 米国株データ取得
- 状態: ✓ 合格


#### Portfolio Market Data API E2Eテスト マーケットデータAPI 日本株データ取得
- 状態: ✓ 合格


#### Portfolio Market Data API E2Eテスト マーケットデータAPI 投資信託データ取得
- 状態: ✓ 合格


#### Portfolio Market Data API E2Eテスト マーケットデータAPI 為替レートデータ取得
- 状態: ✓ 合格


#### Portfolio Market Data API E2Eテスト マーケットデータAPI 無効なパラメータでのエラーハンドリング
- 状態: ✓ 合格


#### Portfolio Market Data API E2Eテスト 認証API 認証フロー: ログイン、セッション取得、ログアウト
- 状態: ✓ 合格


#### Portfolio Market Data API E2Eテスト Google Drive API ポートフォリオデータの保存と読み込み
- 状態: ✓ 合格


#### Portfolio Market Data API E2Eテスト Google Drive API 認証なしでのアクセス拒否
- 状態: ✓ 合格


#### Portfolio Market Data API E2Eテスト API基本機能 ヘルスチェックエンドポイント
- 状態: ✓ 合格



### responseUtils.test.js
- 合計: 12
- 成功: 12
- 失敗: 0
- 成功率: 100.0%


#### responseUtils formatResponse デフォルトパラメータでの正常レスポンス
- 状態: ✓ 合格


#### responseUtils formatResponse カスタムステータスコードとヘッダーでの正常レスポンス
- 状態: ✓ 合格


#### responseUtils formatResponse 予算警告スキップオプション
- 状態: ✓ 合格


#### responseUtils formatErrorResponse デフォルトパラメータでのエラーレスポンス
- 状態: ✓ 合格


#### responseUtils formatErrorResponse 詳細エラー情報を含むエラーレスポンス（開発環境用）
- 状態: ✓ 合格


#### responseUtils formatErrorResponse 使用量情報を含むエラーレスポンス
- 状態: ✓ 合格


#### responseUtils formatRedirectResponse デフォルトの一時的リダイレクト
- 状態: ✓ 合格


#### responseUtils formatRedirectResponse 恒久的リダイレクト
- 状態: ✓ 合格


#### responseUtils formatOptionsResponse デフォルトのOPTIONSレスポンス
- 状態: ✓ 合格


#### responseUtils formatOptionsResponse カスタムヘッダー付きのOPTIONSレスポンス
- 状態: ✓ 合格


#### responseUtils handleOptions OPTIONSメソッドの処理
- 状態: ✓ 合格


#### responseUtils handleOptions OPTIONSメソッド以外の処理
- 状態: ✓ 合格




## エラーサマリー


## カバレッジ改善のヒント
- テスト自体はすべて成功しています（27/27）
- カバレッジが低い理由は、テストケースの数が限られているためです
- 重要なモジュールから順にテストを追加していくことで、カバレッジを徐々に向上させましょう
- 特に src/utils/dynamoDbService.js と src/services/googleAuthService.js のテストを強化すると効果的です
    