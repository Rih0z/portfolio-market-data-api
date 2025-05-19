#!/bin/bash
# 
# ファイルパス: scripts/run-tests.sh
# 
# Portfolio Market Data APIテスト実行スクリプト
# Jest設定ファイルを利用し、各種テスト実行オプションを提供
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
  echo "  -i, --ignore-coverage-errors テスト自体は成功してもカバレッジエラーを無視"
  echo "  -s, --specific              特定のファイルまたはパターンに一致するテストのみ実行"
  echo "  -t, --target                カバレッジ目標段階を指定 [initial|mid|final]"
  echo "  --html-coverage             HTMLカバレッジレポートをブラウザで開く"
  echo "  --chart                     カバレッジをチャートで生成（ビジュアルレポートに追加）"
  echo "  --junit                     JUnit形式のレポートを生成（CI環境用）"
  echo "  --nvm                       nvmを使用してNode.js 18に切り替え"
  echo "  --force-coverage            カバレッジ計測を強制的に有効化（--no-coverageより優先）"
  echo "  --config                    カスタムJest設定ファイルのパスを指定"
  echo "  --verbose-coverage          カバレッジデータ処理の詳細ログを出力"
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
SPECIFIC_PATTERN=""
TEST_TYPE=""
COVERAGE_TARGET="initial"
JEST_CONFIG_PATH="jest.config.js"
VERBOSE_COVERAGE=0

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
    -t|--target)
      COVERAGE_TARGET="$2"
      shift 2
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
    --config)
      JEST_CONFIG_PATH="$2"
      shift 2
      ;;
    --verbose-coverage)
      VERBOSE_COVERAGE=1
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

if [ $VERBOSE_COVERAGE -eq 1 ]; then
  ENV_VARS="$ENV_VARS VERBOSE_COVERAGE=true"
  print_info "カバレッジデータ処理の詳細ログを出力します"
fi

# テストコマンドの構築
TEST_CMD=""
JEST_ARGS=""

# Jest設定ファイルを指定
JEST_ARGS="--config=$JEST_CONFIG_PATH"

# テスト種別に基づいてJestの引数を設定
case $TEST_TYPE in
  unit)
    print_header "単体テストを実行中..."
    JEST_ARGS="$JEST_ARGS --selectProjects unit"
    ;;
  unit:services)
    print_header "サービス層の単体テストを実行中..."
    JEST_ARGS="$JEST_ARGS --selectProjects unit --testPathPattern=services"
    ;;
  unit:utils)
    print_header "ユーティリティの単体テストを実行中..."
    JEST_ARGS="$JEST_ARGS --selectProjects unit --testPathPattern=utils"
    ;;
  unit:function)
    print_header "API関数の単体テストを実行中..."
    JEST_ARGS="$JEST_ARGS --selectProjects unit --testPathPattern=function"
    ;;
  integration)
    print_header "統合テストを実行中..."
    JEST_ARGS="$JEST_ARGS --selectProjects integration"
    ;;
  integration:auth)
    print_header "認証関連の統合テストを実行中..."
    JEST_ARGS="$JEST_ARGS --selectProjects integration --testPathPattern=auth"
    ;;
  integration:market)
    print_header "マーケットデータ関連の統合テストを実行中..."
    JEST_ARGS="$JEST_ARGS --selectProjects integration --testPathPattern=marketData"
    ;;
  integration:drive)
    print_header "Google Drive関連の統合テストを実行中..."
    JEST_ARGS="$JEST_ARGS --selectProjects integration --testPathPattern=drive"
    ;;
  e2e)
    print_header "エンドツーエンドテストを実行中..."
    JEST_ARGS="$JEST_ARGS --selectProjects e2e"
    ;;
  all)
    print_header "すべてのテストを実行中..."
    JEST_ARGS="$JEST_ARGS --selectProjects unit integration e2e"
    ;;
  quick)
    print_header "クイックテスト（単体+統合）を実行中..."
    JEST_ARGS="$JEST_ARGS --selectProjects unit integration"
    ENV_VARS="$ENV_VARS USE_API_MOCKS=true"
    ;;
  specific)
    print_header "特定のパターンに一致するテストを実行中..."
    print_info "パターン: $SPECIFIC_PATTERN"
    JEST_ARGS="$JEST_ARGS --testPathPattern=$SPECIFIC_PATTERN"
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
    JEST_ARGS="$JEST_ARGS --coverage --coverageReporters=lcov --coverageReporters=json-summary --coverageReporters=json"
  else
    JEST_ARGS="$JEST_ARGS --coverage --coverageReporters=json-summary --coverageReporters=json"
  fi
  # カバレッジ関連の環境変数を設定
  ENV_VARS="$ENV_VARS COLLECT_COVERAGE=true FORCE_COLLECT_COVERAGE=true"
  NO_COVERAGE=0
