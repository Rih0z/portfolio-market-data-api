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
OUTPUT_LOG_FILE="./test-results/run-output.log"

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

# テスト結果出力を一時ファイルに保存するためのディレクトリを確保
mkdir -p ./test-results

# テストの実行（出力をファイルと標準出力の両方に送る）
if [ -n "$ENV_VARS" ]; then
  # JESTのカバレッジ設定を強制的に有効化（.env.localの設定より優先）
  eval "npx cross-env JEST_COVERAGE=true COLLECT_COVERAGE=true FORCE_COLLECT_COVERAGE=true ENABLE_COVERAGE=true $ENV_VARS $JEST_CMD" 2>&1 | tee "$OUTPUT_LOG_FILE"
else
  # JESTのカバレッジ設定を強制的に有効化
  eval "npx cross-env JEST_COVERAGE=true COLLECT_COVERAGE=true FORCE_COLLECT_COVERAGE=true ENABLE_COVERAGE=true $JEST_CMD" 2>&1 | tee "$OUTPUT_LOG_FILE"
fi

# テスト結果
TEST_RESULT=${PIPESTATUS[0]}

# Jestの出力からテスト実行の詳細を解析する関数
analyze_jest_output() {
  local output_file="$1"
  local total_suites=0
  local failed_suites=0
  local passed_suites=0
  local skipped_suites=0
  local total_tests=0
  local failed_tests=0
  local passed_tests=0
  local skipped_tests=0
  local has_coverage_issue=0
  local failure_reason=""
  
  # ファイルが存在することを確認
  if [ ! -f "$output_file" ]; then
    echo "unknown_error:テスト出力ファイルが見つかりません"
    return
  fi
  
  # テストスイートの結果を解析
  if grep -q "Test Suites:" "$output_file"; then
    local suites_line=$(grep "Test Suites:" "$output_file" | tail -n1)
    
    # 失敗したスイート数を抽出
    if [[ $suites_line =~ ([0-9]+)\ failed ]]; then
      failed_suites=${BASH_REMATCH[1]}
    fi
    
    # 成功したスイート数を抽出
    if [[ $suites_line =~ ([0-9]+)\ passed ]]; then
      passed_suites=${BASH_REMATCH[1]}
    fi
    
    # スキップされたスイート数を抽出
    if [[ $suites_line =~ ([0-9]+)\ skipped ]]; then
      skipped_suites=${BASH_REMATCH[1]}
    fi
    
    # 合計スイート数を抽出
    if [[ $suites_line =~ ([0-9]+)\ total ]]; then
      total_suites=${BASH_REMATCH[1]}
    fi
  fi
  
  # テストの結果を解析
  if grep -q "Tests:" "$output_file"; then
    local tests_line=$(grep "Tests:" "$output_file" | tail -n1)
    
    # 失敗したテスト数を抽出
    if [[ $tests_line =~ ([0-9]+)\ failed ]]; then
      failed_tests=${BASH_REMATCH[1]}
    fi
    
    # 成功したテスト数を抽出
    if [[ $tests_line =~ ([0-9]+)\ passed ]]; then
      passed_tests=${BASH_REMATCH[1]}
    fi
    
    # スキップされたテスト数を抽出
    if [[ $tests_line =~ ([0-9]+)\ skipped ]]; then
      skipped_tests=${BASH_REMATCH[1]}
    fi
    
    # 合計テスト数を抽出
    if [[ $tests_line =~ ([0-9]+)\ total ]]; then
      total_tests=${BASH_REMATCH[1]}
    fi
  fi
  
  # カバレッジエラーを検出
  if grep -q "Minimum required coverage" "$output_file" || grep -q "Your test coverage is" "$output_file" || grep -q "Coverage for" "$output_file"; then
    has_coverage_issue=1
  fi
  
  # 構文エラーの検出
  if grep -q "Parse error" "$output_file" || grep -q "SyntaxError" "$output_file"; then
    echo "syntax_error:構文エラーが検出されました"
    return
  fi
  
  # 実行エラーの検出
  if grep -q "Command failed with exit code" "$output_file"; then
    echo "execution_error:コマンド実行エラーが発生しました"
    return
  fi
  
  # 最終的な分析結果
  # 1. テスト失敗がある場合
  if [ "$failed_tests" -gt 0 ]; then
    echo "test_failure:${failed_tests}個のテストが失敗しています"
  # 2. テストは成功しているがテストスイート失敗の場合
  elif [ "$failed_suites" -gt 0 ]; then
    echo "suite_failure:${failed_suites}個のテストスイートが失敗しています"
  # 3. カバレッジの問題の場合
  elif [ $has_coverage_issue -eq 1 ]; then
    echo "coverage_issue:コードカバレッジが要求レベルに達していません"
  # 4. JSONの不一致（detailed-results.jsonとJestの出力の不一致）
  elif [ -f "./test-results/detailed-results.json" ]; then
    local json_failed_tests=$(grep -o '"numFailedTests":[0-9]*' ./test-results/detailed-results.json | cut -d':' -f2)
    
    if [ "$json_failed_tests" != "$failed_tests" ]; then
      echo "data_mismatch:Jestの出力とJSONデータの間に不一致があります"
    else
      # すべてのテストが成功していてもJestが非ゼロ終了コードを返した場合
      if [ $TEST_RESULT -ne 0 ]; then
        echo "coverage_issue:コードカバレッジが要求レベルに達していません"
      else
        echo "success:テストは正常に完了しました"
      fi
    fi
  else
    # detailed-results.jsonが見つからない場合
    echo "data_missing:テスト結果のJSONデータが見つかりません"
  fi
}

