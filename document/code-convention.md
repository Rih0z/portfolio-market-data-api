# コード規約書: portfolio-market-data-api

## 1. 基本情報

### 1.1 目的と適用範囲
本規約は、portfolio-market-data-api プロジェクトのコードの一貫性、可読性、保守性を確保するために作成されました。すべての新規コードと既存コードの修正に適用されます。

### 1.1.1 著者情報
- **著者**: Koki Riho (https://github.com/Rih0z)
- **貢献者**: Portfolio Manager Team

### 1.2 使用言語とバージョン
- **言語**: JavaScript (Node.js)
- **Node.js バージョン**: 14.x 以上
- **コードモード**: 'use strict' モード
- **モジュール形式**: CommonJS (require/module.exports)
- **AWS SDK バージョン**: v3 推奨 (移行中のコードベース)

### 1.3 参照すべき外部規約や標準
- [JavaScript Standard Style](https://standardjs.com/) - ベースとなる指針として参照
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript) - より詳細な規約の参考として

## 2. ファイルヘッダー情報

すべてのソースファイルには以下の形式のヘッダーコメントを含めてください：

```javascript
/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/path/to/file.js
 * 
 * 説明: 
 * ファイルの目的と機能の簡潔な説明。
 * 複数行になる場合は適切に改行してください。
 * 
 * @author Portfolio Manager Team
 * @created YYYY-MM-DD
 * @updated YYYY-MM-DD - 更新内容の簡単な説明
 */
```

必要に応じて、更新履歴を追加できます：

```javascript
 * @updated YYYY-MM-DD - 名前 - 変更内容の簡単な説明
```

## 3. 書式とスタイル

### 3.1 インデント
- 2スペースを使用します
- タブ文字は使用しないでください

```javascript
// 良い例
function example() {
  if (condition) {
    doSomething();
  }
}

// 悪い例
function example() {
    if (condition) {
        doSomething();
    }
}
```

### 3.2 行の長さ
- 最大100文字を目安とします
- それを超える場合は適切に改行してください

```javascript
// 良い例
const longFunction = function(
  parameterOne,
  parameterTwo,
  parameterThree
) {
  // 処理内容
};

// 悪い例
const longFunction = function(parameterOne, parameterTwo, parameterThree, parameterFour, parameterFive) {
  // 処理内容
};
```

### 3.3 空行の使用
- 論理的なコードブロックの間に1行の空行を入れてください
- ファイル先頭の'use strict'宣言後に1行の空行を入れてください
- メソッド/関数の間には1行の空行を入れてください
- 関連するコード群はグループ化し、別のグループとの間に空行を入れてください

```javascript
'use strict';

const util = require('util');
const aws = require('aws-sdk');

// Constants
const TIMEOUT = 5000;
const MAX_RETRIES = 3;

// 機能実装
function mainFunction() {
  // ...
}

function helperFunction() {
  // ...
}
```

### 3.4 括弧の配置
- K&R スタイルを使用します（開始括弧は同じ行に配置）

```javascript
// 良い例
if (condition) {
  doSomething();
} else {
  doSomethingElse();
}

// 悪い例
if (condition)
{
  doSomething();
}
else
{
  doSomethingElse();
}
```

### 3.5 スペースの使用
- 演算子の前後にスペースを入れてください
- カンマの後にスペースを入れてください
- コロンの後にスペースを入れてください（オブジェクトリテラル内）
- 関数呼び出しの括弧の前にはスペースを入れないでください
- 制御文の括弧の前にはスペースを入れてください

```javascript
// 良い例
const x = a + b;
const arr = [1, 2, 3];
const obj = { key: value };
doSomething(param);
if (condition) {
  // ...
}

// 悪い例
const x=a+b;
const arr=[1,2,3];
const obj={key:value};
doSomething (param);
if(condition){
  // ...
}
```

### 3.6 文字列
- 基本的にシングルクォート（'）を使用してください
- テンプレートリテラルを使用する場合はバッククォート（`）を使用してください

```javascript
// 良い例
const name = 'John';
const greeting = `Hello, ${name}!`;

// 悪い例
const name = "John";
```

### 3.7 セミコロン
- すべてのステートメントの末尾にセミコロンを使用してください

```javascript
// 良い例
const value = 42;
doSomething();

// 悪い例
const value = 42
doSomething()
```

## 4. 命名規則

### 4.1 変数
- **ローカル変数**: camelCase
  ```javascript
  const connectionString = 'example';
  let itemCount = 0;
  ```

- **プライベート変数**: 先頭にアンダースコアを付けたcamelCase
  ```javascript
  const _privateVariable = 'internal use only';
  ```

### 4.2 関数/メソッド
- camelCase を使用してください
- 動詞または動詞句から始めてください
  ```javascript
  function calculateTotal() { /* ... */ }
  const getUserData = async () => { /* ... */ };
  ```

- boolean を返す関数は is, has, should などから始めてください
  ```javascript
  function isValidInput(input) { /* ... */ }
  function hasPermission(user, resource) { /* ... */ }
  ```

### 4.3 クラス/オブジェクト
- PascalCase を使用してください
  ```javascript
  class DataService { /* ... */ }
  ```

### 4.4 定数
- UPPER_SNAKE_CASE を使用してください
  ```javascript
  const MAX_RETRY_COUNT = 3;
  const DEFAULT_TIMEOUT = 5000;
  ```

### 4.5 ファイル名
- camelCase を使用してください
- 拡張子は .js を使用してください
- ファイル名は内容を表す名詞にしてください
  ```
  dataFetchUtils.js
  responseFormatter.js
  cacheService.js
  ```

### 4.6 避けるべき命名パターン
- 意味のない短い変数名（`a`, `b`, `x`, `y` など）は避けてください
- センシティブな情報を連想させる変数名（`password`, `secret` など）は避けてください
- `temp`, `tmp` などの一時的な変数名は避けてください
- 日本語のローマ字表記の変数名は避けてください

## 5. コード構造

### 5.1 ファイル構成
- 1ファイルあたり最大500行を目安としてください
- 1ファイルは1つの責務に集中してください（単一責任の原則）
- ファイル構成は以下の順序を推奨します：
  1. 'use strict' 宣言
  2. モジュールインポート
  3. 定数定義
  4. ユーティリティ関数
  5. メイン機能の実装
  6. モジュールエクスポート

```javascript
'use strict';

// インポート
const aws = require('aws-sdk');
const { withRetry } = require('../utils/retry');

// 定数
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;

// ユーティリティ関数
function parseResponse(response) {
  // ...
}

// メイン機能
async function getDataFromApi() {
  // ...
}

// エクスポート
module.exports = {
  getDataFromApi
};
```

### 5.2 関数/メソッドの設計
- 1関数あたり最大50行を目安としてください
- 単一責任の原則に従ってください
- 複雑な処理は小さな関数に分割してください
- 関数は1レベルのインデントを超えないように設計してください（理想的には）

```javascript
// 良い例: 小さな関数に分割
function processData(data) {
  const validated = validateData(data);
  const transformed = transformData(validated);
  return formatResult(transformed);
}

function validateData(data) { /* ... */ }
function transformData(data) { /* ... */ }
function formatResult(data) { /* ... */ }

// 悪い例: 単一の大きな関数
function processData(data) {
  // 検証ロジック（20行）
  // ...

  // 変換ロジック（30行）
  // ...

  // フォーマットロジック（20行）
  // ...

  return result;
}
```

### 5.3 モジュール構成
- 以下のディレクトリ構造に従います：
  - `src/config/`: アプリケーションの設定
  - `src/function/`または`src/functions/`: API エンドポイントのハンドラー関数（注: 現状では両方の形式が混在しています）
  - `src/services/`: ビジネスロジックとデータアクセス
  - `src/services/sources/`: データソースアダプター
  - `src/utils/`: ユーティリティ関数

### 5.4 再利用可能なコードの抽出
- 複数の場所で使われる機能はユーティリティ関数として抽出してください
- 関連する機能はサービスにグループ化してください
- データソースに対するアクセスは専用のモジュールに分離してください

## 6. プログラミング慣習

### 6.1 条件文と分岐
- 早期リターンパターンを使用してください
- ネストされた if 文は可能な限り避けてください
- 三項演算子は単純な条件にのみ使用してください

```javascript
// 良い例: 早期リターン
function processUser(user) {
  if (!user) {
    return null;
  }
  
  if (!user.isActive) {
    return { error: 'User is not active' };
  }
  
  // メイン処理
  return doSomethingWithUser(user);
}

// 悪い例: ネストされた条件
function processUser(user) {
  if (user) {
    if (user.isActive) {
      // メイン処理
      return doSomethingWithUser(user);
    } else {
      return { error: 'User is not active' };
    }
  } else {
    return null;
  }
}
```

### 6.2 ループの書き方
- 可能な限り、配列メソッド（map, filter, reduce, forEach）を使用してください
- 古典的な for ループは複雑なループにのみ使用してください

```javascript
// 良い例
const doubled = numbers.map(num => num * 2);
const evens = numbers.filter(num => num % 2 === 0);
const sum = numbers.reduce((total, num) => total + num, 0);

// 悪い例
const doubled = [];
for (let i = 0; i < numbers.length; i++) {
  doubled.push(numbers[i] * 2);
}
```

### 6.3 エラー処理と例外
- Promise を拒否するときはエラーオブジェクトを使用してください
- try-catch ブロックで適切にエラーをハンドリングしてください
- エラーは意味のあるメッセージで投げてください
- エラーのロギングは詳細に行ってください
- エラーハンドリングのレベルを適切に設定してください（末端のハンドラーでキャッチするか、呼び出し元に伝播させるか）

```javascript
// 良い例
try {
  const result = await riskyOperation();
  return formatSuccess(result);
} catch (error) {
  logger.error(`Operation failed: ${error.message}`, { error, context });
  
  // エラータイプによって異なる処理
  if (error.code === 'NETWORK_ERROR') {
    return formatErrorResponse(error, errorTypes.NETWORK_ERROR);
  } else {
    return formatErrorResponse(error, errorTypes.SERVER_ERROR);
  }
}

// 悪い例
try {
  const result = await riskyOperation();
  return formatSuccess(result);
} catch (error) {
  console.error('Error occurred');
  return { error: 'Something went wrong' };
}
```

### 6.4 非同期処理
- async/await パターンを使用してください
- Promise チェーンよりも async/await を優先してください
- Promise.all() を使って並列処理を最適化してください
- Promise.allSettled() を使って一部の失敗を許容する並列処理を実装してください

```javascript
// 良い例
async function processItems(items) {
  try {
    const results = await Promise.all(items.map(item => processItem(item)));
    return results;
  } catch (error) {
    logger.error('Failed to process items', error);
    throw error;
  }
}

// 一部の失敗を許容する例
async function processItemsWithPartialFailure(items) {
  const results = await Promise.allSettled(items.map(item => processItem(item)));
  
  const successes = results
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value);
  
  const failures = results
    .filter(result => result.status === 'rejected')
    .map(result => result.reason);
  
  logger.info(`Processed ${successes.length} items successfully, ${failures.length} failures`);
  
  if (failures.length > 0) {
    logger.warn('Some items failed to process', { failures });
  }
  
  return { successes, failures };
}
```

### 6.5 再試行ロジック
- 外部リソースへのアクセスには `withRetry` ユーティリティを使用してください
- 指数バックオフと適切な最大再試行回数を設定してください
- 再試行すべきエラータイプを明示的に定義してください

```javascript
// 良い例
const result = await withRetry(
  () => externalApiCall(params),
  {
    maxRetries: 3,
    baseDelay: 500,
    shouldRetry: isRetryableApiError
  }
);
```

### 6.6 AWS SDK の使用
- AWS SDK v3 を推奨します（移行中のコードベース）
- プロジェクト内で AWS クライアントを一元化して管理してください
- 環境に応じたエンドポイント設定を行ってください
- 認証情報は環境変数または IAM ロールから取得してください

```javascript
// AWS SDK v3 の使用例
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const getDynamoDbClient = () => {
  const options = {
    region: process.env.AWS_REGION || 'ap-northeast-1'
  };
  
  // 開発環境ではローカルエンドポイントを使用
  if (process.env.NODE_ENV === 'development' && process.env.DYNAMODB_ENDPOINT) {
    options.endpoint = process.env.DYNAMODB_ENDPOINT;
  }
  
  return new DynamoDBClient(options);
};

