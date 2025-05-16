#!/bin/bash
# 
# ファイルパス: scripts/run-tests.sh (更新版)
# 
# Portfolio Market Data APIテスト実行スクリプト
# 修正: 新しいテストファイル対応およびレポート詳細化、カバレッジ強制対応追加
#
# @author Koki Riho
# @updated 2025-05-15 - 新しいテスト種別の追加、詳細レポート生成オプションの強化
# @updated 2025-05-16 - カバレッジチャートの自動生成機能追加、テストカバレッジ目標の段階追跡
# @updated 2025-05-17 - カバレッジオプションが確実に有効になるように修正、強制カバレッジオプション追加
# @updated 2025-05-20 - setupTests.jsを使用するように更新、コンソール出力を最小限に設定
#

# 便利なサンプルコマンド
# JEST_COVERAGE=true ./scripts/run-tests.sh integration  # カバレッジを強制的に有効化して統合テストを実行
# USE_API_MOCKS=true ./scripts/run-tests.sh e2e          # モックを使用してE2Eテストを実行

# 色の設定
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 関数定義
print_header() {
  echo -e "\n${BLUE}===========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}===========================================${NC}\n"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

show_help() {
  print_header "Portfolio Market Data API テスト実行ヘルプ"
  echo "使用方法: $0 [オプション] <テスト種別>"
  echo ""
  echo "オプション:"
  echo "  -h, --help                  このヘルプメッセージを表示"
  echo "  -c, --clean                 テスト実行前にテスト環境をクリーンアップ"
  echo "  -v, --visual                テスト結果をビジュアルレポートで表示"
  echo "  -a, --auto                  APIサーバーを自動起動（E2Eテスト用）"
  echo "  -m, --mock                  APIモックを使用（E2Eテスト用）"
  echo "  -w, --watch                 監視モードでテストを実行（コード変更時に自動再実行）"
  echo "  -n, --no-coverage           カバレッジ計測・チェックを無効化"
  echo "  -f, --force                 サーバー状態に関わらずテストを強制実行"
  echo "  -d, --debug                 デバッグモードを有効化（詳細ログを表示）"
  echo "  -i, --ignore-coverage-errors テスト自体は成功してもカバレッジエラーを無視"
  echo "  -s, --specific              特定のファイルまたはパターンに一致するテストのみ実行"
  echo "  -t, --target                カバレッジ目標段階を指定 [initial|mid|final]"
  echo "  -v, --verbose               詳細なテスト出力を表示（デフォルトは最小限出力）"
  echo "  --html-coverage             HTMLカバレッジレポートをブラウザで開く"
  echo "  --chart                     カバレッジをチャートで生成（ビジュアルレポートに追加）"
  echo "  --junit                     JUnit形式のレポートを生成（CI環境用）"
  echo "  --nvm                       nvmを使用してNode.js 18に切り替え"
  echo "  --force-coverage            カバレッジ計測を強制的に有効化（--no-coverageより優先）"
  echo ""
  echo "テスト種別:"
  echo "  unit                単体テストのみ実行"
  echo "  unit:services       サービス層の単体テストのみ実行"
  echo "  unit:utils          ユーティリティの単体テストのみ実行"
  echo "  unit:function       API関数の単体テストのみ実行"
  echo "  integration         統合テストのみ実行"
  echo "  integration:auth    認証関連の統合テストのみ実行" 
  echo "  integration:market  マーケットデータ関連の統合テストのみ実行"
  echo "  integration:drive   Google Drive関連の統合テストのみ実行"
  echo "  e2e                 エンドツーエンドテストのみ実行"
  echo "  all                 すべてのテストを実行"
  echo "  quick               単体テストと統合テストのみ高速実行（モック使用）"
  echo "  specific            -s オプションで指定したファイルまたはパターンに一致するテストのみ実行"
  echo ""
  echo "カバレッジ目標段階 (-t/--target オプション):"
  echo "  initial             初期段階の目標 (20-30%) - 基本的なテスト実装時"
  echo "  mid                 中間段階の目標 (40-60%) - サービス層とAPIハンドラーのテスト時"
  echo "  final               最終段階の目標 (70-80%) - 完全なテストカバレッジ時"
  echo ""
  echo "使用例:"
  echo "  $0 unit             単体テストのみ実行（カバレッジあり）"
  echo "  $0 -c all           環境クリーンアップ後、すべてのテストを実行"
  echo "  $0 -a -v e2e        APIサーバー自動起動でE2Eテストを実行し、結果をビジュアル表示"
  echo "  $0 -m -w unit       モックを使用し、監視モードで単体テストを実行"
  echo "  $0 quick            単体テストと統合テストを高速実行（モック使用）"
  echo "  $0 -n integration   カバレッジチェック無効で統合テストを実行"
  echo "  $0 --force-coverage integration  カバレッジを強制的に有効化して統合テストを実行"
  echo "  $0 -f -m e2e        テストを強制実行モードで実行（モック使用）"
  echo "  $0 -d e2e           デバッグモードでE2Eテストを実行（詳細ログ表示）"
  echo "  $0 -i e2e           カバレッジエラーを無視してテスト成功を正確に表示"
  echo "  $0 -s \"services/*.test.js\" specific  サービス関連のテストファイルのみ実行"
  echo "  $0 unit:services    サービス層の単体テストのみ実行"
  echo "  $0 --chart all      すべてのテストを実行し、カバレッジチャートを生成"
  echo "  $0 -t mid all       中間段階のカバレッジ目標を設定してすべてのテストを実行"
  echo "  $0 -v unit          詳細なテスト出力を表示して単体テストを実行"
  echo ""
}

# 変数の初期化
CLEAN=0
VISUAL=0
AUTO=0
MOCK=0
WATCH=0
NO_COVERAGE=0
USE_NVM=0
FORCE_TESTS=0
DEBUG_MODE=0
IGNORE_COVERAGE_ERRORS=0
HTML_COVERAGE=0
GENERATE_CHART=0
JUNIT_REPORT=0
FORCE_COVERAGE=0
VERBOSE_MODE=0
SPECIFIC_PATTERN=""
TEST_TYPE=""
COVERAGE_TARGET="initial"

# オプション解析
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      show_help
      exit 0
      ;;
    -c|--clean)
      CLEAN=1
      shift
      ;;
    -v|--visual)
      VISUAL=1
      shift
      ;;
    -a|--auto)
      AUTO=1
      shift
      ;;
    -m|--mock)
      MOCK=1
      shift
      ;;
    -w|--watch)
      WATCH=1
      shift
      ;;
    -n|--no-coverage)
      NO_COVERAGE=1
      shift
      ;;
    -f|--force)
      FORCE_TESTS=1
      shift
      ;;
    -d|--debug)
      DEBUG_MODE=1
      VERBOSE_MODE=1  # デバッグモードは詳細モードも含む
      shift
      ;;
    -i|--ignore-coverage-errors)
      IGNORE_COVERAGE_ERRORS=1
      shift
      ;;
    -s|--specific)
      SPECIFIC_PATTERN="$2"
      shift 2
      ;;
    -t|--target)
      COVERAGE_TARGET="$2"
      shift 2
      ;;
    -v|--verbose)
      VERBOSE_MODE=1
      shift
      ;;
    --html-coverage)
      HTML_COVERAGE=1
      shift
      ;;
    --chart)
      GENERATE_CHART=1
      shift
      ;;
    --junit)
      JUNIT_REPORT=1
      shift
      ;;
    --nvm)
      USE_NVM=1
      shift
      ;;
    --force-coverage)
      FORCE_COVERAGE=1
      shift
      ;;
    unit|unit:services|unit:utils|unit:function|integration|integration:auth|integration:market|integration:drive|e2e|all|quick|specific)
      TEST_TYPE=$1
      shift
      ;;
    *)
      print_error "不明なオプション: $1"
      show_help
      exit 1
      ;;
  esac
