# ポートフォリオマネージャー マーケットデータAPI利用ガイド

このドキュメントは、フロントエンドエンジニア向けにマーケットデータAPIの利用方法を説明するものです。APIの基本的な使い方からエラーハンドリングまでをカバーしています。

## 1. APIの概要

このAPIは株式や投資信託などの市場データを取得するためのものです。米国株、日本株、投資信託、為替レートなど様々な金融商品の最新価格データを提供します。

**主な機能：**
- 米国株式データ取得
- 日本株式データ取得
- 投資信託データ取得
- 為替レート取得
- データキャッシング
- 使用量制限

## 2. 環境とエンドポイント

### 2.1 環境別URL

**開発環境（ローカル）**
```
http://localhost:3000/dev/api/market-data
```

**開発環境（AWS）**
```
https://[dev-api-id].execute-api.ap-northeast-1.amazonaws.com/dev/api/market-data
```

**本番環境**
```
https://[prod-api-id].execute-api.ap-northeast-1.amazonaws.com/prod/api/market-data
```

※実際の`[dev-api-id]`と`[prod-api-id]`は、システム管理者にお問い合わせください。

### 2.2 管理者用エンドポイント

APIステータス確認や使用量リセットなどの管理者機能も提供しています。

```
https://[api-id].execute-api.ap-northeast-1.amazonaws.com/[stage]/admin/status
https://[api-id].execute-api.ap-northeast-1.amazonaws.com/[stage]/admin/reset
```

## 3. リクエスト方法

### 3.1 基本的なリクエスト形式

APIはHTTP GETリクエストで呼び出します。URLパラメータで取得対象を指定します。

**必須パラメータ：**
- `type`: データタイプ（`us-stock`, `jp-stock`, `mutual-fund`, `exchange-rate`のいずれか）
- `symbols`: 銘柄コードまたは通貨ペア（カンマ区切りで複数指定可能）

**オプションパラメータ：**
- `base`: 為替レートのベース通貨（デフォルト: `USD`）
- `target`: 為替レートの対象通貨（デフォルト: `JPY`）
- `refresh`: キャッシュを無視して最新データを取得する場合は`true`（デフォルト: `false`）

### 3.2 リクエスト例

#### 米国株データの取得
```javascript
// Axiosを使用した例
const fetchUSStocks = async (symbols) => {
  try {
    const response = await axios.get('https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/api/market-data', {
      params: {
        type: 'us-stock',
        symbols: symbols.join(',') // 例: 'AAPL,MSFT,GOOGL'
      }
    });
    return response.data;
  } catch (error) {
    console.error('API呼び出しエラー:', error);
    // エラーハンドリング
    return null;
  }
};
```

#### 日本株データの取得
```javascript
const fetchJPStocks = async (symbols) => {
  try {
    const response = await axios.get('https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/api/market-data', {
      params: {
        type: 'jp-stock',
        symbols: symbols.join(',') // 例: '7203,9984,6758'
      }
    });
    return response.data;
  } catch (error) {
    console.error('API呼び出しエラー:', error);
    return null;
  }
};
```

#### 投資信託データの取得
```javascript
const fetchMutualFunds = async (symbols) => {
  try {
    const response = await axios.get('https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/api/market-data', {
      params: {
        type: 'mutual-fund',
        symbols: symbols.join(',') // 例: '2931113C,0131103C'
      }
    });
    return response.data;
  } catch (error) {
    console.error('API呼び出しエラー:', error);
    return null;
  }
};
```

#### 為替レートの取得
```javascript
const fetchExchangeRate = async (base = 'USD', target = 'JPY') => {
  try {
    const response = await axios.get('https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/api/market-data', {
      params: {
        type: 'exchange-rate',
        base,
        target
      }
    });
    return response.data;
  } catch (error) {
    console.error('API呼び出しエラー:', error);
    return null;
  }
};
```

### 3.3 銘柄コードの形式

各市場の銘柄コードの形式は以下の通りです：

- **米国株**: アルファベット記号（例: `AAPL`, `MSFT`, `GOOGL`）
- **日本株**: 4桁の数字、オプションでサフィックス `.T`（例: `7203`, `9984`, `7203.T`）
- **投資信託**: 7-8桁の数字 + `C`、オプションでサフィックス `.T`（例: `2931113C`, `0131103C.T`）