const getDynamoDb = () => {
  const dbClient = getDynamoDbClient();
  return DynamoDBDocumentClient.from(dbClient);
};
```

## 7. ドキュメント

### 7.1 コメントの書き方
- 複雑なロジックやアルゴリズムにはコメントを付けてください
- TODO コメントには担当者と課題を明記してください
- コードの「なぜ」を説明するコメントを書いてください（「何」はコード自体が示します）

```javascript
// 良い例
// レート制限を回避するために指数バックオフを使用
await sleep(baseDelay * Math.pow(2, attempt));

// 悪い例
// 待機する
await sleep(delay);
```

### 7.2 JSDoc スタイルのコメント
- 公開される関数には JSDoc スタイルのコメントを使用してください
- パラメータと戻り値には型情報を含めてください
- 例外をスローする可能性がある場合は @throws タグを使用してください

```javascript
/**
 * データソースからデータを取得し、キャッシュに保存する
 * @param {string} symbol - 取得するデータのシンボル
 * @param {string} dataType - データタイプ（'us-stock', 'jp-stock' など）
 * @param {boolean} [refresh=false] - キャッシュを無視して強制的に更新するかどうか
 * @returns {Promise<Object>} 取得したデータ
 * @throws {Error} データの取得に失敗した場合
 */
