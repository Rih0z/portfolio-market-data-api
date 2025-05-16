#!/bin/bash
# 
# ファイルパス: scripts/run-tests.sh
# 
# テスト実行スクリプト - 簡素化版
# 
# @author Portfolio Manager Team
# @updated 2025-05-15 - 設定を統合して簡素化
#

# 色の設定
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ログディレクトリの設定
LOG_DIR="./test-results/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/test-run-$(date +"%Y%m%d-%H%M%S").log"
ERROR_LOG_FILE="$LOG_DIR/test-errors-$(date +"%Y%m%d-%H%M%S").log"

# 関数定義
print_header() {
  echo -e "\n${BLUE}${BOLD}==========================================${NC}"
  echo -e "${BLUE}${BOLD}$1${NC}"
  echo -e "${BLUE}${BOLD}==========================================${NC}\n"
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

print_step() {
  echo -e "${CYAN}➤ $1${NC}"
}

show_help() {
  print_header "テスト実行ヘルプ"
  echo "使用方法: $0 [オプション] <テスト種別>"
  echo ""
  echo "オプション:"
  echo "  -h, --help                  このヘルプメッセージを表示"
  echo "  -c, --clean                 テスト実行前にテスト環境をクリーンアップ"
  echo "  -m, --mock                  APIモックを使用"
  echo "  -w, --watch                 監視モードでテストを実行"
  echo "  -n, --no-coverage           カバレッジ計測を無効化"
  echo "  -d, --debug                 デバッグモードを有効化"
  echo "  -v, --verbose               詳細出力モード"
  echo "  -q, --quiet                 最小限の出力モード"
  echo "  --visual                    テスト完了後にビジュアルレポートを表示"
  echo "  --html-coverage             HTMLカバレッジレポートをブラウザで開く"
  echo "  --junit                     JUnit形式のレポートを生成"
  echo ""
  echo "テスト種別:"
  echo "  unit       単体テストのみ実行"
  echo "  integration 統合テストのみ実行"
  echo "  e2e        エンドツーエンドテストのみ実行"
  echo "  all        すべてのテストを実行"
  echo ""
  echo "使用例:"
  echo "  $0 unit             単体テストを実行"
  echo "  $0 -c all           環境クリーンアップ後、すべてのテストを実行"
  echo "  $0 -m integration   モックを使用して統合テストを実行"
  echo "  $0 -d e2e           デバッグモードでE2Eテストを実行"
}

# 実行開始メッセージ
echo -e "${BOLD}テスト実行を開始します...${NC}"
echo -e "${BLUE}ログ: $LOG_FILE${NC}"
echo "=== テスト実行開始: $(date) ===" > "$LOG_FILE"
echo "=== エラーログ: $(date) ===" > "$ERROR_LOG_FILE"

# 変数の初期化
CLEAN=0
MOCK=0
WATCH=0
NO_COVERAGE=0
DEBUG_MODE=0
VERBOSE_MODE=0
QUIET_MODE=0
VISUAL=0
HTML_COVERAGE=0
JUNIT_REPORT=0
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
    -d|--debug)
      DEBUG_MODE=1
      VERBOSE_MODE=1
      shift
      ;;
    -v|--verbose)
      VERBOSE_MODE=1
      QUIET_MODE=0
      shift
      ;;
    -q|--quiet)
      QUIET_MODE=1
      VERBOSE_MODE=0
      shift
      ;;
    --visual)
      VISUAL=1
      shift
      ;;
    --html-coverage)
      HTML_COVERAGE=1
      shift
      ;;
    --junit)
      JUNIT_REPORT=1
      shift
      ;;
    unit|integration|e2e|all)
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

# テスト種別が指定されていない場合はエラー
if [ -z "$TEST_TYPE" ]; then
  print_error "テスト種別を指定してください"
  show_help
  exit 1
fi

# 環境準備
print_step "テスト環境をセットアップしています..."