done

# カバレッジ目標段階の検証
if [[ ! "$COVERAGE_TARGET" =~ ^(initial|mid|final)$ ]]; then
  print_error "不明なカバレッジ目標段階: $COVERAGE_TARGET"
  print_info "有効な値: initial, mid, final"
  exit 1
fi

# Jest configuration のデバッグ情報を追加
debug_jest_config() {
  print_info "Jest設定のデバッグ情報を表示します..."
  
  # Jest のバージョンを確認
  JEST_VERSION=$(npx jest --version 2>/dev/null || echo "Jest not found")
  echo "Jest バージョン: $JEST_VERSION"
  
  # Jest設定ファイルを探す
  if [ -f "jest.config.js" ]; then
    echo "jest.config.js が見つかりました"
    echo "setupFiles設定:"
    cat jest.config.js | grep -E "setupFiles" || echo "setupFiles設定が見つかりません"
    echo "カバレッジ設定:"
    cat jest.config.js | grep -E "coverage|collectCoverage" || echo "カバレッジ設定が見つかりません"
  elif [ -f "jest.config.json" ]; then
    echo "jest.config.json が見つかりました"
    cat jest.config.json | grep -E "setupFiles|coverage|collectCoverage" || echo "setupFiles/カバレッジ設定が見つかりません"
  else
    # package.jsonのJest設定を確認
    if [ -f "package.json" ]; then
      echo "package.json の Jest 設定を確認:"
      cat package.json | grep -A 20 '"jest":' | grep -E "setupFiles|coverage|collectCoverage" || echo "setupFiles/カバレッジ設定が見つかりません"
    fi
  fi
  
  # setupTests.jsファイルの確認
  if [ -f "setupTests.js" ]; then
    echo "setupTests.js ファイルが存在します"
  else
    echo "setupTests.js ファイルが見つかりません"
  fi
  
  # .env.localファイルの確認
  if [ -f ".env.local" ]; then
    echo ".env.local ファイルをチェックしています（カバレッジ設定の上書きがないか）:"
    cat .env.local | grep -E "JEST|COVERAGE|collectCoverage|jest" || echo "カバレッジ関連の設定は見つかりません"
  fi
  
  # 関連するnodeモジュールをチェック
  echo "インストールされている関連パッケージ:"
  npm list | grep -E "jest|istanbul|coverage" || echo "カバレッジ関連パッケージが見つかりません"
}