async function fetchDataWithCache(symbol, dataType, refresh = false) {
  // 実装
}
```

### 7.3 インラインコメント
- インラインコメントは制限的に使用してください
- 複雑な条件文や非直感的な処理にのみ使用してください

```javascript
// 良い例
// 市場が開いている時間帯のみ短いキャッシュ時間を使用
const cacheTtl = isMarketOpen ? SHORT_CACHE_TTL : LONG_CACHE_TTL;

// 悪い例
const x = y + z; // x に y と z を加える
```

### 7.4 TODO/FIXME コメント
- TODO コメントには以下の形式を使用してください
  ```javascript
  // TODO(名前): 対応が必要な内容の説明
  ```

- FIXME コメントには以下の形式を使用してください
  ```javascript
  // FIXME(名前): 修正が必要な問題の説明
  ```

## 8. テスト

### 8.1 テストの命名規則
- テストファイル名は `{対象ファイル名}.test.js` としてください
- テストケースの説明は明確で具体的にしてください

```javascript
// Good test naming
describe('getExchangeRate', () => {
  it('returns cached data when available', () => {
    // ...
  });
  
  it('fetches from primary source when cache is empty', () => {
    // ...
  });
  
  it('falls back to secondary source when primary fails', () => {
    // ...
  });
});
```

### 8.2 テストの構造
- AAA パターン（Arrange, Act, Assert）に従ってください
- モックとスタブを適切に使用してください
- 各テストは独立していて、他のテストに依存しないようにしてください

```javascript
it('falls back to secondary source when primary fails', async () => {
  // Arrange
  const symbol = 'AAPL';
  const primarySourceMock = sinon.stub().rejects(new Error('Primary source error'));
  const secondarySourceMock = sinon.stub().resolves({ price: 150 });
  
  // Act
  const result = await fetchDataWithFallback(symbol, [primarySourceMock, secondarySourceMock]);
  
  // Assert
  expect(primarySourceMock.calledOnce).to.be.true;
  expect(secondarySourceMock.calledOnce).to.be.true;
  expect(result.price).to.equal(150);
});
```

## 9. セキュリティ

### 9.1 セキュアコーディング基準
- 機密情報（API キーなど）をハードコードしないでください。環境変数を使用してください
- 入力データは常に検証してください
- 出力データはエスケープまたはサニタイズしてください
- 環境変数のデフォルト値として機密情報を含めないでください

```javascript
// 良い例
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error('API key is not configured');
}