## 4. レスポンス形式

### 4.1 成功時のレスポンス

```json
{
  "success": true,
  "data": {
    "AAPL": {
      "ticker": "AAPL",
      "price": 174.79,
      "name": "Apple Inc.",
      "currency": "USD",
      "lastUpdated": "2025-05-11T12:34:56.789Z",
      "source": "AlpacaAPI",
      "isStock": true,
      "isMutualFund": false
    },
    "MSFT": {
      "ticker": "MSFT",
      "price": 296.45,
      "name": "Microsoft Corporation",
      "currency": "USD",
      "lastUpdated": "2025-05-11T12:34:56.789Z",
      "source": "AlpacaAPI",
      "isStock": true,
      "isMutualFund": false
    }
  },
  "source": "AWS Lambda & DynamoDB",
  "lastUpdated": "2025-05-11T12:34:56.789Z",
  "processingTime": "210ms",
  "usage": {
    "daily": 31,
    "monthly": 512,
    "dailyLimit": 5000,
    "monthlyLimit": 100000
  }
}
```

### 4.2 エラー時のレスポンス

```json
{
  "success": false,
  "error": "リクエストパラメータが不正です。",
  "details": "Type パラメータは必須です。",
  "code": "INVALID_PARAMS"
}
```

一般的なエラーコード：
- `INVALID_PARAMS`: パラメータ不正
- `LIMIT_EXCEEDED`: 使用量制限超過
- `SOURCE_ERROR`: データソースからの取得エラー
- `NOT_FOUND`: 指定された銘柄が見つからない
- `SERVER_ERROR`: サーバー内部エラー

## 5. エラーハンドリング

### 5.1 基本的なエラーハンドリング

```javascript
const fetchMarketData = async (type, symbols) => {
  try {
    const response = await axios.get('https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/api/market-data', {
      params: { type, symbols }
    });
    
    if (response.data.success) {
      return response.data.data;
    } else {
      console.error('APIエラー:', response.data.error);
      return null;
    }
  } catch (error) {
    // ネットワークエラーや5xx系エラー
    if (error.response) {
      // サーバーからレスポンスがあった場合
      console.error('APIエラーレスポンス:', error.response.status, error.response.data);
    } else if (error.request) {
      // リクエストは送信されたがレスポンスがない場合
      console.error('APIレスポンスなし:', error.request);
    } else {
      // リクエスト設定エラー
      console.error('APIリクエストエラー:', error.message);
    }
    return null;
  }
};
```

### 5.2 使用量制限の処理

APIには日次と月次の使用量制限があります。制限に達した場合は`429 Too Many Requests`エラーが返されます。

```javascript
const fetchStockData = async (ticker) => {
  try {
    const response = await axios.get('https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/api/market-data', {
      params: { 
        type: 'us-stock', 
        symbols: ticker 
      }
    });
    return response.data;
  } catch (error) {
    // 使用量制限エラーの処理
    if (error.response && error.response.status === 429) {
      console.warn('API使用量制限に達しました。ローカルデータを使用します。');
      
      // クライアント側でフォールバックデータを提供
      return {
        success: true,
        data: {
          [ticker]: {
            ticker: ticker,
            price: 100, // デフォルト値
            name: ticker,
            currency: 'USD',
            lastUpdated: new Date().toISOString(),
            source: 'Client Fallback',
            isStock: true,
            isMutualFund: false
          }
        }
      };
    }
    
    // その他のエラー処理
    console.error('APIエラー:', error);
    throw error;
  }
};
```

### 5.3 オフライン対応

ネットワーク接続がない場合や、APIが利用できない場合のフォールバック処理：