# デバッグモードの場合は、Jest設定も表示
if [ $DEBUG_MODE -eq 1 ]; then
  debug_jest_config
fi

# nvmが指定されている場合、Node.js 18に切り替え
if [ $USE_NVM -eq 1 ]; then
  print_info "nvmを使用してNode.js 18に切り替えます..."
  
  # nvmをロード
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  
  # 現在のNode.jsバージョンを確認
  CURRENT_NODE_VERSION=$(node -v)
  
  if [[ "$CURRENT_NODE_VERSION" == v18.* ]]; then
    print_success "既にNode.js $CURRENT_NODE_VERSION を使用しています"
  else
    # Node.js 18に切り替え
    nvm use 18 || {
      print_warning "Node.js 18に切り替えられませんでした。インストールを試みます..."
      nvm install 18 && nvm use 18 || {
        print_error "Node.js 18のインストールに失敗しました。"
        print_info "nvm install 18 を手動で実行するか、npm config set engine-strict false を実行してください。"
        exit 1
      }
    }
    print_success "Node.js $(node -v) に切り替えました"
  fi
fi

# 環境変数が既に設定されているかチェック
check_env_vars() {
  # 環境変数から直接実行された場合
  if [ -n "$JEST_COVERAGE" ] || [ -n "$USE_API_MOCKS" ] || [ -n "$COLLECT_COVERAGE" ]; then
    print_info "コマンドラインから環境変数が設定されています："
    
    if [ -n "$JEST_COVERAGE" ]; then
      echo "- JEST_COVERAGE=$JEST_COVERAGE"
      # 既に設定されている場合は明示的に環境変数に追加
      ENV_VARS="$ENV_VARS JEST_COVERAGE=$JEST_COVERAGE"
    fi
    
    if [ -n "$USE_API_MOCKS" ]; then
      echo "- USE_API_MOCKS=$USE_API_MOCKS"
      ENV_VARS="$ENV_VARS USE_API_MOCKS=$USE_API_MOCKS"
      MOCK=1
    fi
    
    if [ -n "$COLLECT_COVERAGE" ]; then
      echo "- COLLECT_COVERAGE=$COLLECT_COVERAGE"
      ENV_VARS="$ENV_VARS COLLECT_COVERAGE=$COLLECT_COVERAGE"
      if [ "$COLLECT_COVERAGE" = "true" ]; then
        FORCE_COVERAGE=1
      fi
    fi
  fi
}

# 環境変数をチェック
check_env_vars

# テスト種別が指定されていない場合はエラー
if [ -z "$TEST_TYPE" ]; then
  print_error "テスト種別を指定してください"
  show_help
  exit 1
fi

