#!/bin/bash
# 
# ファイルパス: scripts/run-tests.sh
# 
# Portfolio Market Data APIテスト実行スクリプト
# 修正: テストカバレッジ向上計画に合わせた機能強化
#
# @author Portfolio Manager Team
# @updated 2025-05-15 - 新しいテスト種別の追加、詳細レポート生成オプションの強化
#

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
  echo "  -i, --ignore-coverage-errors テスト自体は成功してもカバレッジエラーを無視（NEW!）"
  echo "  -s, --specific              特定のファイルまたはパターンに一致するテストのみ実行"
  echo "  --html-coverage             HTMLカバレッジレポートをブラウザで開く"
  echo "  --junit                     JUnit形式のレポートを生成（CI環境用）"
  echo "  --nvm                       nvmを使用してNode.js 18に切り替え"
  echo ""
  echo "テスト種別:"
  echo "  unit                単体テストのみ実行"
  echo "  unit:services       サービス層の単体テストのみ実行（NEW!）"
  echo "  unit:utils          ユーティリティの単体テストのみ実行（NEW!）"
  echo "  unit:function       API関数の単体テストのみ実行（NEW!）"
  echo "  integration         統合テストのみ実行"
  echo "  integration:auth    認証関連の統合テストのみ実行（NEW!）" 
  echo "  integration:market  マーケットデータ関連の統合テストのみ実行（NEW!）"
  echo "  integration:drive   Google Drive関連の統合テストのみ実行（NEW!）"
  echo "  e2e                 エンドツーエンドテストのみ実行"
  echo "  all                 すべてのテストを実行"
  echo "  quick               単体テストと統合テストのみ高速実行（モック使用）"
  echo "  specific            -s オプションで指定したファイルまたはパターンに一致するテストのみ実行"
  echo ""
  echo "使用例:"
  echo "  $0 unit             単体テストのみ実行"
  echo "  $0 -c all           環境クリーンアップ後、すべてのテストを実行"
  echo "  $0 -a -v e2e        APIサーバー自動起動でE2Eテストを実行し、結果をビジュアル表示"
  echo "  $0 -m -w unit       モックを使用し、監視モードで単体テストを実行"
  echo "  $0 quick            単体テストと統合テストを高速実行（モック使用）"
  echo "  $0 -n integration   カバレッジチェック無効で統合テストを実行"
  echo "  $0 -f -m e2e        テストを強制実行モードで実行（モック使用）"
  echo "  $0 -d e2e           デバッグモードでE2Eテストを実行（詳細ログ表示）"
  echo "  $0 -i e2e           カバレッジエラーを無視してテスト成功を正確に表示"
  echo "  $0 -s \"services/*.test.js\" specific  サービス関連のテストファイルのみ実行（NEW!）"
  echo "  $0 unit:services    サービス層の単体テストのみ実行（NEW!）"
  echo "  $0 --nvm unit       nvmでNode.js 18に切り替えて単体テストを実行"
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
JUNIT_REPORT=0
SPECIFIC_PATTERN=""
TEST_TYPE=""

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
    --html-coverage)
      HTML_COVERAGE=1
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

# デバッグモードが指定されている場合、詳細情報を表示
if [ $DEBUG_MODE -eq 1 ]; then
  print_info "デバッグモードが有効です"
  print_info "実行環境情報:"
  echo "- Node.js Version: $(node -v 2>/dev/null || echo 'Not found')"
  echo "- npm Version: $(npm -v 2>/dev/null || echo 'Not found')"
  echo "- Current directory: $(pwd)"
  echo "- Available environment variables:"
  env | grep -E "NODE_ENV|API_|TEST_|MOCK|E2E|DYNAMODB" | sort
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

# テスト環境のセットアップ
print_info "テスト環境をセットアップしています..."
npm run test:setup
print_success "セットアップ完了"

# 環境変数の設定
ENV_VARS=""
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

if [ $IGNORE_COVERAGE_ERRORS -eq 1 ]; then
  ENV_VARS="$ENV_VARS IGNORE_COVERAGE_ERRORS=true"
  print_info "カバレッジエラーを無視するモードが有効です"
fi

if [ $JUNIT_REPORT -eq 1 ]; then
  ENV_VARS="$ENV_VARS JEST_JUNIT_OUTPUT_DIR=./test-results/junit"
  print_info "JUnit形式のレポートを生成します"
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
if [ $NO_COVERAGE -eq 1 ]; then
  print_info "カバレッジチェックが無効化されています"
  JEST_ARGS="$JEST_ARGS --no-coverage"
else
  if [ $HTML_COVERAGE -eq 1 ]; then
    print_info "HTMLカバレッジレポートを生成します"
    JEST_ARGS="$JEST_ARGS --coverage --coverageReporters=lcov"
  else
    # デフォルトのカバレッジ設定
    JEST_ARGS="$JEST_ARGS --coverage"
  fi
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
  eval "npx cross-env $ENV_VARS $JEST_CMD"
else
  npx $JEST_CMD
fi

# テスト結果
TEST_RESULT=$?

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
  
  # カバレッジ情報をログファイルから抽出して表示
  if [ $NO_COVERAGE -ne 1 ] && [ -f "./test-results/detailed-results.json" ]; then
    AVG_COVERAGE=$(grep -o '"pct":[0-9.]*' ./test-results/detailed-results.json | head -4 | awk -F: '{sum+=$2} END {print sum/4}')
    if [ -n "$AVG_COVERAGE" ]; then
      print_info "平均カバレッジ率: ${AVG_COVERAGE}%"
    fi
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
  echo "- モックモードでテストを再実行: ./scripts/run-tests.sh -m $TEST_TYPE"
  echo "- カバレッジエラーを無視してテスト: ./scripts/run-tests.sh -i $TEST_TYPE"
fi

# テスト後のクリーンアップ提案
if [ $TEST_RESULT -eq 0 ] && [ $CLEAN -ne 1 ]; then
  print_info "次回のテスト実行前に環境をクリーンアップすることをお勧めします:"
  echo "  ./scripts/run-tests.sh -c ..."
fi

exit $TEST_RESULT