# クリーンアップが指定された場合は実行
if [ $CLEAN -eq 1 ]; then
  print_info "テスト環境をクリーンアップしています..."
  rm -rf ./coverage ./test-results/*.html ./test-results/junit
  mkdir -p ./test-results ./coverage ./.jest-cache
  print_success "クリーンアップ完了"
fi

# 環境変数の設定
ENV_VARS="NODE_ENV=test"

if [ $MOCK -eq 1 ]; then
  ENV_VARS="$ENV_VARS USE_API_MOCKS=true"
  print_info "APIモック使用モードが有効です"
fi

if [ $DEBUG_MODE -eq 1 ]; then
  ENV_VARS="$ENV_VARS DEBUG=true"
  print_info "デバッグログが有効です"
fi

if [ $VERBOSE_MODE -eq 1 ]; then
  ENV_VARS="$ENV_VARS VERBOSE_MODE=true"
  print_info "詳細な出力モードが有効です"
fi

if [ $QUIET_MODE -eq 1 ]; then
  ENV_VARS="$ENV_VARS QUIET_MODE=true"
  print_info "最小限出力モードが有効です"
fi

# テストディレクトリを作成
mkdir -p ./test-results/logs ./coverage ./.jest-cache

# Jest コマンド構築
JEST_ARGS=""

# テスト種別に応じて設定
case $TEST_TYPE in
  unit)
    print_header "単体テストを実行中..."
    JEST_ARGS="--selectProjects unit"
    ;;
  integration)
    print_header "統合テストを実行中..."
    JEST_ARGS="--selectProjects integration"
    ;;
  e2e)
    print_header "エンドツーエンドテストを実行中..."
    JEST_ARGS="--selectProjects e2e"
    ;;
  all)
    print_header "すべてのテストを実行中..."
    JEST_ARGS="--selectProjects unit integration e2e"
    ;;
  *)
    print_error "不明なテスト種別: $TEST_TYPE"
    show_help
    exit 1
    ;;
esac

# カバレッジオプション
if [ $NO_COVERAGE -eq 1 ]; then
  JEST_ARGS="$JEST_ARGS --no-coverage"
else
  JEST_ARGS="$JEST_ARGS --coverage"
  if [ $HTML_COVERAGE -eq 1 ]; then
    JEST_ARGS="$JEST_ARGS --coverageReporters=lcov"
  fi
fi

# 監視モード
if [ $WATCH -eq 1 ]; then
  JEST_ARGS="$JEST_ARGS --watch"
else
  JEST_ARGS="$JEST_ARGS --forceExit"
fi

# JUnit レポート
if [ $JUNIT_REPORT -eq 1 ]; then
  JEST_ARGS="$JEST_ARGS --reporters=default --reporters=jest-junit"
fi

# 最終的なコマンド
JEST_CMD="npx jest $JEST_ARGS"

# デバッグモードの場合は実行コマンドを表示
if [ $DEBUG_MODE -eq 1 ]; then
  print_info "実行コマンド: $ENV_VARS $JEST_CMD"
fi

# テスト実行時間計測開始
START_TIME=$(date +%s)

# テスト実行 - 修正版：プロセス置換を使わない互換性のあるバージョン
print_step "テストを実行しています..."
eval "$ENV_VARS $JEST_CMD" >> "$LOG_FILE" 2>> "$ERROR_LOG_FILE"
TEST_RESULT=$?

# テスト実行時間計測終了
END_TIME=$(date +%s)
EXECUTION_TIME=$((END_TIME - START_TIME))
MINUTES=$((EXECUTION_TIME / 60))
SECONDS=$((EXECUTION_TIME % 60))

# ビジュアルレポートを表示
if [ $VISUAL -eq 1 ] && [ -f "./test-results/visual-report.html" ]; then
  print_step "ビジュアルレポートを表示しています..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open ./test-results/visual-report.html
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open ./test-results/visual-report.html 2>/dev/null || print_warning "ブラウザで ./test-results/visual-report.html を開いてください"
  elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    start ./test-results/visual-report.html
  else
    print_warning "ブラウザで ./test-results/visual-report.html を開いてください"
  fi
elif [ $VISUAL -eq 1 ]; then
  print_warning "ビジュアルレポートが見つかりません"
fi

# HTMLカバレッジレポートを表示
if [ $HTML_COVERAGE -eq 1 ] && [ -f "./coverage/lcov-report/index.html" ]; then
  print_step "HTMLカバレッジレポートを表示しています..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open ./coverage/lcov-report/index.html
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open ./coverage/lcov-report/index.html 2>/dev/null || print_warning "ブラウザで ./coverage/lcov-report/index.html を開いてください"
  elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    start ./coverage/lcov-report/index.html
  else
    print_warning "ブラウザで ./coverage/lcov-report/index.html を開いてください"
  fi
elif [ $HTML_COVERAGE -eq 1 ]; then
  print_warning "HTMLカバレッジレポートが見つかりません"
fi

# 結果表示
if [ $TEST_RESULT -eq 0 ]; then
  print_header "テスト実行が成功しました! 🎉"
  echo -e "${GREEN}${BOLD}テスト結果サマリー:${NC}"
  echo -e "  ・テスト種別: ${BOLD}${TEST_TYPE}${NC}"
  echo -e "  ・実行時間: ${BOLD}${MINUTES}分 ${SECONDS}秒${NC}"
else
  print_header "テスト実行が失敗しました... 😢"
  echo -e "${RED}${BOLD}テスト結果サマリー:${NC}"
  echo -e "  ・テスト種別: ${BOLD}${TEST_TYPE}${NC}"
  echo -e "  ・実行時間: ${BOLD}${MINUTES}分 ${SECONDS}秒${NC}"
  
  echo -e "\n${BLUE}改善提案:${NC}"
  echo -e "  ・詳細な出力を有効にして再実行: $0 -v $TEST_TYPE"
  echo -e "  ・モックモードで再実行: $0 -m $TEST_TYPE"
  echo -e "  ・デバッグモードで再実行: $0 -d $TEST_TYPE"
fi

echo -e "\n${BLUE}詳細情報:${NC}"
echo -e "  ・ログファイル: $LOG_FILE"
echo -e "  ・エラーログ: $ERROR_LOG_FILE"

exit $TEST_RESULT