# テスト種別が「specific」で、パターンが指定されていない場合はエラー
if [ "$TEST_TYPE" = "specific" ] && [ -z "$SPECIFIC_PATTERN" ]; then
  print_error "specific テスト種別を使用する場合は -s オプションでパターンを指定してください"
  show_help
  exit 1
fi

# クリーンアップが指定された場合は実行
if [ $CLEAN -eq 1 ]; then
  print_info "テスト環境をクリーンアップしています..."
  npm run test:clean
  print_success "クリーンアップ完了"
fi

# setupTests.jsが存在するか確認
if [ ! -f "setupTests.js" ]; then
  print_warning "setupTests.jsファイルが見つかりません。作成します..."
  
  # __tests__/setup.jsおよびjest.setup.jsの内容を統合したファイルを生成
  print_info "setupTests.jsファイルを生成しています..."
  
  cat > setupTests.js << 'EOF'
/**
 * ファイルパス: setupTests.js
 * 
 * Jestテスト実行前の共通セットアップファイル
 * __tests__/setup.js と jest.setup.js の内容を統合
 * 
 * @file setupTests.js
 * @author Portfolio Manager Team
 * @created 2025-05-20
 */

// テスト用のタイムアウト設定
jest.setTimeout(30000); // 30秒

// エラーハンドリングを改善
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // テスト環境では強制終了しない
});

// テスト環境を設定
process.env.NODE_ENV = 'test';

// テスト環境変数のデフォルト値設定
process.env = {
  ...process.env,
  // 基本設定
  DYNAMODB_ENDPOINT: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  SESSION_TABLE: process.env.SESSION_TABLE || 'test-sessions',
  DYNAMODB_TABLE_PREFIX: process.env.DYNAMODB_TABLE_PREFIX || 'test-',
  
  // AWS リージョン設定
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  
  // テスト用キャッシュとセッションテーブル
  CACHE_TABLE: process.env.CACHE_TABLE || 'test-portfolio-market-data-cache',
  
  // CORS設定
  CORS_ALLOW_ORIGIN: process.env.CORS_ALLOW_ORIGIN || '*',
  
  // APIキー設定
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || 'test-admin-api-key',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@example.com',
  
  // 使用量制限
  DAILY_REQUEST_LIMIT: process.env.DAILY_REQUEST_LIMIT || '100',
  MONTHLY_REQUEST_LIMIT: process.env.MONTHLY_REQUEST_LIMIT || '1000',
  DISABLE_ON_LIMIT: process.env.DISABLE_ON_LIMIT || 'true',
  
  // キャッシュ設定
  CACHE_TIME_US_STOCK: process.env.CACHE_TIME_US_STOCK || '3600',
  CACHE_TIME_JP_STOCK: process.env.CACHE_TIME_JP_STOCK || '3600',
  CACHE_TIME_MUTUAL_FUND: process.env.CACHE_TIME_MUTUAL_FUND || '10800',
  CACHE_TIME_EXCHANGE_RATE: process.env.CACHE_TIME_EXCHANGE_RATE || '21600',
  
  // Google認証設定
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'test-client-id',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || 'test-client-secret',
  SESSION_EXPIRES_DAYS: process.env.SESSION_EXPIRES_DAYS || '7',
};

// DynamoDBモックを有効化
const mockDynamoDb = {
  get: jest.fn().mockImplementation(() => ({
    promise: jest.fn().mockResolvedValue({ Item: null })
  })),
  put: jest.fn().mockImplementation(() => ({
    promise: jest.fn().mockResolvedValue({})
  })),
  update: jest.fn().mockImplementation(() => ({
    promise: jest.fn().mockResolvedValue({ Attributes: { count: 1 } })
  })),
  delete: jest.fn().mockImplementation(() => ({
    promise: jest.fn().mockResolvedValue({})
  })),
  scan: jest.fn().mockImplementation(() => ({
    promise: jest.fn().mockResolvedValue({ Items: [] })
  })),
  query: jest.fn().mockImplementation(() => ({
    promise: jest.fn().mockResolvedValue({ Items: [] })
  }))
};

// グローバルDynamoDBモック
global.__AWS_MOCK__ = {
  dynamoDb: mockDynamoDb
};

// モックライブラリの設定
// nockの自動クリーンアップを設定
const nock = require('nock');
nock.disableNetConnect();
nock.enableNetConnect('localhost'); // ローカル接続は許可