```javascript
const fetchMarketDataWithOfflineSupport = async (type, symbols, cacheDuration = 24 * 60 * 60 * 1000) => {
  // ローカルストレージからキャッシュデータを取得
  const cachedDataStr = localStorage.getItem(`market_data_${type}_${symbols}`);
  let cachedData = null;
  
  if (cachedDataStr) {
    try {
      const parsed = JSON.parse(cachedDataStr);
      // キャッシュが有効期限内かチェック
      if (Date.now() - parsed.timestamp < cacheDuration) {
        cachedData = parsed.data;
      }
    } catch (e) {
      console.warn('キャッシュデータの解析エラー:', e);
    }
  }
  
  // オンラインチェック
  if (!navigator.onLine) {
    console.warn('オフラインモード: キャッシュデータを使用');
    return cachedData || createFallbackData(type, symbols);
  }
  
  try {
    // APIからデータ取得を試みる
    const response = await axios.get('https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/api/market-data', {
      params: { type, symbols },
      timeout: 5000 // タイムアウト設定
    });
    
    if (response.data.success) {
      // 取得したデータをキャッシュに保存
      localStorage.setItem(`market_data_${type}_${symbols}`, JSON.stringify({
        timestamp: Date.now(),
        data: response.data.data
      }));
      return response.data.data;
    } else {
      console.error('APIエラー:', response.data.error);
      return cachedData || createFallbackData(type, symbols);
    }
  } catch (error) {
    console.error('API呼び出しエラー:', error);
    return cachedData || createFallbackData(type, symbols);
  }
};

// フォールバックデータの作成
const createFallbackData = (type, symbols) => {
  const result = {};
  const symbolList = symbols.split(',');
  
  symbolList.forEach(symbol => {
    const isJapaneseStock = /^\d{4}(\.T)?$/.test(symbol);
    const isMutualFund = /^\d{7,8}C(\.T)?$/.test(symbol);
    
    result[symbol] = {
      ticker: symbol,
      price: isJapaneseStock ? 2500 : isMutualFund ? 10000 : 100, // デフォルト値
      name: `${symbol} (Offline Data)`,
      currency: isJapaneseStock || isMutualFund ? 'JPY' : 'USD',
      lastUpdated: new Date().toISOString(),
      source: 'Client Fallback',
      isStock: !isMutualFund,
      isMutualFund: isMutualFund
    };
  });
  
  return result;
};
```

## 6. ローカル開発環境での利用

### 6.1 Serverless Offlineへの接続

ローカル開発時は、Serverless Frameworkが提供するローカルサーバーに接続します。

```javascript
// 環境変数に基づいてAPIエンドポイントを切り替え
const getApiEndpoint = () => {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000/dev/api/market-data';
  } else if (process.env.NODE_ENV === 'staging') {
    return 'https://[dev-api-id].execute-api.ap-northeast-1.amazonaws.com/dev/api/market-data';
  } else {
    return 'https://[prod-api-id].execute-api.ap-northeast-1.amazonaws.com/prod/api/market-data';
  }
};

const fetchMarketData = async (type, symbols) => {
  try {
    const endpoint = getApiEndpoint();
    const response = await axios.get(endpoint, {
      params: { type, symbols }
    });
    return response.data;
  } catch (error) {
    console.error('API呼び出しエラー:', error);
    return null;
  }
};
```

### 6.2 CORS対応

ローカル開発環境でCORSエラーが発生する場合の対処法：

1. **Reactアプリの場合（package.jsonに追加）**
```json
"proxy": "http://localhost:3000"
```

2. **その他のフレームワークの場合**
```javascript
// APIリクエスト関数内でCORSプロキシを使用
const fetchWithCorsProxy = async (url, params) => {
  // 開発環境のみCORSプロキシを使用
  if (process.env.NODE_ENV === 'development') {
    const corsProxy = 'http://localhost:8080/proxy?url=';
    const encodedUrl = encodeURIComponent(`${url}?${new URLSearchParams(params).toString()}`);
    const response = await axios.get(`${corsProxy}${encodedUrl}`);
    return response.data;
  } else {
    // 本番環境では通常のリクエスト
    const response = await axios.get(url, { params });
    return response.data;
  }
};
```

## 7. React用ユーティリティフック

### 7.1 useMarketData カスタムフック

```javascript
import { useState, useEffect } from 'react';
import axios from 'axios';

export const useMarketData = (type, symbols, refreshInterval = 0) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    let isMounted = true;
    let intervalId = null;
    
    const fetchData = async () => {
      if (!symbols) return;
      
      try {
        setLoading(true);
        
        const endpoint = process.env.NODE_ENV === 'development'
          ? 'http://localhost:3000/dev/api/market-data'
          : 'https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/api/market-data';
        
        const response = await axios.get(endpoint, {
          params: { type, symbols }
        });
        
        if (isMounted) {
          if (response.data.success) {
            setData(response.data.data);
            setError(null);
          } else {
            setError(response.data.error || '不明なエラー');
          }
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'APIエラー');
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    // 定期的な更新が必要な場合
    if (refreshInterval > 0) {
      intervalId = setInterval(fetchData, refreshInterval);
    }
    
    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [type, symbols, refreshInterval]);
  
  return { data, loading, error, refetch: async () => await fetchData() };
};
```