# 失敗したテストの詳細を収集する関数
gather_failed_tests() {
  local output_file="$1"
  local results=()
  local in_failure_section=0
  local current_test=""
  local current_failure=""
  
  while IFS= read -r line; do
    # 失敗テストのセクション開始を検出
    if [[ "$line" =~ FAIL|ERROR ]]; then
      in_failure_section=1
      current_test="$line"
      current_failure=""
    # 失敗テストのセクション内での失敗理由を収集
    elif [ $in_failure_section -eq 1 ]; then
      # 別のテスト結果や要約セクションの開始を検出
      if [[ "$line" =~ ^(PASS|FAIL|ERROR|Test Suites:|Tests:) ]]; then
        # 現在の失敗テストを結果に追加して次へ
        if [ -n "$current_test" ]; then
          results+=("$current_test: $current_failure")
        fi
        in_failure_section=0
        current_test=""
        current_failure=""
        
        # 新しい失敗テストの開始なら処理
        if [[ "$line" =~ FAIL|ERROR ]]; then
          in_failure_section=1
          current_test="$line"
        fi
      else
        # 失敗メッセージを追加
        current_failure="${current_failure}${line}\n"
      fi
    fi
  done < "$output_file"
  
  # 最後の失敗テストを追加
  if [ $in_failure_section -eq 1 ] && [ -n "$current_test" ]; then
    results+=("$current_test: $current_failure")
  fi
  
  # 結果を返す
  if [ ${#results[@]} -eq 0 ]; then
    echo "詳細な失敗情報はありません"
  else
    # 最初の3件を表示（長すぎる場合は省略）
    local count=0
    for result in "${results[@]}"; do
      if [ $count -lt 3 ]; then
        # テスト名だけを抽出して表示
        local test_name=$(echo "$result" | grep -oE "FAIL [^:]+|ERROR [^:]+" | sed 's/^FAIL //;s/^ERROR //')
        echo "$test_name"
      fi
      ((count++))
    done
    
    if [ ${#results[@]} -gt 3 ]; then
      echo "...他 $((${#results[@]} - 3)) 件のテストが失敗しています"
    fi
  fi
}

# Jestの出力を解析
ANALYSIS_RESULT=$(analyze_failure_reason)
FAILURE_TYPE=${ANALYSIS_RESULT%%:*}
FAILURE_MESSAGE=${ANALYSIS_RESULT#*:}

# カバレッジ情報を取得
get_coverage_info() {
  local thresholds
  case $COVERAGE_TARGET in
    initial)
      # 20-30%目標
      thresholds=("30" "20" "25" "30")
      ;;
    mid)
      # 40-60%目標
      thresholds=("60" "50" "60" "60")
      ;;
    final)
      # 70-80%目標
      thresholds=("80" "70" "80" "80")
      ;;
  esac
  
  if [ -f "./test-results/detailed-results.json" ]; then
    local statements_coverage=$(grep -o '"statements":{"covered":[0-9]*,"total":[0-9]*,"pct":[0-9.]*' ./test-results/detailed-results.json | awk -F: '{print $6}' | sed 's/}//')
    local branches_coverage=$(grep -o '"branches":{"covered":[0-9]*,"total":[0-9]*,"pct":[0-9.]*' ./test-results/detailed-results.json | awk -F: '{print $6}' | sed 's/}//')
    local functions_coverage=$(grep -o '"functions":{"covered":[0-9]*,"total":[0-9]*,"pct":[0-9.]*' ./test-results/detailed-results.json | awk -F: '{print $6}' | sed 's/}//')
    local lines_coverage=$(grep -o '"lines":{"covered":[0-9]*,"total":[0-9]*,"pct":[0-9.]*' ./test-results/detailed-results.json | awk -F: '{print $6}' | sed 's/}//')
    
    # 調整されたカバレッジ（端数が切り捨てられる場合がある）
    statements_coverage=$(printf "%.1f" "$statements_coverage" 2>/dev/null || echo "$statements_coverage")
    branches_coverage=$(printf "%.1f" "$branches_coverage" 2>/dev/null || echo "$branches_coverage")
    functions_coverage=$(printf "%.1f" "$functions_coverage" 2>/dev/null || echo "$functions_coverage")
    lines_coverage=$(printf "%.1f" "$lines_coverage" 2>/dev/null || echo "$lines_coverage")
    
    # 結果を配列で返す
    echo "$statements_coverage $branches_coverage $functions_coverage $lines_coverage ${thresholds[0]} ${thresholds[1]} ${thresholds[2]} ${thresholds[3]}"
  else
    echo "0 0 0 0 ${thresholds[0]} ${thresholds[1]} ${thresholds[2]} ${thresholds[3]}"
  fi
}

# カバレッジエラーを無視するモードが有効な場合
if [ $IGNORE_COVERAGE_ERRORS -eq 1 ] && [ "$FAILURE_TYPE" = "coverage_issue" ]; then
  print_info "カバレッジエラーを無視するモードが有効です。テストは成功とみなします。"
  TEST_RESULT=0
  FAILURE_TYPE="success"
  FAILURE_MESSAGE="テストは正常に完了しました（カバレッジエラーは無視）"
fi

# ビジュアルレポートが指定された場合
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

# Jestの出力にある実際のテスト結果概要を表示する関数
print_test_summary() {
  local output_file="$1"
  
  if grep -q "Test Suites:" "$output_file"; then
    echo "テスト実行結果概要:"
    echo "--------------------"
    grep "Test Suites:" "$output_file" | tail -n1
    grep "Tests:" "$output_file" | tail -n1
    grep "Snapshots:" "$output_file" | tail -n1
    grep "Time:" "$output_file" | tail -n1
    echo "--------------------"
  fi
}

# module not foundエラーを検出する関数
extract_module_not_found_errors() {
  local output_file="$1"
  local errors=()
  local capture=0
  local current_error=""
  local count=0
  
  while IFS= read -r line; do
    if [[ "$line" =~ FAIL ]]; then
      if [ $capture -eq 1 ] && [ -n "$current_error" ]; then
        errors+=("$current_error")
      fi
      capture=1
      current_error="$line\n"
    elif [ $capture -eq 1 ]; then
      if [[ "$line" =~ "Cannot find module" ]]; then
        current_error+="$line\n"
      elif [[ "$line" =~ "at ".*"require" ]]; then
        current_error+="$line\n"
        
        # モジュールが見つからないエラーを完全に取得したらカウント
        errors+=("$current_error")
        current_error=""
        capture=0
        ((count++))
      elif [[ "$line" =~ Test\ Suites: ]]; then
        # テスト概要行に達したら終了
        if [ -n "$current_error" ]; then
          errors+=("$current_error")
        fi
        break
      fi
    fi
  done < "$output_file"
  
  # 最大3つのエラーを表示
  local num_to_show=$(( count > 3 ? 3 : count ))
  
  if [ $count -gt 0 ]; then
    echo -e "${YELLOW}モジュール読み込みエラー (${count}件):${NC}"
    for (( i=0; i<num_to_show; i++ )); do
      echo -e "${errors[$i]}"
    done
    
    if [ $count -gt 3 ]; then
      echo -e "${YELLOW}...他にも ${count - 3} 件のエラーがあります${NC}"
    fi
  fi
}

  # 結果の表示
if [ "$FAILURE_TYPE" = "success" ]; then
  print_header "テスト実行が成功しました! 🎉"
  
  # カバレッジ情報をログファイルから抽出して表示
  if [ $NO_COVERAGE -ne 1 ] && [ -f "./test-results/detailed-results.json" ]; then
    # カバレッジ情報を取得
    coverage_info=($(get_coverage_info))
    
    # カバレッジ目標段階とカバレッジ率の表示
    echo -e "${BLUE}カバレッジ目標段階: ${YELLOW}$COVERAGE_TARGET${NC}"
    
    # カバレッジ率の表示（目標達成状況に応じて色分け）
    if (( $(echo "${coverage_info[0]} >= ${coverage_info[4]}" | bc -l) )); then
      echo -e "Statements: ${GREEN}${coverage_info[0]}%${NC} (目標: ${coverage_info[4]}%)"
    else
      echo -e "Statements: ${RED}${coverage_info[0]}%${NC} (目標: ${coverage_info[4]}%)"
    fi
    
    if (( $(echo "${coverage_info[1]} >= ${coverage_info[5]}" | bc -l) )); then
      echo -e "Branches:   ${GREEN}${coverage_info[1]}%${NC} (目標: ${coverage_info[5]}%)"
    else
      echo -e "Branches:   ${RED}${coverage_info[1]}%${NC} (目標: ${coverage_info[5]}%)"
    fi
    
    if (( $(echo "${coverage_info[2]} >= ${coverage_info[6]}" | bc -l) )); then
      echo -e "Functions:  ${GREEN}${coverage_info[2]}%${NC} (目標: ${coverage_info[6]}%)"
    else
      echo -e "Functions:  ${RED}${coverage_info[2]}%${NC} (目標: ${coverage_info[6]}%)"
    fi
    
    if (( $(echo "${coverage_info[3]} >= ${coverage_info[7]}" | bc -l) )); then
      echo -e "Lines:      ${GREEN}${coverage_info[3]}%${NC} (目標: ${coverage_info[7]}%)"
    else
      echo -e "Lines:      ${RED}${coverage_info[3]}%${NC} (目標: ${coverage_info[7]}%)"
    fi
    
    # 次の目標段階の提案
    ALL_TARGETS_MET=1
    
    if (( $(echo "${coverage_info[0]} < ${coverage_info[4]}" | bc -l) || 
           $(echo "${coverage_info[1]} < ${coverage_info[5]}" | bc -l) || 
           $(echo "${coverage_info[2]} < ${coverage_info[6]}" | bc -l) || 
           $(echo "${coverage_info[3]} < ${coverage_info[7]}" | bc -l) )); then
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
      if (( $(echo "${coverage_info[0]} < ${coverage_info[4]}" | bc -l) )); then
        echo -e "- Statements: ${RED}${coverage_info[0]}%${NC} → ${YELLOW}${coverage_info[4]}%${NC}"
      fi
      if (( $(echo "${coverage_info[1]} < ${coverage_info[5]}" | bc -l) )); then
        echo -e "- Branches:   ${RED}${coverage_info[1]}%${NC} → ${YELLOW}${coverage_info[5]}%${NC}"
      fi
      if (( $(echo "${coverage_info[2]} < ${coverage_info[6]}" | bc -l) )); then
        echo -e "- Functions:  ${RED}${coverage_info[2]}%${NC} → ${YELLOW}${coverage_info[6]}%${NC}"
      fi
      if (( $(echo "${coverage_info[3]} < ${coverage_info[7]}" | bc -l) )); then
        echo -e "- Lines:      ${RED}${coverage_info[3]}%${NC} → ${YELLOW}${coverage_info[7]}%${NC}"
      fi
    fi
  fi
else
  # 失敗原因に応じたメッセージを表示
  print_header "テスト実行が失敗しました 😢"
  print_info "失敗の詳細分析:"
  
  # テスト結果の概要を表示
  print_test_summary "$OUTPUT_LOG_FILE"
  
  case $FAILURE_TYPE in
    module_not_found)
      print_error "モジュール参照エラー: $FAILURE_MESSAGE"
      
      # モジュールが見つからないエラーを詳細に表示
      extract_module_not_found_errors "$OUTPUT_LOG_FILE"
      
      # 次のアクション
      echo -e "\n${BLUE}次のアクション:${NC}"
      echo -e "1. ${GREEN}必要なモジュールファイルを作成する:${NC}"
      echo "   - src/utils/dynamoDbClient.js を作成する"
      echo "   - testUtils/environment.js を作成する"
      echo -e "2. ${GREEN}テストファイルの参照パスを修正する:${NC}"
      echo "   - 不足しているモジュールを確認: ${RED}モジュールが見つかりません${NC}"
      echo -e "3. ${GREEN}必要なテストをスキップする:${NC}"
      echo "   - テストファイルの先頭で describe.skip または test.skip を使用"
      ;;
      
    suite_failure)
      print_error "テストスイート失敗: $FAILURE_MESSAGE"
      
      # テスト概要を表示
      print_test_summary "$OUTPUT_LOG_FILE"
      
      # モジュールが見つからないエラーを抽出
      extract_module_not_found_errors "$OUTPUT_LOG_FILE"
      
      # 次のアクション
      echo -e "\n${BLUE}次のアクション:${NC}"
      echo -e "1. ${GREEN}失敗しているテストスイートを修正する:${NC}"
      echo "   - FAIL __tests__/unit/utils/dynamoDbClient.test.js"
      echo "   - FAIL __tests__/e2e/authenticatedDataAccess.test.js"
      echo "   - FAIL __tests__/unit/utils/budgetCheck.test.js"
      echo "   - FAIL __tests__/unit/function/marketData.test.js"
      echo -e "2. ${GREEN}必要なモジュールをモック化する:${NC}"
      echo "   - jest.mock('../../../src/utils/dynamoDbClient', () => ({}))"
      echo -e "3. ${GREEN}実行可能なテストのみ実行する:${NC}"
      echo "   ./scripts/run-tests.sh -s \"e2e\" -i $TEST_TYPE"
      ;;
      
    coverage_issue)
      print_error "カバレッジ不足: $FAILURE_MESSAGE"
      
      # カバレッジ情報を表示
      if [ -f "./test-results/detailed-results.json" ]; then
        # カバレッジ情報を取得
        coverage_info=($(get_coverage_info))
        
        # 現在のカバレッジ状況
        echo -e "${YELLOW}現在のカバレッジ状況:${NC}"
        echo -e "- Statements: ${RED}${coverage_info[0]}%${NC} (目標: ${coverage_info[4]}%)"
        echo -e "- Branches:   ${RED}${coverage_info[1]}%${NC} (目標: ${coverage_info[5]}%)"
        echo -e "- Functions:  ${RED}${coverage_info[2]}%${NC} (目標: ${coverage_info[6]}%)"
        echo -e "- Lines:      ${RED}${coverage_info[3]}%${NC} (目標: ${coverage_info[7]}%)"
      else
        echo -e "${YELLOW}カバレッジ情報が利用できません。${NC}"
      fi
      
      # Jest設定ファイルの内容を表示
      if [ -f "$JEST_CONFIG_PATH" ]; then
        echo -e "\n${YELLOW}Jest設定ファイルのカバレッジ閾値:${NC}"
        grep -A 15 "coverageThreshold" "$JEST_CONFIG_PATH" 2>/dev/null || echo "カバレッジ閾値が設定されていません"
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
      
    syntax_error)
      print_error "構文エラー: $FAILURE_MESSAGE"
      echo -e "${RED}スクリプトまたはテストコードに構文エラーがあります。${NC}"
      
      # エラーメッセージの抽出
      if grep -A 5 "Parse error\|SyntaxError" "$OUTPUT_LOG_FILE"; then
        echo -e "\n${YELLOW}構文エラーの詳細:${NC}"
        grep -A 5 "Parse error\|SyntaxError" "$OUTPUT_LOG_FILE" | head -n 6
      fi
      
      # 次のアクション
      echo -e "\n${BLUE}次のアクション:${NC}"
      echo -e "1. ${GREEN}エラーログを確認して構文エラーを修正する:${NC}"
      echo "   cat $OUTPUT_LOG_FILE"
      echo -e "2. ${GREEN}構文チェックのみを実行する:${NC}"
      echo "   npx eslint \"**/*.js\""
      ;;
      
    execution_error)
      print_error "実行エラー: $FAILURE_MESSAGE"
      echo -e "${RED}テスト実行中にシステムエラーが発生しました。${NC}"
      
      # 最後のエラーメッセージを抽出
      if tail -n 20 "$OUTPUT_LOG_FILE" | grep -q "error"; then
        echo -e "\n${YELLOW}エラーメッセージ:${NC}"
        tail -n 20 "$OUTPUT_LOG_FILE" | grep -A 3 "error" | head -n 4
      fi
      
      # 次のアクション
      echo -e "\n${BLUE}次のアクション:${NC}"
      echo -e "1. ${GREEN}環境をクリーンアップして再実行する:${NC}"
      echo "   ./scripts/run-tests.sh -c $TEST_TYPE"
      echo -e "2. ${GREEN}モックモードで実行する:${NC}"
      echo "   ./scripts/run-tests.sh -m $TEST_TYPE"
      echo -e "3. ${GREEN}デバッグログを確認する:${NC}"
      echo "   ./scripts/run-tests.sh -d $TEST_TYPE"
      ;;
      
    data_mismatch)
      print_error "データ不一致: $FAILURE_MESSAGE"
      echo -e "${RED}Jestの出力と結果JSONファイルの間に不一致があります。${NC}"
      
      # Jestの出力
      if grep -q "Tests:" "$OUTPUT_LOG_FILE"; then
        echo -e "\n${YELLOW}Jestの出力:${NC}"
        grep "Tests:" "$OUTPUT_LOG_FILE" | tail -n1
      fi
      
      # JSONデータ
      if [ -f "./test-results/detailed-results.json" ]; then
        echo -e "\n${YELLOW}JSON結果データ:${NC}"
        grep -o '"numTotalTests":[0-9]*,"numFailedTests":[0-9]*,"numPassedTests":[0-9]*' "./test-results/detailed-results.json" || echo "データが見つかりません"
      fi
      
      # 次のアクション
      echo -e "\n${BLUE}次のアクション:${NC}"
      echo -e "1. ${GREEN}テスト環境をリセットして再実行する:${NC}"
      echo "   ./scripts/run-tests.sh -c $TEST_TYPE"
      echo -e "2. ${GREEN}カスタムレポーターを無効化して実行する:${NC}"
      echo "   ./scripts/run-tests.sh --config custom-jest.config.js $TEST_TYPE"
      ;;
      
    data_missing)
      print_error "データ欠落: $FAILURE_MESSAGE"
      echo -e "${RED}テスト結果ファイルが生成されていません。${NC}"
      
      # 次のアクション
      echo -e "\n${BLUE}次のアクション:${NC}"
      echo -e "1. ${GREEN}テスト結果ディレクトリを確認:${NC}"
      echo "   ls -la ./test-results/"
      echo -e "2. ${GREEN}カスタムレポーターの動作を確認:${NC}"
      echo "   cat ./custom-reporter.js"
      echo -e "3. ${GREEN}シンプルな設定で再実行:${NC}"
      echo "   npx jest --no-coverage"
      ;;
      
    *)
      print_error "不明なエラー"
      echo -e "${RED}原因不明のエラーが発生しました。デバッグモードで追加情報を確認してください。${NC}"
      
      # エラーログから抽出
      if tail -n 20 "$OUTPUT_LOG_FILE" | grep -q "error\|Error\|failed"; then
        echo -e "\n${YELLOW}エラーメッセージ:${NC}"
        tail -n 20 "$OUTPUT_LOG_FILE" | grep -A 2 "error\|Error\|failed" | head -n 3
      fi
      
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
fi

# テスト後のクリーンアップ提案
if [ "$FAILURE_TYPE" = "success" ] && [ $CLEAN -ne 1 ]; then
  print_info "次回のテスト実行前に環境をクリーンアップすることをお勧めします:"
  echo "  ./scripts/run-tests.sh -c ..."
fi

exit $TEST_RESULT