// コンソール出力をモック化（静かなテスト実行のため）
global.originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

// テスト結果が詳細に出力されないようにオーバーライド
// CI環境やDEBUGモードでは元の動作を維持
if (process.env.CI !== 'true' && process.env.DEBUG !== 'true' && process.env.VERBOSE_MODE !== 'true') {
  // 標準出力をモック化
  console.log = (...args) => {
    // テスト開始・終了メッセージと重要な警告のみ表示
    if (typeof args[0] === 'string' && (
        args[0].includes('PASS') || 
        args[0].includes('FAIL') || 
        args[0].includes('ERROR') ||
        args[0].startsWith('Test suite') ||
        args[0].includes('Test Suites:') ||
        args[0].includes('Tests:') ||
        args[0].includes('Snapshots:') ||
        args[0].includes('Time:')
      )) {
      global.originalConsole.log(...args);
    }
  };
  console.info = (...args) => {
    // 重要な情報のみ表示
    if (typeof args[0] === 'string' && (
        args[0].includes('IMPORTANT') ||
        args[0].includes('[INFO]')
      )) {
      global.originalConsole.info(...args);
    }
  };
}

// 警告とエラーは常に表示
console.warn = global.originalConsole.warn;
console.error = global.originalConsole.error;

// 日付のモック
jest.spyOn(global.Date, 'now').mockImplementation(() => 1715900000000); // 2025-05-18T10:00:00.000Z

// テスト前後の共通処理
beforeAll(async () => {
  if (process.env.DEBUG === 'true' || process.env.VERBOSE_MODE === 'true') {
    global.originalConsole.log('Starting test suite with environment:', process.env.NODE_ENV);
    global.originalConsole.log('Test configuration:');
    global.originalConsole.log('- RUN_E2E_TESTS:', process.env.RUN_E2E_TESTS);
    global.originalConsole.log('- USE_API_MOCKS:', process.env.USE_API_MOCKS);
    global.originalConsole.log('- SKIP_E2E_TESTS:', process.env.SKIP_E2E_TESTS);
  }
});

afterAll(async () => {
  if (process.env.DEBUG === 'true' || process.env.VERBOSE_MODE === 'true') {
    global.originalConsole.log('Test suite completed');
  }
  
  // Jestのタイマーを確実にクリーンアップ
  jest.useRealTimers();
  
  // nockのクリーンアップ
  nock.cleanAll();
  nock.enableNetConnect();
});

// 各テスト後のクリーンアップ
afterEach(() => {
  // タイマーのクリーンアップ
  jest.clearAllTimers();
  
  // モックのリセット
  jest.resetAllMocks();
});
EOF
  
  print_success "setupTests.jsファイルを作成しました"
  
  # jest.config.jsファイルを確認し、必要であれば更新
  if [ -f "jest.config.js" ]; then
    # setupFilesエントリがすでにsetupTests.jsを指しているか確認
    if ! grep -q "setupFiles.*setupTests.js" jest.config.js; then
      print_warning "jest.config.jsのsetupFiles設定を更新しています..."
      
      # バックアップを作成
      cp jest.config.js jest.config.js.bak
      
      # 設定を更新
      sed -i.bak 's/setupFiles: \[\(.*\)\]/setupFiles: \[\.\/setupTests\.js\]/g' jest.config.js
      
      print_success "jest.config.jsを更新しました"
    else
      print_info "jest.config.jsは既にsetupTests.jsを使用しています"
    fi
  fi
else
  print_success "setupTests.jsファイルが見つかりました"
fi

# テスト環境のセットアップ
print_info "テスト環境をセットアップしています..."
npm run test:setup
print_success "セットアップ完了"

# カバレッジ目標に応じた環境変数を設定
case $COVERAGE_TARGET in
  initial)
    print_info "カバレッジ目標: 初期段階 (20-30%)"
    ENV_VARS="$ENV_VARS COVERAGE_TARGET=initial"
    ;;
  mid)
    print_info "カバレッジ目標: 中間段階 (40-60%)"
    ENV_VARS="$ENV_VARS COVERAGE_TARGET=mid"
    ;;
  final)
    print_info "カバレッジ目標: 最終段階 (70-80%)"
    ENV_VARS="$ENV_VARS COVERAGE_TARGET=final"
    ;;
esac

