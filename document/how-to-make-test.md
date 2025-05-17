# テストファイル作成基準

## 概要

本ドキュメントでは、テストファイルを作成する際の基準と手順を定義します。テストファイルとソースコードの一貫性を保ち、参照エラーを防止するためのガイドラインです。

## 命名規則

1. **テストファイル名はソースファイル名と一致させる**
   - ソースファイル: `src/services/cache.js`
   - テストファイル: `__tests__/unit/services/cache.test.js`
   - 接尾辞として `.test.js` を付ける

2. **ディレクトリ構造を反映させる**
   - ソースファイルのディレクトリ構造をテストディレクトリにも反映させる
   - 例: `src/services/sources/yahooFinance.js` → `__tests__/unit/services/sources/yahooFinance.test.js`

## 前提条件確認

テストファイル作成前に、以下の確認を必ず行ってください：

1. **ソースコードの存在確認**
   ```bash
   # ソースファイルの存在を確認
   ls -la src/services/cache.js
   
   # ファイルが存在しない場合は検索で確認
   find src -name "cache*.js"
   ```

2. **ファイル内容の確認**
   ```bash
   # ファイルの内容を確認して、正確な関数名やモジュール構造を把握
   cat src/services/cache.js
   ```

3. **エクスポートの確認**
   ```bash
   # どの関数がエクスポートされているかを確認
   grep -n "module.exports" src/services/cache.js
   ```

## 依存関係の確認

1. **インポート関係の確認**
   ```bash
   # ソースファイルの依存関係を確認
   grep -n "require(" src/services/cache.js
   ```

2. **依存モジュールの存在確認**
   ```bash
   # 依存するすべてのモジュールの存在を確認
   for file in $(grep -o "require(['\"].*['\"])" src/services/cache.js | sed "s/require(['\"]//g" | sed "s/['\"])//g" | grep -v "^\."); do
     npm list $file || echo "$file needs to be installed"
   done
   
   # ローカルモジュールの存在を確認
   for file in $(grep -o "require(['\"]\..*['\"])" src/services/cache.js | sed "s/require(['\"]//g" | sed "s/['\"])//g"); do
     relative_path=$(echo $file | sed "s/\.\.\///g")
     find src -path "*$relative_path.js" || echo "Missing file: $file"
   done
   ```

## テストファイル作成手順

1. **適切なディレクトリにテストファイルを作成**
   ```bash
   # 必要なディレクトリを確認/作成
   mkdir -p __tests__/unit/services
   
   # テストファイルを作成
   touch __tests__/unit/services/cache.test.js
   ```

2. **インポート文の作成**
   ```javascript
   // 正確なパスでソースモジュールをインポート
   const cacheService = require('../../../src/services/cache');
   
   // 依存モジュールも正確にインポート
   const { getDynamoDb } = require('../../../src/utils/awsConfig');
   ```

3. **モック作成**
   ```javascript
   // 依存モジュールをモック化
   jest.mock('../../../src/utils/awsConfig');
   
   // 具体的な関数をモック
   getDynamoDb.mockImplementation(() => ({
     // モック実装を提供
   }));
   ```

## テスト実行前の検証

1. **テストファイル整合性確認スクリプト**
   ```bash
   #!/bin/bash
   
   # テストディレクトリのパターンに基づいてソースファイルの存在を確認
   for test_file in $(find __tests__ -name "*.test.js"); do
     # テストパスからソースパスを抽出
     source_path=$(echo $test_file | sed "s/__tests__\/unit/src/g" | sed "s/\.test\.js/\.js/g")
     
     # ソースファイルの存在確認
     if [ ! -f $source_path ]; then
       echo "Warning: Source file not found for test: $test_file -> $source_path"
       # 類似名検索
       similar=$(find src -name "$(basename $source_path | sed 's/\.js//')*\.js")
       if [ ! -z "$similar" ]; then
         echo "  Similar files found: $similar"
       fi
     fi
   done
   
   # インポートの妥当性を確認
   for test_file in $(find __tests__ -name "*.test.js"); do
     imports=$(grep -o "require(['\"].*['\"])" $test_file | sed "s/require(['\"]//g" | sed "s/['\"])//g" | grep -v "^jest")
     
     for import in $imports; do
       if [[ $import == ../* ]]; then
         # 相対パスのインポート
         resolved_path=$(realpath $(dirname $test_file)/$import.js)
         if [ ! -f $resolved_path ]; then
           echo "Warning: Invalid import in $test_file: $import"
         fi
       fi
     done
   done
   ```

## 自動テスト作成ツール