### 7.2 使用例

```jsx
import React from 'react';
import { useMarketData } from './hooks/useMarketData';

const StockDisplay = ({ symbols }) => {
  const { data, loading, error } = useMarketData('us-stock', symbols.join(','), 60000);
  
  if (loading) return <div>データを読み込み中...</div>;
  if (error) return <div>エラー: {error}</div>;
  if (!data) return <div>データがありません</div>;
  
  return (
    <div>
      <h2>株価情報</h2>
      <table>
        <thead>
          <tr>
            <th>銘柄</th>
            <th>企業名</th>
            <th>価格</th>
            <th>通貨</th>
            <th>最終更新</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(data).map(stock => (
            <tr key={stock.ticker}>
              <td>{stock.ticker}</td>
              <td>{stock.name}</td>
              <td>{stock.price.toLocaleString()}</td>
              <td>{stock.currency}</td>
              <td>{new Date(stock.lastUpdated).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StockDisplay;
```

## 8. よくある問題と解決策

### 8.1 CORS問題

**問題**: APIを呼び出すとCORSエラーが発生する

**解決策**:
- ローカル開発では、上記のプロキシ設定を行う
- 本番環境では、API側でプロパーなCORS設定がされていることを確認する
- API開発者に連絡して、フロントエンドアプリケーションのオリジンをCORS許可リストに追加してもらう

### 8.2 使用量制限

**問題**: 頻繁にAPIを呼び出していると使用量制限に達してしまう

**解決策**:
- データの更新頻度を下げる（例：1分ごと→5分ごと）
- ローカルキャッシュを活用してAPI呼び出し回数を減らす
- 複数の銘柄を一度のリクエストでバッチ処理する
- リフレッシュパラメータ（`refresh=true`）の使用を最小限に抑える

### 8.3 データ鮮度

**問題**: キャッシュされたデータが古い可能性がある

**解決策**:
- 重要な取引前に`refresh=true`パラメータを使用して最新データを取得
- レスポンスの`lastUpdated`タイムスタンプを確認し、古すぎる場合は警告表示
- `usage`情報をモニタリングし、制限に近づいている場合は更新頻度を下げる

### 8.4 ネットワークエラー

**問題**: モバイルデバイスやネットワーク状況の悪い環境での接続エラー

**解決策**:
- Section 5.3で紹介したオフラインサポート機能を実装
- リトライロジックを実装（指数バックオフとジッターを使用）
- ユーザーにエラーとデータの鮮度を通知

```javascript
// リトライロジックの例
const fetchWithRetry = async (url, params, maxRetries = 3, initialDelay = 1000) => {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      return await axios.get(url, { params });
    } catch (error) {
      if (retries === maxRetries - 1) throw error;
      
      // 500番台のエラーやネットワークエラーのみリトライ
      if (!error.response || (error.response && error.response.status >= 500)) {
        // 指数バックオフ + ジッター
        const delay = initialDelay * Math.pow(2, retries) * (0.9 + Math.random() * 0.2);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
      } else {
        throw error; // 400番台エラーはすぐに失敗
      }
    }
  }
};
```

## 9. 高度な使用方法

### 9.1 複数タイプのデータ同時取得

```javascript
const fetchMultipleMarketData = async () => {
  try {
    // 並列リクエストでパフォーマンス向上
    const [usStocksResponse, jpStocksResponse, exchangeRateResponse] = await Promise.all([
      axios.get('https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/api/market-data', {
        params: { type: 'us-stock', symbols: 'AAPL,MSFT,GOOGL' }
      }),
      axios.get('https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/api/market-data', {
        params: { type: 'jp-stock', symbols: '7203,9984,6758' }
      }),
      axios.get('https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/api/market-data', {
        params: { type: 'exchange-rate', base: 'USD', target: 'JPY' }
      })
    ]);
    
    // 結果の結合と処理
    return {
      usStocks: usStocksResponse.data.success ? usStocksResponse.data.data : {},
      jpStocks: jpStocksResponse.data.success ? jpStocksResponse.data.data : {},
      exchangeRate: exchangeRateResponse.data.success ? exchangeRateResponse.data.data : {}
    };
  } catch (error) {
    console.error('マーケットデータ取得エラー:', error);
    return { usStocks: {}, jpStocks: {}, exchangeRate: {} };
  }
};
```

