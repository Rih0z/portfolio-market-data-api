
# Portfolio Market Data API テストログ
実行日時: 2025-05-12T08:59:10.849Z
所要時間: 2938ms

## 統計情報
- 合計テスト数: 18
- 成功: 15
- 失敗: 3
- 保留: 0

## テストスイート別結果

### responseUtils.test.js
- 合計: 12
- 成功: 11
- 失敗: 1
- 成功率: 91.7%


#### responseUtils formatResponse デフォルトパラメータでの正常レスポンス
- 状態: ✓ 合格


#### responseUtils formatResponse カスタムステータスコードとヘッダーでの正常レスポンス
- 状態: ✗ 不合格
- エラー:
```
TypeError: Cannot read properties of undefined (reading 'statusCode')
    at Object.statusCode (/Users/kokiriho/Documents/Projects/pfwise-api/__tests__/unit/utils/responseUtils.test.js:70:23)
    at processTicksAndRejections (node:internal/process/task_queues:105:5)
```

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



### googleLogin.test.js
- 合計: 6
- 成功: 4
- 失敗: 2
- 成功率: 66.7%


#### Google Login Handler 正常なGoogleログイン処理の実行
- 状態: ✗ 不合格
- エラー:
```
Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBeDefined[2m()[22m

Received: [31mundefined[39m
    at Object.toBeDefined (/Users/kokiriho/Documents/Projects/pfwise-api/__tests__/integration/auth/googleLogin.test.js:153:30)
    at processTicksAndRejections (node:internal/process/task_queues:105:5)
```

#### Google Login Handler 認証コードなしでの呼び出し
- 状態: ✓ 合格


#### Google Login Handler 認証コード交換エラー時の処理
- 状態: ✓ 合格


#### Google Login Handler IDトークン検証エラー時の処理
- 状態: ✓ 合格


#### Google Login Handler セッション作成エラー時の処理
- 状態: ✓ 合格


#### Google Login Handler 完全な認証フロー（ログイン→セッション確認→ログアウト）
- 状態: ✗ 不合格
- エラー:
```
Error: [2mexpect([22m[31mjest.fn()[39m[2m).[22mtoHaveBeenCalledWith[2m([22m[32m...expected[39m[2m)[22m

Expected: [32m"complete-flow-session-id"[39m

Number of calls: [31m0[39m
    at Object.toHaveBeenCalledWith (/Users/kokiriho/Documents/Projects/pfwise-api/__tests__/integration/auth/googleLogin.test.js:434:42)
    at processTicksAndRejections (node:internal/process/task_queues:105:5)
```


### API_test.js
- 合計: 0
- 成功: 0
- 失敗: 0
- 成功率: NaN%




## エラーサマリー

### エラー #1: responseUtils formatResponse カスタムステータスコードとヘッダーでの正常レスポンス
```
TypeError: Cannot read properties of undefined (reading 'statusCode')
    at Object.statusCode (/Users/kokiriho/Documents/Projects/pfwise-api/__tests__/unit/utils/responseUtils.test.js:70:23)
    at processTicksAndRejections (node:internal/process/task_queues:105:5)
```

### エラー #2: Google Login Handler 正常なGoogleログイン処理の実行
```
Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBeDefined[2m()[22m

Received: [31mundefined[39m
    at Object.toBeDefined (/Users/kokiriho/Documents/Projects/pfwise-api/__tests__/integration/auth/googleLogin.test.js:153:30)
    at processTicksAndRejections (node:internal/process/task_queues:105:5)
```

### エラー #3: Google Login Handler 完全な認証フロー（ログイン→セッション確認→ログアウト）
```
Error: [2mexpect([22m[31mjest.fn()[39m[2m).[22mtoHaveBeenCalledWith[2m([22m[32m...expected[39m[2m)[22m

Expected: [32m"complete-flow-session-id"[39m

Number of calls: [31m0[39m
    at Object.toHaveBeenCalledWith (/Users/kokiriho/Documents/Projects/pfwise-api/__tests__/integration/auth/googleLogin.test.js:434:42)
    at processTicksAndRejections (node:internal/process/task_queues:105:5)
```

    