1. **テンプレート生成**
   ```bash
   #!/bin/bash
   
   # 使用法: ./create-test.sh src/services/cache.js
   
   SOURCE_FILE=$1
   
   if [ -z "$SOURCE_FILE" ]; then
     echo "Usage: ./create-test.sh <source-file-path>"
     exit 1
   fi
   
   if [ ! -f "$SOURCE_FILE" ]; then
     echo "Source file not found: $SOURCE_FILE"
     exit 1
   fi
   
   # ソースファイルからパス情報を抽出
   SRC_DIR=$(dirname "$SOURCE_FILE")
   FILENAME=$(basename "$SOURCE_FILE" .js)
   REL_PATH=${SRC_DIR#src/}
   
   # テストファイルパスを作成
   TEST_DIR="__tests__/unit/$REL_PATH"
   TEST_FILE="$TEST_DIR/${FILENAME}.test.js"
   
   # テストディレクトリがなければ作成
   mkdir -p "$TEST_DIR"
   
   # モジュール名を作成 (パスからキャメルケースに変換)
   MODULE_NAME=$(echo $FILENAME | sed -r 's/(^|-)([a-z])/\U\2/g')
   
   # 依存関係を抽出
   DEPENDENCIES=$(grep -o "require(['\"].*['\"])" $SOURCE_FILE | sed "s/require(\(['\"]\)\(.*\)\1)/\2/g")
   
   # テストファイルのテンプレートを作成
   cat > "$TEST_FILE" << EOF
/**
 * ファイルパス: $TEST_FILE
 * 
 * ${MODULE_NAME}のユニットテスト
 * 
 * @author $(git config user.name)
 * @created $(date +%Y-%m-%d)
 */

// テスト対象モジュールのインポート
const ${FILENAME} = require('../../../$SOURCE_FILE');

// 依存モジュールのインポート
$(echo "$DEPENDENCIES" | grep -v "^\.\./" | while read dep; do
  if [[ $dep == ./* ]]; then
    # 相対パスを調整
    rel_dep="../../../$SRC_DIR/$(echo $dep | sed 's/\.\///')"
    echo "const { } = require('$rel_dep');"
  else
    echo "const { } = require('$dep');"
  fi
done)

// モックの設定
$(echo "$DEPENDENCIES" | grep -v "^\.\./" | while read dep; do
  if [[ $dep == ./* ]]; then
    # 相対パスを調整
    rel_dep="../../../$SRC_DIR/$(echo $dep | sed 's/\.\///')"
    echo "jest.mock('$rel_dep');"
  else
    echo "jest.mock('$dep');"
  fi
done)

describe('${MODULE_NAME}', () => {
  beforeEach(() => {
    // テスト前の準備
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // テスト後のクリーンアップ
  });
  
  // エクスポートされた関数をテスト
$(grep -o "exports\.[a-zA-Z0-9_]* =" $SOURCE_FILE | sed "s/exports\.\([a-zA-Z0-9_]*\) =/  describe('\1', () => {\n    test('正常系のテスト', async () => {\n      \/\/ テストコードをここに記述\n    });\n  });/g")

});
EOF
   
   echo "Test file created: $TEST_FILE"
   ```

## チェックリスト

テストファイル作成完了時に以下のチェックリストを確認してください：

- [ ] テストファイル名はソースファイル名に合わせて正しく命名されている
- [ ] テストファイルの格納先ディレクトリは、ソースコードの構造を反映している
- [ ] インポートパスは正確で、実際に存在するファイルを参照している
- [ ] モック化する対象モジュールは、ソースコードで実際に使用されている
- [ ] エクスポートされる全ての公開関数に対するテストが網羅されている
- [ ] 依存関係を全て識別しており、適切にモック化されている
- [ ] テスト専用の機能（テストデータ生成など）は別のヘルパーファイルに分離されている

## 注意事項

1. **リファクタリング時の対応**
   - ソースコードの構造変更時には、テストファイルも同時に更新する
   - リファクタリング前後でテストの動作確認を行う

2. **CI/CDとの統合**
   - コミット前にテスト整合性確認スクリプトを実行する
   - CI/CDパイプラインにテスト整合性チェックを組み込む

3. **定期メンテナンス**
   - 3ヶ月ごとに全テストファイルの整合性を確認する
   - 孤立したテスト（対応するソースがないもの）は削除または修正する

## 参考

- Jest ドキュメント: https://jestjs.io/docs/
- JavaScript テスティングのベストプラクティス: https://github.com/goldbergyoni/javascript-testing-best-practices