### 9.2 応用例：ポートフォリオ評価

```javascript
const evaluatePortfolio = async (holdings) => {
  try {
    // 保有銘柄データの取得
    const stockSymbols = holdings
      .filter(h => h.type === 'stock')
      .map(h => h.symbol)
      .join(',');
    
    const fundSymbols = holdings
      .filter(h => h.type === 'fund')
      .map(h => h.symbol)
      .join(',');
    
    // 並列でデータを取得
    const [stocksResponse, fundsResponse, rateResponse] = await Promise.all([
      stockSymbols ? axios.get('https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/api/market-data', {
        params: { type: 'us-stock', symbols: stockSymbols }
      }) : Promise.resolve({ data: { success: true, data: {} } }),
      
      fundSymbols ? axios.get('https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/api/market-data', {
        params: { type: 'mutual-fund', symbols: fundSymbols }
      }) : Promise.resolve({ data: { success: true, data: {} } }),
      
      axios.get('https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/api/market-data', {
        params: { type: 'exchange-rate', base: 'USD', target: 'JPY' }
      })
    ]);
    
    // レスポンスの有効性チェック
    if (!stocksResponse.data.success || !fundsResponse.data.success || !rateResponse.data.success) {
      throw new Error('データ取得エラー');
    }
    
    // 為替レートの取得
    const usdJpy = rateResponse.data.data.USDJPY ? rateResponse.data.data.USDJPY.rate : 150.0;
    
    // すべてのデータを結合
    const marketData = {
      ...stocksResponse.data.data,
      ...fundsResponse.data.data
    };
    
    // ポートフォリオの評価
    const evaluatedHoldings = holdings.map(holding => {
      const marketInfo = marketData[holding.symbol] || null;
      
      if (!marketInfo) {
        return {
          ...holding,
          currentPrice: null,
          currentValue: null,
          isDataAvailable: false
        };
      }
      
      // 通貨変換が必要か
      const needsCurrencyConversion = holding.currency !== 'JPY' && marketInfo.currency === 'JPY';
      const currentPrice = marketInfo.price;
      
      // 現在価値の計算
      let currentValue = holding.quantity * currentPrice;
      
      // 必要に応じて通貨変換
      if (needsCurrencyConversion) {
        currentValue = currentValue / usdJpy;
      }
      
      return {
        ...holding,
        currentPrice,
        currentValue,
        lastUpdated: marketInfo.lastUpdated,
        isDataAvailable: true
      };
    });
    
    // 合計値の計算
    const totalValue = evaluatedHoldings.reduce((sum, holding) => {
      return sum + (holding.currentValue || 0);
    }, 0);
    
    return {
      holdings: evaluatedHoldings,
      totalValue,
      usdJpy,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('ポートフォリオ評価エラー:', error);
    throw error;
  }
};
```

## 10. API使用のベストプラクティス

1. **バッチ処理で呼び出し回数を減らす**
   - 個別リクエストではなく、カンマ区切りで複数銘柄を指定

2. **適切なキャッシュ戦略を実装する**
   - 一定期間内は同じデータをキャッシュ
   - サードパーティのキャッシュライブラリを検討（react-query, SWRなど）

3. **エラー処理を丁寧に行う**
   - ユーザーにわかりやすいエラーメッセージを表示
   - 適切なフォールバック処理を実装

4. **パフォーマンスの最適化**
   - 必要なときだけデータを更新
   - 銘柄ごとに更新頻度を調整（頻繁に変動する銘柄vs安定している銘柄）

5. **使用量モニタリング**
   - レスポンスの`usage`オブジェクトをモニタリング
   - 制限に近づいている場合はアラートを表示

---

このガイドはポートフォリオマネージャーマーケットデータAPIの基本的な使用方法を説明しています。より詳細な情報やサポートが必要な場合は、APIの開発者に問い合わせてください。
