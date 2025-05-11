# ポートフォリオマネージャー マーケットデータAPI利用ガイド

このドキュメントは、フロントエンドエンジニア向けにマーケットデータAPIの利用方法を説明するものです。APIの基本的な使い方からエラーハンドリングまでをカバーしています。

## 1. APIの概要

このAPIは株式や投資信託などの市場データを取得するためのものです。米国株、日本株、投資信託、為替レートなど様々な金融商品の最新価格データを提供します。また、Google認証によるユーザー認証およびGoogle Driveとの連携機能も備えています。

**主な機能：**
- 米国株式データ取得
- 日本株式データ取得
- 投資信託データ取得
- 為替レート取得
- データキャッシング
- 使用量制限
- Google認証（新機能）
- Google Driveデータ同期（新機能）

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

### 2.2 認証エンドポイント（新機能）

```
# Google認証処理
https://[api-id].execute-api.ap-northeast-1.amazonaws.com/[stage]/auth/google/login

# セッション情報取得
https://[api-id].execute-api.ap-northeast-1.amazonaws.com/[stage]/auth/session

# ログアウト処理
https://[api-id].execute-api.ap-northeast-1.amazonaws.com/[stage]/auth/logout
```

### 2.3 Google Drive連携エンドポイント（新機能）

```
# ポートフォリオデータの保存
https://[api-id].execute-api.ap-northeast-1.amazonaws.com/[stage]/drive/save

# ポートフォリオデータの読み込み
https://[api-id].execute-api.ap-northeast-1.amazonaws.com/[stage]/drive/load

# ファイル一覧の取得
https://[api-id].execute-api.ap-northeast-1.amazonaws.com/[stage]/drive/files
```

### 2.4 管理者用エンドポイント

APIステータス確認や使用量リセットなどの管理者機能も提供しています。

```
https://[api-id].execute-api.ap-northeast-1.amazonaws.com/[stage]/admin/status
https://[api-id].execute-api.ap-northeast-1.amazonaws.com/[stage]/admin/reset
```

## 3. マーケットデータ取得API

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

## 4. 認証API（新機能）

### 4.1 Google認証プロセス

#### 4.1.1 Google認証の初期化と設定

```javascript
// Google認証の初期化（React向け例）
// npm install @react-oauth/google
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

const App = () => {
  return (
    <GoogleOAuthProvider clientId="YOUR_GOOGLE_CLIENT_ID">
      {/* アプリケーションコンポーネント */}
      <LoginComponent />
    </GoogleOAuthProvider>
  );
};

const LoginComponent = () => {
  const handleGoogleLogin = async (credentialResponse) => {
    try {
      // バックエンドに認証コードを送信
      const response = await axios.post(
        'https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/auth/google/login',
        {
          code: credentialResponse.code,
          redirectUri: window.location.origin + '/auth/callback'
        },
        {
          withCredentials: true // Cookieを送受信するために必要
        }
      );
      
      if (response.data.success) {
        // ログイン成功処理
        console.log('認証成功:', response.data.user);
        // ユーザー情報の保存やリダイレクト処理
      }
    } catch (error) {
      console.error('Google認証エラー:', error);
    }
  };
  
  return (
    <div>
      <h2>Googleアカウントでログイン</h2>
      <GoogleLogin
        flow="auth-code" // 重要: フローを設定
        onSuccess={handleGoogleLogin}
        onError={() => console.error('ログイン失敗')}
        useOneTap
      />
    </div>
  );
};
```

#### 4.1.2 セッション確認

```javascript
const checkSession = async () => {
  try {
    const response = await axios.get(
      'https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/auth/session',
      { withCredentials: true }
    );
    
    if (response.data.success && response.data.isAuthenticated) {
      console.log('認証済みユーザー:', response.data.user);
      return response.data.user;
    } else {
      console.log('未認証状態');
      return null;
    }
  } catch (error) {
    console.error('セッション確認エラー:', error);
    return null;
  }
};
```

#### 4.1.3 ログアウト処理