# 環境変数の設定
if [ $AUTO -eq 1 ]; then
  ENV_VARS="$ENV_VARS RUN_E2E_TESTS=true"
  print_info "APIサーバー自動起動モードが有効です"
fi

if [ $MOCK -eq 1 ]; then
  ENV_VARS="$ENV_VARS USE_API_MOCKS=true"
  print_info "APIモック使用モードが有効です"
fi

if [ $FORCE_TESTS -eq 1 ]; then
  ENV_VARS="$ENV_VARS FORCE_TESTS=true"
  print_info "テスト強制実行モードが有効です"
fi

if [ $DEBUG_MODE -eq 1 ]; then
  ENV_VARS="$ENV_VARS DEBUG=true"
  print_info "デバッグログが有効です"
fi

if [ $VERBOSE_MODE -eq 1 ]; then
  ENV_VARS="$ENV_VARS VERBOSE_MODE=true"
  print_info "詳細な出力モードが有効です"
fi

if [ $IGNORE_COVERAGE_ERRORS -eq 1 ]; then
  ENV_VARS="$ENV_VARS IGNORE_COVERAGE_ERRORS=true"
  print_info "カバレッジエラーを無視するモードが有効です"
fi

if [ $JUNIT_REPORT -eq 1 ]; then
  ENV_VARS="$ENV_VARS JEST_JUNIT_OUTPUT_DIR=./test-results/junit"
  print_info "JUnit形式のレポートを生成します"
fi

if [ $GENERATE_CHART -eq 1 ]; then
  ENV_VARS="$ENV_VARS GENERATE_COVERAGE_CHART=true"
  print_info "カバレッジチャートを生成します"
  VISUAL=1  # チャート生成時は自動的にビジュアルレポートを表示
  FORCE_COVERAGE=1  # チャート生成時は常にカバレッジを有効化
fi

# テストコマンドの構築
TEST_CMD=""
JEST_ARGS=""

# テスト種別に基づいてJestの引数を設定
case $TEST_TYPE in
  unit)
    print_header "単体テストを実行中..."
    JEST_ARGS="--selectProjects unit"
    ;;
  unit:services)
    print_header "サービス層の単体テストを実行中..."
    JEST_ARGS="--selectProjects unit --testPathPattern=services"
    ;;
  unit:utils)
    print_header "ユーティリティの単体テストを実行中..."
    JEST_ARGS="--selectProjects unit --testPathPattern=utils"
    ;;
  unit:function)
    print_header "API関数の単体テストを実行中..."
    JEST_ARGS="--selectProjects unit --testPathPattern=function"
    ;;
  integration)
    print_header "統合テストを実行中..."
    JEST_ARGS="--selectProjects integration"
    ;;
  integration:auth)
    print_header "認証関連の統合テストを実行中..."
    JEST_ARGS="--selectProjects integration --testPathPattern=auth"
    ;;
  integration:market)
    print_header "マーケットデータ関連の統合テストを実行中..."
    JEST_ARGS="--selectProjects integration --testPathPattern=marketData"
    ;;
  integration:drive)
    print_header "Google Drive関連の統合テストを実行中..."
    JEST_ARGS="--selectProjects integration --testPathPattern=drive"
    ;;
  e2e)
    print_header "エンドツーエンドテストを実行中..."
    JEST_ARGS="--selectProjects e2e"
    ;;
  all)
    print_header "すべてのテストを実行中..."
    JEST_ARGS="--selectProjects unit integration e2e"
    ;;
  quick)
    print_header "クイックテスト（単体+統合）を実行中..."
    JEST_ARGS="--selectProjects unit integration"
    ENV_VARS="$ENV_VARS USE_API_MOCKS=true"
    ;;
  specific)
    print_header "特定のパターンに一致するテストを実行中..."
    print_info "パターン: $SPECIFIC_PATTERN"
    JEST_ARGS="--testPathPattern=$SPECIFIC_PATTERN"
    ;;
  *)
    print_error "不明なテスト種別: $TEST_TYPE"
    show_help
    exit 1
    ;;
esac

# カバレッジオプションの追加
if [ $FORCE_COVERAGE -eq 1 ]; then
  print_info "カバレッジ計測を強制的に有効化しています"
  # 明示的にカバレッジを有効化
  if [ $HTML_COVERAGE -eq 1 ]; then
    print_info "HTMLカバレッジレポートを生成します"
    JEST_ARGS="$JEST_ARGS --coverage --coverageReporters=lcov"
  else
    JEST_ARGS="$JEST_ARGS --coverage"
  fi
  # カバレッジ関連の環境変数を設定
  ENV_VARS="$ENV_VARS COLLECT_COVERAGE=true"
  NO_COVERAGE=0