// 悪い例
const apiKey = process.env.API_KEY || 'my-secret-api-key';
```

### 9.2 避けるべき脆弱なパターン
- eval() の使用
- JSON.parse() の使用時のエラーハンドリングの欠如
- 信頼できないデータを直接オブジェクトに割り当てる
- エラーメッセージに詳細なシステム情報を含める

### 9.3 機密情報の取り扱い
- パスワードやAPIキーなどの機密情報はログに出力しないでください
- 例外メッセージに機密情報を含めないでください
- トレースやデバッグ情報に機密情報を含めないでください

## 10. ツールと自動化

### 10.1 推奨されるリンター/フォーマッター
- ESLint を使用してください
- Prettier を使用してください

### 10.2 ESLint 設定
以下の `.eslintrc.js` 設定を使用してください：

```javascript
module.exports = {
  "env": {
    "node": true,
    "es2020": true
  },
  "extends": [
    "eslint:recommended"
  ],
  "parserOptions": {
    "ecmaVersion": 2020
  },
  "rules": {
    "indent": ["error", 2],
    "linebreak-style": ["error", "unix"],
    "quotes": ["error", "single", { "allowTemplateLiterals": true }],
    "semi": ["error", "always"],
    "no-unused-vars": ["warn"],
    "no-console": "off",
    "curly": ["error", "all"],
    "eqeqeq": ["error", "always"],
    "prefer-const": ["warn"],
    "camelcase": ["warn"]
  }
};
```

### 10.3 Prettier 設定
以下の `.prettierrc` 設定を使用してください：

```json
{
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

### 10.4 コードレビュープロセス
- 新規コードはすべてレビューを受けてください
- レビューの焦点は以下の点に当ててください：
  - コード規約への準拠
  - エラーハンドリングの適切さ
  - パフォーマンスへの配慮
  - セキュリティへの配慮
  - テストの網羅性

## 付録: より詳細な JSDoc テンプレート

### モジュールテンプレート
```javascript
/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/services/cacheService.js
 * 
 * 説明: 
 * キャッシュ機能を提供するサービス。
 * DynamoDBを使用してデータをキャッシュします。
 * 
 * @module services/cacheService
 * @author Portfolio Manager Team
 * @created 2025-05-14
 */
```

### 関数テンプレート
```javascript
/**
 * キャッシュからデータを取得する
 * @param {string} key - キャッシュキー
 * @returns {Promise<Object|null>} キャッシュデータと残りのTTL、存在しない場合はnull
 * @example
 * // キャッシュからデータを取得
 * const cachedData = await cacheService.get('us-stock:AAPL');
 * if (cachedData) {
 *   console.log(`Got cached data with TTL: ${cachedData.ttl}`);
 * }
 */
```

### エラーテンプレート
```javascript
/**
 * カスタムAPIエラー
 * @class
 * @extends Error
 * @param {string} message - エラーメッセージ
 * @param {string} code - エラーコード
 * @param {number} statusCode - HTTPステータスコード
 */
```

---

この規約書は、プロジェクトの進化とともに継続的に更新されるべきです。また、規約の変更は全チームメンバーの同意を得た上で行うのが望ましいです。
