/**
 * ファイルパス: scripts/progress-bar.js
 * 
 * コンソール用の進捗表示ユーティリティ
 * テスト実行中の進捗状況を視覚的に表現する
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-21
 */

const readline = require('readline');

// 色の設定
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  clear: '\x1b[2J\x1b[0f', // 画面をクリア
  clearLine: '\r\x1b[K'    // 現在の行をクリア
};

class ProgressBar {
  /**
   * プログレスバーを初期化
   * @param {Object} options オプション
   * @param {number} options.total 合計ステップ数
   * @param {number} options.width バーの幅
   * @param {string} options.format 表示フォーマット
   * @param {boolean} options.clear 完了時に行をクリアするか
   * @param {Object} options.symbols バー表示用のシンボル
   */
  constructor(options = {}) {
    this.total = options.total || 100;
    this.current = 0;
    this.width = options.width || 30;
    this.format = options.format || ':bar :percent :current/:total :elapsed :eta :status';
    this.clear = options.clear !== undefined ? options.clear : false;
    this.symbols = Object.assign({
      complete: '█',
      incomplete: '░',
      head: '',
    }, options.symbols || {});
    
    this.start = Date.now();
    this.status = '';
    this.lastRender = '';
    this.lastRenderTime = 0;
    
    // 最低限の更新頻度を設定（100ms）
    this.minRenderInterval = 100;
  }
  
  /**
   * 進捗を更新
   * @param {number} current 現在の進捗値
   * @param {string} status ステータスメッセージ
   */
  update(current, status = '') {
    if (current !== undefined) {
      this.current = current;
    }
    
    if (this.current > this.total) {
      this.current = this.total;
    }
    
    if (status) {
      this.status = status;
    }
    
    // 最低限の更新頻度を守る
    const now = Date.now();
    if (now - this.lastRenderTime < this.minRenderInterval && this.current < this.total) {
      return;
    }
    
    this.render();
    this.lastRenderTime = now;
  }
  
  /**
   * 進捗を増加
   * @param {number} amount 増加量
   * @param {string} status ステータスメッセージ
   */
  increment(amount = 1, status = '') {
    this.update(this.current + amount, status);
  }
  
  /**
   * プログレスバーを描画
   */
  render() {
    // 経過時間
    const elapsed = (Date.now() - this.start) / 1000;
    
    // 残り時間を計算
    let eta = 0;
    if (this.current > 0) {
      eta = (elapsed / this.current) * (this.total - this.current);
    }
    
    // 完了率
    const percent = Math.floor((this.current / this.total) * 100);
    
    // プログレスバーを生成
    const completeLength = Math.floor((this.current / this.total) * this.width);
    const incompleteLength = this.width - completeLength;
    
    // バーの描画
    const completeSection = colors.green + this.symbols.complete.repeat(completeLength) + colors.reset;
    const incompleteSection = colors.dim + this.symbols.incomplete.repeat(incompleteLength) + colors.reset;
    const bar = completeSection + incompleteSection;
    
    // フォーマットプレースホルダを置換
    const output = this.format
      .replace(':bar', bar)
      .replace(':percent', `${colors.bold}${percent}%${colors.reset}`)
      .replace(':current', `${colors.bold}${this.current}${colors.reset}`)
      .replace(':total', this.total)
      .replace(':elapsed', `${elapsed.toFixed(1)}s`)
      .replace(':eta', `${eta.toFixed(1)}s`)
      .replace(':status', this.status);
    
    // 前回と同じ内容なら描画をスキップ
    if (output === this.lastRender) {
      return;
    }
    
    // コンソールに出力
    process.stdout.write(`${colors.clearLine}${output}`);
    
    // 完了したら改行
    if (this.current >= this.total) {
      if (this.clear) {
        process.stdout.write(colors.clearLine);
      } else {
        process.stdout.write('\n');
      }
    }
    
    this.lastRender = output;
  }
  
  /**
   * プログレスバーを完了状態にする
   * @param {string} status 完了ステータスメッセージ
   */
  complete(status = 'Completed') {
    this.update(this.total, status);
  }
}

module.exports = ProgressBar;