elif [ $NO_COVERAGE -eq 1 ]; then
  print_info "カバレッジチェックが無効化されています"
  JEST_ARGS="$JEST_ARGS --no-coverage"
else
  print_info "カバレッジ計測を有効化しています"
  # デフォルトでもカバレッジを有効化
  if [ $HTML_COVERAGE -eq 1 ]; then
    print_info "HTMLカバレッジレポートを生成します"
    JEST_ARGS="$JEST_ARGS --coverage --coverageReporters=lcov --coverageReporters=json-summary --coverageReporters=json"
  else
    JEST_ARGS="$JEST_ARGS --coverage --coverageReporters=json-summary --coverageReporters=json"
  fi
  # カバレッジ関連の環境変数を設定
  ENV_VARS="$ENV_VARS COLLECT_COVERAGE=true FORCE_COLLECT_COVERAGE=true"
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
if [ $DEBUG_MODE -eq 1 ] || [ $VERBOSE_COVERAGE -eq 1 ]; then
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
  eval "npx cross-env JEST_COVERAGE=true COLLECT_COVERAGE=true FORCE_COLLECT_COVERAGE=true ENABLE_COVERAGE=true $ENV_VARS $JEST_CMD"
else
  # JESTのカバレッジ設定を強制的に有効化
  eval "npx cross-env JEST_COVERAGE=true COLLECT_COVERAGE=true FORCE_COLLECT_COVERAGE=true ENABLE_COVERAGE=true $JEST_CMD"
fi

# テスト結果
TEST_RESULT=$?