elif [ $NO_COVERAGE -eq 1 ]; then
  print_info "カバレッジチェックが無効化されています"
  JEST_ARGS="$JEST_ARGS --no-coverage"
else
  print_info "カバレッジ計測を有効化しています"
  # デフォルトでもカバレッジを有効化
  if [ $HTML_COVERAGE -eq 1 ]; then
    print_info "HTMLカバレッジレポートを生成します"
    JEST_ARGS="$JEST_ARGS --coverage --coverageReporters=lcov"
  else
    JEST_ARGS="$JEST_ARGS --coverage"
  fi
  # カバレッジ関連の環境変数を設定
  ENV_VARS="$ENV_VARS COLLECT_COVERAGE=true"
fi

# JUnitレポート設定
if [ $JUNIT_REPORT -eq 1 ]; then
  JEST_ARGS="$JEST_ARGS --reporters=default --reporters=jest-junit"
fi

# カスタムレポーター設定
JEST_ARGS="$JEST_ARGS --reporters=default --reporters=./custom-reporter.js"

# 監視モードの設定
if [ $WATCH -eq 1 ]; then
  print_info "監視モードが有効です"
  JEST_ARGS="$JEST_ARGS --watch"
else
  # CI環境用の設定
  JEST_ARGS="$JEST_ARGS --forceExit"
fi

# テスト実行コマンドの準備
JEST_CMD="jest $JEST_ARGS"

# デバッグモードの場合、実行予定のコマンドを表示
if [ $DEBUG_MODE -eq 1 ]; then
  print_info "実行するJestコマンド:"
  echo "npx $JEST_CMD"
  if [ -n "$ENV_VARS" ]; then
    print_info "環境変数:"
    echo "$ENV_VARS"
  fi
  echo ""
fi

# テストの実行
if [ -n "$ENV_VARS" ]; then
  # JESTのカバレッジ設定を強制的に有効化（.env.localの設定より優先）
  eval "npx cross-env JEST_COVERAGE=true COLLECT_COVERAGE=true FORCE_COLLECT_COVERAGE=true $ENV_VARS $JEST_CMD"
else
  # JESTのカバレッジ設定を強制的に有効化
  eval "npx cross-env JEST_COVERAGE=true COLLECT_COVERAGE=true FORCE_COLLECT_COVERAGE=true $JEST_CMD"
fi

# テスト結果
TEST_RESULT=$?

# カバレッジ関連ファイルのチェック
if [ $NO_COVERAGE -ne 1 ] || [ $FORCE_COVERAGE -eq 1 ]; then
  # カバレッジ結果ファイルの存在チェック
  if [ ! -f "./test-results/detailed-results.json" ]; then
    print_warning "カバレッジ結果ファイルが見つかりません。Jest実行中にエラーが発生した可能性があります。"
  else
    # coverageMapプロパティの存在チェック
    if ! grep -q "coverageMap" ./test-results/detailed-results.json; then
      print_warning "カバレッジデータが結果ファイルに含まれていません。"
      print_info "Jest設定でcollectCoverageオプションが有効になっていることを確認してください。"
    fi
  fi
fi

# カバレッジエラーを無視するモードが有効な場合
if [ $IGNORE_COVERAGE_ERRORS -eq 1 ] && [ -f "./test-results/detailed-results.json" ]; then
  # JSON結果ファイルを読み込んでテスト自体の成功/失敗を確認
  FAILED_TESTS=$(grep -o '"numFailedTests":[0-9]*' ./test-results/detailed-results.json | cut -d':' -f2)
  
  if [ "$FAILED_TESTS" = "0" ]; then
    print_info "テスト自体は成功していますが、カバレッジ要件を満たしていない可能性があります"
    print_info "カバレッジエラーを無視するモードが有効なため、テスト成功として扱います"
    TEST_RESULT=0
  fi
fi