```javascript
const handleLogout = async () => {
  try {
    const response = await axios.post(
      'https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/auth/logout',
      {},
      { withCredentials: true }
    );
    
    if (response.data.success) {
      console.log('ログアウト成功');
      // ログアウト後の処理（ローカルストレージのクリアなど）
      return true;
    }
  } catch (error) {
    console.error('ログアウトエラー:', error);
  }
  return false;
};
```

### 4.2 認証APIレスポンス形式

#### 4.2.1 ログイン成功時

```json
{
  "success": true,
  "isAuthenticated": true,
  "user": {
    "id": "109476395873295845628",
    "email": "user@example.com",
    "name": "サンプルユーザー",
    "picture": "https://lh3.googleusercontent.com/a/..."
  },
  "session": {
    "expiresAt": "2025-05-18T12:34:56.789Z"
  }
}
```

#### 4.2.2 セッション確認時

```json
{
  "success": true,
  "isAuthenticated": true,
  "user": {
    "id": "109476395873295845628",
    "email": "user@example.com",
    "name": "サンプルユーザー",
    "picture": "https://lh3.googleusercontent.com/a/..."
  },
  "session": {
    "expiresAt": "2025-05-18T12:34:56.789Z"
  }
}
```

#### 4.2.3 ログアウト成功時

```json
{
  "success": true,
  "message": "ログアウトしました"
}
```

## 5. Google Drive連携API（新機能）

### 5.1 ポートフォリオデータの保存

```javascript
const savePortfolioToGoogleDrive = async (portfolioData) => {
  try {
    const response = await axios.post(
      'https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/drive/save',
      {
        portfolioData: portfolioData
      },
      { withCredentials: true }
    );
    
    if (response.data.success) {
      console.log('Google Driveに保存成功:', response.data.file);
      return response.data.file;
    }
  } catch (error) {
    console.error('Google Drive保存エラー:', error);
    if (error.response && error.response.status === 401) {
      // 認証エラーの処理（ログイン画面への遷移など）
    }
  }
  return null;
};
```

### 5.2 ポートフォリオデータの読み込み

```javascript
const loadPortfolioFromGoogleDrive = async (fileId) => {
  try {
    const response = await axios.get(
      'https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/drive/load',
      {
        params: { fileId },
        withCredentials: true
      }
    );
    
    if (response.data.success) {
      console.log('Google Driveから読み込み成功:', response.data.file);
      return response.data.data; // ポートフォリオデータ
    }
  } catch (error) {
    console.error('Google Drive読み込みエラー:', error);
    if (error.response && error.response.status === 401) {
      // 認証エラーの処理
    }
  }
  return null;
};
```

### 5.3 ファイル一覧の取得

```javascript
const listGoogleDriveFiles = async () => {
  try {
    const response = await axios.get(
      'https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/drive/files',
      { withCredentials: true }
    );
    
    if (response.data.success) {
      console.log('Google Driveファイル一覧取得成功:', response.data.files);
      return response.data.files;
    }
  } catch (error) {
    console.error('Google Driveファイル一覧取得エラー:', error);
    if (error.response && error.response.status === 401) {
      // 認証エラーの処理
    }
  }
  return [];
};
```

### 5.4 Google Drive連携APIレスポンス形式

#### 5.4.1 ファイル保存成功時

```json
{
  "success": true,
  "message": "ポートフォリオデータをGoogle Driveに保存しました",
  "file": {
    "id": "1Zt8jKX7H3gFzN9v2X5yM6fGhJkLpQr7s",
    "name": "portfolio-data-2025-05-11T12-34-56-789Z.json",
    "url": "https://drive.google.com/file/d/1Zt8jKX7H3gFzN9v2X5yM6fGhJkLpQr7s/view",
    "createdAt": "2025-05-11T12:34:56.789Z"
  }
}
```

#### 5.4.2 ファイル読み込み成功時