# 失敗の詳細な理由を特定する関数
analyze_failure_reason() {
  local has_coverage_data=0
  local has_coverage_issue=0
  local has_failed_tests=0
  local has_config_issue=0
  local failure_message=""
  
  # カバレッジデータの有無を確認
  if [ -f "./test-results/detailed-results.json" ]; then
    # 失敗したテストがあるか確認
    FAILED_TESTS=$(grep -o '"numFailedTests":[0-9]*' ./test-results/detailed-results.json | cut -d':' -f2)
    
    if [ "$FAILED_TESTS" != "0" ]; then
      has_failed_tests=1
      failure_message="$FAILED_TESTS件のテストが失敗しています"
    fi
    
    # カバレッジ情報があるか確認
    if grep -q "coverageMap" ./test-results/detailed-results.json; then
      has_coverage_data=1
      
      # カバレッジ閾値に達しているか確認
      STATEMENTS_COVERAGE=$(grep -o '"statements":{"covered":[0-9]*,"total":[0-9]*,"pct":[0-9.]*' ./test-results/detailed-results.json | awk -F: '{print $6}' | sed 's/}//')
      BRANCHES_COVERAGE=$(grep -o '"branches":{"covered":[0-9]*,"total":[0-9]*,"pct":[0-9.]*' ./test-results/detailed-results.json | awk -F: '{print $6}' | sed 's/}//')
      FUNCTIONS_COVERAGE=$(grep -o '"functions":{"covered":[0-9]*,"total":[0-9]*,"pct":[0-9.]*' ./test-results/detailed-results.json | awk -F: '{print $6}' | sed 's/}//')
      LINES_COVERAGE=$(grep -o '"lines":{"covered":[0-9]*,"total":[0-9]*,"pct":[0-9.]*' ./test-results/detailed-results.json | awk -F: '{print $6}' | sed 's/}//')
      
      # 目標に応じた閾値
      case $COVERAGE_TARGET in
        initial)
          # 20-30%目標
          THRESHOLD_STATEMENTS=30
          THRESHOLD_BRANCHES=20
          THRESHOLD_FUNCTIONS=25
          THRESHOLD_LINES=30
          ;;
        mid)
          # 40-60%目標
          THRESHOLD_STATEMENTS=60
          THRESHOLD_BRANCHES=50
          THRESHOLD_FUNCTIONS=60
          THRESHOLD_LINES=60
          ;;
        final)
          # 70-80%目標
          THRESHOLD_STATEMENTS=80
          THRESHOLD_BRANCHES=70
          THRESHOLD_FUNCTIONS=80
          THRESHOLD_LINES=80
          ;;
      esac
      
      # カバレッジが閾値を下回っているか確認
      if (( $(echo "$STATEMENTS_COVERAGE < $THRESHOLD_STATEMENTS" | bc -l) || 
             $(echo "$BRANCHES_COVERAGE < $THRESHOLD_BRANCHES" | bc -l) || 
             $(echo "$FUNCTIONS_COVERAGE < $THRESHOLD_FUNCTIONS" | bc -l) || 
             $(echo "$LINES_COVERAGE < $THRESHOLD_LINES" | bc -l) )); then
        has_coverage_issue=1
        
        if [ -z "$failure_message" ]; then
          failure_message="コードカバレッジが要求レベルに達していません"
        fi
      fi
    else
      has_config_issue=1
      failure_message="カバレッジデータが生成されていません"
    fi
  else
    has_config_issue=1
    failure_message="テスト結果ファイルが見つかりません"
  fi
  
  # 設定ファイルの問題を確認
  if [ ! -f "$JEST_CONFIG_PATH" ]; then
    has_config_issue=1
    if [ -z "$failure_message" ]; then
      failure_message="Jest設定ファイルが見つかりません: $JEST_CONFIG_PATH"
    fi
  fi
  
  # 最終的な分析
  if [ $has_failed_tests -eq 1 ]; then
    echo "test_failure:$failure_message"
  elif [ $has_coverage_issue -eq 1 ]; then
    echo "coverage_issue:$failure_message"
  elif [ $has_config_issue -eq 1 ]; then
    echo "config_issue:$failure_message"
  else
    echo "unknown:詳細不明のエラーが発生しました"
  fi
}

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
    # 各カバレッジメトリクスを取得
    STATEMENTS_COVERAGE=$(grep -o '"statements":{"covered":[0-9]*,"total":[0-9]*,"pct":[0-9.]*' ./test-results/detailed-results.json | awk -F: '{print $6}' | sed 's/}//')
    BRANCHES_COVERAGE=$(grep -o '"branches":{"covered":[0-9]*,"total":[0-9]*,"pct":[0-9.]*' ./test-results/detailed-results.json | awk -F: '{print $6}' | sed 's/}//')
    FUNCTIONS_COVERAGE=$(grep -o '"functions":{"covered":[0-9]*,"total":[0-9]*,"pct":[0-9.]*' ./test-results/detailed-results.json | awk -F: '{print $6}' | sed 's/}//')
    LINES_COVERAGE=$(grep -o '"lines":{"covered":[0-9]*,"total":[0-9]*,"pct":[0-9.]*' ./test-results/detailed-results.json | awk -F: '{print $6}' | sed 's/}//')
    
    # カバレッジ目標段階とカバレッジ率の表示
    echo -e "${BLUE}カバレッジ目標段階: ${YELLOW}$COVERAGE_TARGET${NC}"
    
    # 目標に応じてカバレッジ率を色分け表示
    case $COVERAGE_TARGET in
      initial)
        # 20-30%目標
        THRESHOLD_STATEMENTS=30
        THRESHOLD_BRANCHES=20
        THRESHOLD_FUNCTIONS=25
        THRESHOLD_LINES=30
        ;;
      mid)
        # 40-60%目標
        THRESHOLD_STATEMENTS=60
        THRESHOLD_BRANCHES=50
        THRESHOLD_FUNCTIONS=60
        THRESHOLD_LINES=60
        ;;
      final)
        # 70-80%目標
        THRESHOLD_STATEMENTS=80
        THRESHOLD_BRANCHES=70
        THRESHOLD_FUNCTIONS=80
        THRESHOLD_LINES=80
        ;;
    esac
    
    # カバレッジ率の表示（目標達成状況に応じて色分け）
    if (( $(echo "$STATEMENTS_COVERAGE >= $THRESHOLD_STATEMENTS" | bc -l) )); then
      echo -e "Statements: ${GREEN}${STATEMENTS_COVERAGE}%${NC} (目標: ${THRESHOLD_STATEMENTS}%)"
    else
      echo -e "Statements: ${RED}${STATEMENTS_COVERAGE}%${NC} (目標: ${THRESHOLD_STATEMENTS}%)"
    fi
    
    if (( $(echo "$BRANCHES_COVERAGE >= $THRESHOLD_BRANCHES" | bc -l) )); then
      echo -e "Branches:   ${GREEN}${BRANCHES_COVERAGE}%${NC} (目標: ${THRESHOLD_BRANCHES}%)"
    else
      echo -e "Branches:   ${RED}${BRANCHES_COVERAGE}%${NC} (目標: ${THRESHOLD_BRANCHES}%)"
    fi
    
    if (( $(echo "$FUNCTIONS_COVERAGE >= $THRESHOLD_FUNCTIONS" | bc -l) )); then
      echo -e "Functions:  ${GREEN}${FUNCTIONS_COVERAGE}%${NC} (目標: ${THRESHOLD_FUNCTIONS}%)"
    else
      echo -e "Functions:  ${RED}${FUNCTIONS_COVERAGE}%${NC} (目標: ${THRESHOLD_FUNCTIONS}%)"
    fi
    
    if (( $(echo "$LINES_COVERAGE >= $THRESHOLD_LINES" | bc -l) )); then
      echo -e "Lines:      ${GREEN}${LINES_COVERAGE}%${NC} (目標: ${THRESHOLD_LINES}%)"
    else
      echo -e "Lines:      ${RED}${LINES_COVERAGE}%${NC} (目標: ${THRESHOLD_LINES}%)"
    fi
    
    # 次の目標段階の提案
    ALL_TARGETS_MET=1
    
    if (( $(echo "$STATEMENTS_COVERAGE < $THRESHOLD_STATEMENTS" | bc -l) || 
           $(echo "$BRANCHES_COVERAGE < $THRESHOLD_BRANCHES" | bc -l) || 
           $(echo "$FUNCTIONS_COVERAGE < $THRESHOLD_FUNCTIONS" | bc -l) || 
           $(echo "$LINES_COVERAGE < $THRESHOLD_LINES" | bc -l) )); then
      ALL_TARGETS_MET=0
    fi
    
    if [ $ALL_TARGETS_MET -eq 1 ]; then
      case $COVERAGE_TARGET in
        initial)
          print_success "初期段階の目標を達成しました！次は中間段階(-t mid)に挑戦しましょう"
          ;;
        mid)
          print_success "中間段階の目標を達成しました！次は最終段階(-t final)に挑戦しましょう"
          ;;
        final)
          print_success "最終段階の目標を達成しました！素晴らしい成果です 🎉"
          ;;
      esac
    else
      print_warning "現在の段階の目標をまだ達成していません。引き続きテスト実装を進めましょう"
      
      # 未達成の目標を表示
      echo -e "${YELLOW}未達成の目標:${NC}"
      if (( $(echo "$STATEMENTS_COVERAGE < $THRESHOLD_STATEMENTS" | bc -l) )); then
        echo -e "- Statements: ${RED}${STATEMENTS_COVERAGE}%${NC} → ${YELLOW}${THRESHOLD_STATEMENTS}%${NC}"
      fi
      if (( $(echo "$BRANCHES_COVERAGE < $THRESHOLD_BRANCHES" | bc -l) )); then
        echo -e "- Branches:   ${RED}${BRANCHES_COVERAGE}%${NC} → ${YELLOW}${THRESHOLD_BRANCHES}%${NC}"
      fi
      if (( $(echo "$FUNCTIONS_COVERAGE < $THRESHOLD_FUNCTIONS" | bc -l) )); then
        echo -e "- Functions:  ${RED}${FUNCTIONS_COVERAGE}%${NC} → ${YELLOW}${THRESHOLD_FUNCTIONS}%${NC}"
      fi
      if (( $(echo "$LINES_COVERAGE < $THRESHOLD_LINES" | bc -l) )); then
        echo -e "- Lines:      ${RED}${LINES_COVERAGE}%${NC} → ${YELLOW}${THRESHOLD_LINES}%${NC}"
      fi
    fi
  fi