# カバレッジチャート生成
if [ $GENERATE_CHART -eq 1 ] && [ $NO_COVERAGE -ne 1 ] && [ -f "./test-results/detailed-results.json" ]; then
  print_info "カバレッジチャートを生成しています..."
  
  # チャート生成スクリプトを実行
  npx cross-env NODE_ENV=production node ./scripts/generate-coverage-chart.js
  
  if [ $? -eq 0 ]; then
    print_success "カバレッジチャートが生成されました"
  else
    print_warning "カバレッジチャートの生成に失敗しました"
    # エラーの詳細を確認
    if [ $DEBUG_MODE -eq 1 ]; then
      print_info "チャート生成スクリプトを手動で実行してエラーを確認します..."
      NODE_ENV=production node --trace-warnings ./scripts/generate-coverage-chart.js
    fi
  fi
fi

# HTMLカバレッジレポートを開く
if [ $HTML_COVERAGE -eq 1 ] && [ $TEST_RESULT -eq 0 ]; then
  print_info "HTMLカバレッジレポートを開いています..."
  if [ -f "./coverage/lcov-report/index.html" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS
      open ./coverage/lcov-report/index.html
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
      # Linux
      if command -v xdg-open > /dev/null; then
        xdg-open ./coverage/lcov-report/index.html
      else
        print_warning "xdg-open コマンドが見つかりません。ブラウザで ./coverage/lcov-report/index.html を開いてください。"
      fi
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
      # Windows
      start ./coverage/lcov-report/index.html
    else
      print_warning "未知のOSタイプです。ブラウザで ./coverage/lcov-report/index.html を開いてください。"
    fi
  else
    print_warning "カバレッジレポートが見つかりません。"
  fi
fi

# 視覚的レポートが指定された場合
if [ $VISUAL -eq 1 ]; then
  print_info "テスト結果をビジュアルレポートで表示します..."
  if [ -f "./test-results/visual-report.html" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS
      open ./test-results/visual-report.html
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
      # Linux
      if command -v xdg-open > /dev/null; then
        xdg-open ./test-results/visual-report.html
      else
        print_warning "xdg-open コマンドが見つかりません。ブラウザで ./test-results/visual-report.html を開いてください。"
      fi
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
      # Windows
      start ./test-results/visual-report.html
    else
      print_warning "未知のOSタイプです。ブラウザで ./test-results/visual-report.html を開いてください。"
    fi
  else
    print_warning "ビジュアルレポートが見つかりません。"
  fi
fi

# 結果の表示
if [ $TEST_RESULT -eq 0 ]; then
  print_header "テスト実行が成功しました! 🎉"
  
  # テスト後のクリーンアップ提案
  if [ $CLEAN -ne 1 ]; then
    print_info "次回のテスト実行前に環境をクリーンアップすることをお勧めします:"
    echo "  ./scripts/run-tests.sh -c ..."
  fi
else
  print_header "テスト実行が失敗しました... 😢"
  
  # デバッグモードの場合、詳細情報を表示
  if [ $DEBUG_MODE -eq 1 ]; then
    print_info "テスト失敗の詳細情報:"
    echo "テスト種別: $TEST_TYPE"
    echo "終了コード: $TEST_RESULT"
    
    if [ -f "./test-results/detailed-results.json" ]; then
      FAILED_TESTS=$(grep -o '"numFailedTests":[0-9]*' ./test-results/detailed-results.json | cut -d':' -f2)
      print_info "失敗したテスト数: $FAILED_TESTS"
      
      # 失敗したテストの詳細を表示（最大5件）
      if [ -f "./test-results/test-log.md" ]; then
        echo "失敗したテストの詳細:"
        grep -A 5 "## エラーサマリー" ./test-results/test-log.md | head -10
      fi
    fi
    
    echo "ログファイルは ./test-results/ ディレクトリにあります"
  fi
  
  # 改善提案を表示
  print_info "改善提案:"
  echo "- 詳細なエラー情報を確認: cat ./test-results/test-log.md"
  echo "- ビジュアルレポートを表示: ./scripts/run-tests.sh -v $TEST_TYPE"
  echo "- 詳細な出力で再実行: ./scripts/run-tests.sh -v $TEST_TYPE"
  echo "- モックモードでテストを再実行: ./scripts/run-tests.sh -m $TEST_TYPE"
  echo "- カバレッジエラーを無視してテスト: ./scripts/run-tests.sh -i $TEST_TYPE"
  echo "- カバレッジの問題が原因の場合は強制的に有効化: ./scripts/run-tests.sh --force-coverage $TEST_TYPE"
fi

exit $TEST_RESULT