```json
{
  "success": true,
  "message": "ポートフォリオデータをGoogle Driveから読み込みました",
  "file": {
    "name": "portfolio-data-2025-05-10T15-22-33-456Z.json",
    "createdAt": "2025-05-10T15:22:33.456Z",
    "modifiedAt": "2025-05-10T15:22:33.456Z"
  },
  "data": {
    "name": "マイポートフォリオ",
    "holdings": [
      {
        "ticker": "AAPL",
        "shares": 10,
        "costBasis": 150.25
      },
      {
        "ticker": "7203.T",
        "shares": 100,
        "costBasis": 2100
      }
    ],
    "createdAt": "2025-05-10T15:22:33.456Z"
  }
}
```

#### 5.4.3 ファイル一覧取得成功時

```json
{
  "success": true,
  "files": [
    {
      "id": "1Zt8jKX7H3gFzN9v2X5yM6fGhJkLpQr7s",
      "name": "portfolio-data-2025-05-11T12-34-56-789Z.json",
      "size": 1024,
      "mimeType": "application/json",
      "createdAt": "2025-05-11T12:34:56.789Z",
      "modifiedAt": "2025-05-11T12:34:56.789Z",
      "webViewLink": "https://drive.google.com/file/d/1Zt8jKX7H3gFzN9v2X5yM6fGhJkLpQr7s/view"
    },
    {
      "id": "2Ab9cDe3F4gHi5J6kLmN7oP8qRsT9uVw",
      "name": "portfolio-data-2025-05-10T15-22-33-456Z.json",
      "size": 980,
      "mimeType": "application/json",
      "createdAt": "2025-05-10T15:22:33.456Z",
      "modifiedAt": "2025-05-10T15:22:33.456Z",
      "webViewLink": "https://drive.google.com/file/d/2Ab9cDe3F4gHi5J6kLmN7oP8qRsT9uVw/view"
    }
  ],
  "count": 2
}
```

## 6. エラーハンドリング

### 6.1 基本的なエラーハンドリング

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

### 6.2 認証エラーの処理

```javascript
const handleApiRequest = async (url, method = 'get', data = null, params = null) => {
  try {
    const config = {
      withCredentials: true
    };
    
    if (params) {
      config.params = params;
    }
    
    let response;
    if (method === 'get') {
      response = await axios.get(url, config);
    } else {
      response = await axios.post(url, data, config);
    }
    
    return response.data;
  } catch (error) {
    // 認証エラー（401）の場合はログイン画面にリダイレクト
    if (error.response && error.response.status === 401) {
      console.error('認証エラー - ログインが必要です');
      
      // ログイン状態をクリア
      localStorage.removeItem('user');
      
      // 未認証状態を通知
      if (typeof onAuthChange === 'function') {
        onAuthChange(false);
      }
      
      // ログインページへリダイレクト
      window.location.href = '/login';
      return { success: false, error: 'ログインが必要です' };
    }
    
    // その他のエラー処理
    console.error('APIエラー:', error);
    return { success: false, error: error.message };
  }
};
```

### 6.3 使用量制限の処理

APIには日次と月次の使用量制限があります。制限に達した場合は`429 Too Many Requests`エラーが返されます。

```javascript
const fetchStockDataWithRateLimitHandling = async (ticker) => {
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

## 7. React用ユーティリティフック

### 7.1 認証フック（新機能）

```javascript
import { useState, useEffect, useContext, createContext } from 'react';
import axios from 'axios';