else
  # 失敗原因の分析
  FAILURE_ANALYSIS=$(analyze_failure_reason)
  FAILURE_TYPE=${FAILURE_ANALYSIS%%:*}
  FAILURE_MESSAGE=${FAILURE_ANALYSIS#*:}
  
  # 失敗原因に応じたメッセージを表示
  print_header "テスト実行が失敗しました 😢"
  print_info "失敗の詳細分析:"
  
  case $FAILURE_TYPE in
    test_failure)
      print_error "テスト実行エラー: $FAILURE_MESSAGE"
      echo -e "${RED}テストコードに問題があります。アサーションに失敗しています。${NC}"
      if [ -f "./test-results/test-log.md" ]; then
        echo -e "\n${YELLOW}失敗したテストの詳細:${NC}"
        grep -A 3 "## エラーサマリー" ./test-results/test-log.md | head -10
        echo -e "${YELLOW}...(省略)...${NC}"
      fi
      
      # 次のアクション
      echo -e "\n${BLUE}次のアクション:${NC}"
      echo -e "1. ${GREEN}失敗したテストを確認する:${NC}"
      echo "   cat ./test-results/test-log.md"
      echo -e "2. ${GREEN}ビジュアルレポートで詳細を確認する:${NC}"
      echo "   ./scripts/run-tests.sh -v $TEST_TYPE"
      echo -e "3. ${GREEN}特定のテストだけを実行して調査する:${NC}"
      echo "   ./scripts/run-tests.sh -s \"パターン\" specific"
      ;;
      
    coverage_issue)
      print_error "カバレッジ不足: $FAILURE_MESSAGE"
      
      # カバレッジ情報を表示
      if [ -f "./test-results/detailed-results.json" ]; then
        # 各カバレッジメトリクスを取得
        STATEMENTS_COVERAGE=$(grep -o '"statements":{"covered":[0-9]*,"total":[0-9]*,"pct":[0-9.]*' ./test-results/detailed-results.json | awk -F: '{print $6}' | sed 's/}//')
        BRANCHES_COVERAGE=$(grep -o '"branches":{"covered":[0-9]*,"total":[0-9]*,"pct":[0-9.]*' ./test-results/detailed-results.json | awk -F: '{print $6}' | sed 's/}//')
        FUNCTIONS_COVERAGE=$(grep -o '"functions":{"covered":[0-9]*,"total":[0-9]*,"pct":[0-9.]*' ./test-results/detailed-results.json | awk -F: '{print $6}' | sed 's/}//')
        LINES_COVERAGE=$(grep -o '"lines":{"covered":[0-9]*,"total":[0-9]*,"pct":[0-9.]*' ./test-results/detailed-results.json | awk -F: '{print $6}' | sed 's/}//')
        
        # 現在のカバレッジ状況
        echo -e "${YELLOW}現在のカバレッジ状況:${NC}"
        echo -e "- Statements: ${RED}${STATEMENTS_COVERAGE}%${NC}"
        echo -e "- Branches:   ${RED}${BRANCHES_COVERAGE}%${NC}"
        echo -e "- Functions:  ${RED}${FUNCTIONS_COVERAGE}%${NC}"
        echo -e "- Lines:      ${RED}${LINES_COVERAGE}%${NC}"
        
        # 目標に応じた閾値
        case $COVERAGE_TARGET in
          initial)
            # 20-30%目標
            THRESHOLD_STATEMENTS=30
            THRESHOLD_BRANCHES=20
            THRESHOLD_FUNCTIONS=25
            THRESHOLD_LINES=30
            
            echo -e "\n${YELLOW}初期段階の目標:${NC}"
            echo -e "- Statements: ${THRESHOLD_STATEMENTS}%"
            echo -e "- Branches:   ${THRESHOLD_BRANCHES}%"
            echo -e "- Functions:  ${THRESHOLD_FUNCTIONS}%"
            echo -e "- Lines:      ${THRESHOLD_LINES}%"
            ;;
          mid)
            # 40-60%目標
            THRESHOLD_STATEMENTS=60
            THRESHOLD_BRANCHES=50
            THRESHOLD_FUNCTIONS=60
            THRESHOLD_LINES=60
            
            echo -e "\n${YELLOW}中間段階の目標:${NC}"
            echo -e "- Statements: ${THRESHOLD_STATEMENTS}%"
            echo -e "- Branches:   ${THRESHOLD_BRANCHES}%"
            echo -e "- Functions:  ${THRESHOLD_FUNCTIONS}%"
            echo -e "- Lines:      ${THRESHOLD_LINES}%"
            ;;
          final)
            # 70-80%目標
            THRESHOLD_STATEMENTS=80
            THRESHOLD_BRANCHES=70
            THRESHOLD_FUNCTIONS=80
            THRESHOLD_LINES=80
            
            echo -e "\n${YELLOW}最終段階の目標:${NC}"
            echo -e "- Statements: ${THRESHOLD_STATEMENTS}%"
            echo -e "- Branches:   ${THRESHOLD_BRANCHES}%"
            echo -e "- Functions:  ${THRESHOLD_FUNCTIONS}%"
            echo -e "- Lines:      ${THRESHOLD_LINES}%"
            ;;
        esac
      fi
      
      # 次のアクション
      echo -e "\n${BLUE}次のアクション:${NC}"
      echo -e "1. ${GREEN}カバレッジを無視してテストを実行する:${NC}"
      echo "   ./scripts/run-tests.sh -i $TEST_TYPE"
      echo -e "2. ${GREEN}より適切なカバレッジ目標を設定する:${NC}"
      echo "   ./scripts/run-tests.sh -t initial $TEST_TYPE"
      echo -e "3. ${GREEN}カバレッジレポートを確認して足りない部分を特定する:${NC}"
      echo "   ./scripts/run-tests.sh --html-coverage $TEST_TYPE"
      echo -e "4. ${GREEN}テストを追加してカバレッジを向上させる:${NC}"
      echo "   主に未テストのファイルに注目してください"
      ;;
      
    config_issue)
      print_error "設定エラー: $FAILURE_MESSAGE"
      echo -e "${RED}テスト設定に問題があります。${NC}"
      
      # 次のアクション
      echo -e "\n${BLUE}次のアクション:${NC}"
      echo -e "1. ${GREEN}Jestの設定ファイルを確認する:${NC}"
      echo "   cat $JEST_CONFIG_PATH"
      echo -e "2. ${GREEN}カバレッジを強制的に有効化する:${NC}"
      echo "   ./scripts/run-tests.sh --force-coverage $TEST_TYPE"
      echo -e "3. ${GREEN}デバッグモードで詳細ログを確認する:${NC}"
      echo "   ./scripts/run-tests.sh -d $TEST_TYPE"
      ;;
      
    *)
      print_error "不明なエラー"
      echo -e "${RED}原因不明のエラーが発生しました。デバッグモードで追加情報を確認してください。${NC}"
      
      # 次のアクション
      echo -e "\n${BLUE}次のアクション:${NC}"
      echo -e "1. ${GREEN}デバッグモードで再実行する:${NC}"
      echo "   ./scripts/run-tests.sh -d $TEST_TYPE"
      echo -e "2. ${GREEN}テスト環境をクリーンアップして再実行する:${NC}"
      echo "   ./scripts/run-tests.sh -c $TEST_TYPE"
      echo -e "3. ${GREEN}カバレッジを無効化して実行する:${NC}"
      echo "   ./scripts/run-tests.sh -n $TEST_TYPE"
      ;;
  esac
  
  # Jest設定ファイルとカバレッジ閾値の表示
  if [ -f "$JEST_CONFIG_PATH" ] && ([ $FAILURE_TYPE = "coverage_issue" ] || [ $FAILURE_TYPE = "config_issue" ]); then
    echo -e "\n${YELLOW}Jest設定ファイルのカバレッジ閾値:${NC}"
    grep -A 10 "coverageThreshold" "$JEST_CONFIG_PATH" || echo "カバレッジ閾値が設定されていません"
    
    # カバレッジ閾値と現在のカバレッジの乖離に関する説明
    if [ $FAILURE_TYPE = "coverage_issue" ]; then
      echo -e "\n${YELLOW}注意:${NC} Jest設定ファイルの閾値とrun-tests.shスクリプトの閾値が異なる場合、"
      echo "より厳しい方の閾値が適用されます。Jest設定ファイルの閾値を調整するか、"
      echo "カバレッジエラーを無視するオプション(-i)を使用することを検討してください。"
    fi
  fi
fi

# テスト後のクリーンアップ提案
if [ $TEST_RESULT -eq 0 ] && [ $CLEAN -ne 1 ]; then
  print_info "次回のテスト実行前に環境をクリーンアップすることをお勧めします:"
  echo "  ./scripts/run-tests.sh -c ..."
fi

exit $TEST_RESULT