// 認証コンテキストの作成
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // セッション確認
  const checkSession = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        'https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/auth/session',
        { withCredentials: true }
      );
      
      if (response.data.success && response.data.isAuthenticated) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('セッション確認エラー:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };
  
  // ログアウト処理
  const logout = async () => {
    try {
      await axios.post(
        'https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/auth/logout',
        {},
        { withCredentials: true }
      );
      setUser(null);
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };
  
  // Googleログイン処理
  const loginWithGoogle = async (credentialResponse) => {
    try {
      const response = await axios.post(
        'https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/auth/google/login',
        {
          code: credentialResponse.code,
          redirectUri: window.location.origin + '/auth/callback'
        },
        { withCredentials: true }
      );
      
      if (response.data.success) {
        setUser(response.data.user);
        return true;
      }
    } catch (error) {
      console.error('Google認証エラー:', error);
    }
    return false;
  };
  
  // 初回マウント時にセッション確認
  useEffect(() => {
    checkSession();
  }, []);
  
  // 提供する値
  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    loginWithGoogle,
    logout,
    checkSession
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// カスタムフック
export const useAuth = () => {
  return useContext(AuthContext);
};
```

### 7.2 Google Drive連携フック（新機能）

```javascript
import { useState } from 'react';
import axios from 'axios';
import { useAuth } from './useAuth';

export const useGoogleDrive = () => {
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // ファイル一覧取得
  const listFiles = async () => {
    if (!isAuthenticated) {
      setError('認証が必要です');
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(
        'https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/drive/files',
        { withCredentials: true }
      );
      
      if (response.data.success) {
        return response.data.files;
      } else {
        setError(response.data.message || '不明なエラー');
        return null;
      }
    } catch (error) {
      setError(error.message || 'ファイル一覧取得エラー');
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  // ファイル保存
  const saveFile = async (portfolioData) => {
    if (!isAuthenticated) {
      setError('認証が必要です');
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(
        'https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/drive/save',
        { portfolioData },
        { withCredentials: true }
      );
      
      if (response.data.success) {
        return response.data.file;
      } else {
        setError(response.data.message || '不明なエラー');
        return null;
      }
    } catch (error) {
      setError(error.message || 'ファイル保存エラー');
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  // ファイル読み込み
  const loadFile = async (fileId) => {
    if (!isAuthenticated) {
      setError('認証が必要です');
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(
        'https://[api-id].execute-api.ap-northeast-1.amazonaws.com/prod/drive/load',
        {
          params: { fileId },
          withCredentials: true
        }
      );
      
      if (response.data.success) {
        return response.data.data;
      } else {
        setError(response.data.message || '不明なエラー');
        return null;
      }
    } catch (error) {
      setError(error.message || 'ファイル読み込みエラー');
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  return {
    listFiles,
    saveFile,
    loadFile,
    loading,
    error
  };
};
```

### 7.3 マーケットデータフック

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

## 8. コンポーネント使用例

### 8.1 Google認証ボタンの実装

```jsx
// LoginPage.jsx
import React from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  
  const handleGoogleLoginSuccess = async (credentialResponse) => {
    const success = await loginWithGoogle(credentialResponse);
    if (success) {
      navigate('/dashboard');
    }
  };
  
  return (
    <div className="login-container">
      <h1>ポートフォリオマネージャー</h1>
      <p>Googleアカウントでログインして全ての機能を利用しましょう</p>
      
      <div className="login-buttons">
        <GoogleOAuthProvider clientId="YOUR_GOOGLE_CLIENT_ID">
          <GoogleLogin
            flow="auth-code"
            onSuccess={handleGoogleLoginSuccess}
            onError={() => console.error('ログイン失敗')}
            useOneTap
            shape="pill"
            theme="filled_blue"
            text="continue_with"
          />
        </GoogleOAuthProvider>
      </div>
    </div>
  );
};

export default LoginPage;
```

### 8.2 Google Driveファイル一覧の表示

```jsx
// GoogleDriveFiles.jsx
import React, { useEffect, useState } from 'react';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import { useAuth } from '../hooks/useAuth';

const GoogleDriveFiles = ({ onFileSelect }) => {
  const { isAuthenticated } = useAuth();
  const { listFiles, loadFile, loading, error } = useGoogleDrive();
  const [files, setFiles] = useState([]);
  
  useEffect(() => {
    if (isAuthenticated) {
      fetchFiles();
    }
  }, [isAuthenticated]);
  
  const fetchFiles = async () => {
    const filesList = await listFiles();
    if (filesList) {
      setFiles(filesList);
    }
  };
  
  const handleFileSelect = async (fileId) => {
    const data = await loadFile(fileId);
    if (data && onFileSelect) {
      onFileSelect(data);
    }
  };
  
  if (!isAuthenticated) {
    return <p>ファイル一覧を表示するにはログインしてください</p>;
  }
  
  if (loading) {
    return <p>ファイル一覧を読み込み中...</p>;
  }
  
  if (error) {
    return <p>エラー: {error}</p>;
  }
  
  return (
    <div className="drive-files">
      <h2>Google Driveのポートフォリオデータ</h2>
      {files.length === 0 ? (
        <p>保存されたファイルがありません</p>
      ) : (
        <ul className="file-list">
          {files.map(file => (
            <li key={file.id} className="file-item">
              <div className="file-info">
                <span className="file-name">{file.name}</span>
                <span className="file-date">
                  {new Date(file.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="file-actions">
                <button
                  onClick={() => handleFileSelect(file.id)}
                  className="btn btn-primary"
                >
                  読み込む
                </button>
                <a
                  href={file.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                >
                  表示
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button onClick={fetchFiles} className="btn btn-refresh">
        更新
      </button>
    </div>
  );
};

export default GoogleDriveFiles;
```

### 8.3 ポートフォリオデータ保存ボタン

```jsx
// SavePortfolioButton.jsx
import React, { useState } from 'react';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import { useAuth } from '../hooks/useAuth';

const SavePortfolioButton = ({ portfolioData }) => {
  const { isAuthenticated, user } = useAuth();
  const { saveFile, loading, error } = useGoogleDrive();
  const [saveStatus, setSaveStatus] = useState(null);
  
  const handleSave = async () => {
    if (!isAuthenticated) {
      setSaveStatus({
        success: false,
        message: 'Google Driveに保存するにはログインしてください'
      });
      return;
    }
    
    if (!portfolioData) {
      setSaveStatus({
        success: false,
        message: '保存するデータがありません'
      });
      return;
    }
    
    // タイムスタンプとユーザー情報を追加
    const dataToSave = {
      ...portfolioData,
      lastSaved: new Date().toISOString(),
      savedBy: user ? {
        email: user.email,
        name: user.name
      } : 'unknown'
    };
    
    const result = await saveFile(dataToSave);
    
    if (result) {
      setSaveStatus({
        success: true,
        message: 'ポートフォリオデータをGoogle Driveに保存しました',
        file: result
      });
    } else {
      setSaveStatus({
        success: false,
        message: error || 'Google Driveへの保存に失敗しました'
      });
    }
  };
  
  return (
    <div className="save-portfolio">
      <button
        onClick={handleSave}
        disabled={loading || !isAuthenticated}
        className={`btn ${isAuthenticated ? 'btn-primary' : 'btn-secondary'}`}
      >
        {loading ? '保存中...' : 'Google Driveに保存'}
      </button>
      
      {saveStatus && (
        <div className={`save-status ${saveStatus.success ? 'success' : 'error'}`}>
          <p>{saveStatus.message}</p>
          {saveStatus.success && saveStatus.file && (
            <a
              href={saveStatus.file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="view-file"
            >
              保存したファイルを表示
            </a>
          )}
        </div>
      )}
      
      {!isAuthenticated && (
        <p className="login-prompt">
          Google Driveに保存するには、ログインしてください。
        </p>
      )}
    </div>
  );
};

export default SavePortfolioButton;
```

## 9. CORS対応と認証関連の注意点

### 9.1 CORS設定

認証でCookieを使用するため、APIとフロントエンドのCORS設定が重要です。

```javascript
// axiosのデフォルト設定を変更
axios.defaults.withCredentials = true;

// または個別のリクエストで設定
const response = await axios.get(url, { withCredentials: true });
```

フロントエンドのオリジンがバックエンドのCORS許可リストに含まれていることを確認してください。

### 9.2 Cookieの扱い

- セッションCookieはHTTP Onlyフラグが設定されているため、JavaScriptから直接アクセスできません
- 認証関連の全てのAPIリクエストには `withCredentials: true` を設定してください
- SPAの場合、ルーティングによってCookieのパスが問題になる場合があります（Path: `/`で設定されていることを確認）

### 9.3 セキュリティのベストプラクティス

- Google Client IDは公開情報ですが、クライアントシークレットは厳重に保護してください
- 認証状態の確認は定期的に行い、無効なセッションでのAPI呼び出しを防止してください
- ログイン状態の永続化にはCookieのみを使用し、LocalStorageには機密情報を保存しないでください

## 10. 応用例：認証と市場データの連携

### 10.1 認証済みユーザー向けの拡張機能

```jsx
// PortfolioPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMarketData } from '../hooks/useMarketData';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import GoogleDriveFiles from '../components/GoogleDriveFiles';
import SavePortfolioButton from '../components/SavePortfolioButton';

const PortfolioPage = () => {
  const { isAuthenticated, user } = useAuth();
  const { listFiles, loadFile, saveFile } = useGoogleDrive();
  const [portfolio, setPortfolio] = useState(null);
  const [selectedSymbols, setSelectedSymbols] = useState([]);
  
  // 選択された銘柄の市場データを取得
  const { data: marketData, loading: marketLoading } = useMarketData(
    'us-stock',
    selectedSymbols.join(','),
    isAuthenticated ? 60000 : 300000 // 認証済みユーザーはより頻繁に更新
  );
  
  // ポートフォリオからシンボルを抽出
  useEffect(() => {
    if (portfolio && portfolio.holdings) {
      const symbols = portfolio.holdings.map(holding => holding.ticker);
      setSelectedSymbols(symbols);
    }
  }, [portfolio]);
  
  // ポートフォリオデータの読み込み
  const handleFileSelect = (data) => {
    setPortfolio(data);
  };
  
  // ポートフォリオの現在価値を計算
  const calculatePortfolioValue = () => {
    if (!portfolio || !marketData) return 0;
    
    return portfolio.holdings.reduce((total, holding) => {
      const marketInfo = marketData[holding.ticker];
      if (marketInfo) {
        return total + (holding.shares * marketInfo.price);
      }
      return total;
    }, 0);
  };
  
  return (
    <div className="portfolio-page">
      <h1>マイポートフォリオ</h1>
      
      {isAuthenticated ? (
        <>
          <div className="user-info">
            <img src={user.picture} alt={user.name} className="user-avatar" />
            <span className="user-name">こんにちは、{user.name}さん</span>
          </div>
          
          <div className="portfolio-tools">
            <GoogleDriveFiles onFileSelect={handleFileSelect} />
            
            {portfolio && (
              <>
                <div className="portfolio-summary">
                  <h2>{portfolio.name || 'マイポートフォリオ'}</h2>
                  <p className="portfolio-value">
                    総資産価値: ${calculatePortfolioValue().toLocaleString()}
                  </p>
                  
                  <table className="holdings-table">
                    <thead>
                      <tr>
                        <th>銘柄</th>
                        <th>数量</th>
                        <th>現在価格</th>
                        <th>評価額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.holdings.map(holding => {
                        const marketInfo = marketData && marketData[holding.ticker];
                        return (
                          <tr key={holding.ticker}>
                            <td>{holding.ticker}</td>
                            <td>{holding.shares}</td>
                            <td>
                              {marketInfo ? 
                                `$${marketInfo.price.toLocaleString()}` : 
                                '読み込み中...'}
                            </td>
                            <td>
                              {marketInfo ?
                                `$${(holding.shares * marketInfo.price).toLocaleString()}` :
                                '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                <SavePortfolioButton portfolioData={portfolio} />
              </>
            )}
          </div>
        </>
      ) : (
        <div className="login-prompt">
          <p>ポートフォリオの管理にはログインが必要です。</p>
          <a href="/login" className="btn btn-primary">ログインする</a>
        </div>
      )}
    </div>
  );
};

export default PortfolioPage;
```

---

このガイドはポートフォリオマネージャーマーケットデータAPIの基本的な使用方法を説明しています。より詳細な情報やサポートが必要な場合は、APIの開発者に問い合わせてください。
