# ポートフォリオマーケットデータAPI 統合ガイド

この統合ガイドは、フロントエンド開発者向けにマーケットデータAPIの実装方法、特にGoogle認証とGoogle Drive連携機能の活用方法について説明します。

## 目次

1. [API概要](#1-api概要)
2. [認証フロー](#2-認証フロー)
3. [マーケットデータの取得](#3-マーケットデータの取得)
4. [Google Drive連携](#4-google-drive連携)
5. [エラーハンドリング](#5-エラーハンドリング)
6. [React用カスタムフック](#6-react用カスタムフック)
7. [実装例](#7-実装例)
8. [ベストプラクティス](#8-ベストプラクティス)

## 1. API概要

ポートフォリオマーケットデータAPIは、以下の機能を提供します：

- 米国株、日本株、投資信託、為替レートのリアルタイムデータ取得
- Google OAuth 2.0認証と安全なセッション管理
- ポートフォリオデータのGoogle Drive保存・読込・一覧機能
- データキャッシング機能と使用量制限

### 1.1 API構成

API構成は以下のモジュールから成り立っています：

```
フロントエンド → API Gateway → Lambda関数 → 外部データソース/Google API
                                   ↓    ↑
                              DynamoDB (キャッシュとセッション)
```

### 1.2 主要なエンドポイント

```
# マーケットデータ取得
/api/market-data

# Google認証
/auth/google/login  # ログイン処理
/auth/session       # セッション情報取得
/auth/logout        # ログアウト処理

# Google Drive連携
/drive/save         # ポートフォリオデータ保存
/drive/load         # ポートフォリオデータ読込
/drive/files        # ファイル一覧取得
```

## 2. 認証フロー

### 2.1 認証フローの概要

1. フロントエンドでGoogleログインボタンを表示
2. ユーザーがボタンをクリックすると、Googleの認証画面が表示される
3. 認証後、GoogleからAuthorizationコードが返される
4. そのコードをバックエンドに送信
5. バックエンドでコードを使ってアクセストークンを取得
6. セッションを作成し、セキュアなCookieに保存
7. ユーザー情報をフロントエンドに返す

### 2.2 Google OAuth設定

1. Google Cloud Consoleで認証情報を設定
2. 必要スコープ: `email`, `profile`, `https://www.googleapis.com/auth/drive.file`
3. リダイレクトURIを設定（例: `https://yourdomain.com/auth/callback` または `http://localhost:3000/auth/callback`）

### 2.3 ログイン実装

```javascript
// Google認証ボタンの実装（React + @react-oauth/google）
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

const LoginPage = () => {
  const handleGoogleLoginSuccess = async (credentialResponse) => {
    try {
      const response = await axios.post(
        'https://[api-id].execute-api.region.amazonaws.com/[stage]/auth/google/login',
        {
          code: credentialResponse.code,
          redirectUri: window.location.origin + '/auth/callback'
        },
        { withCredentials: true } // Cookieを送受信するために必要
      );
      
      if (response.data.success) {
        // ユーザー情報をステートに保存
        setUser(response.data.user);
        setIsAuthenticated(true);
        // ダッシュボードなどにリダイレクト
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('認証エラー:', error);
    }
  };
  
  return (
    <div className="login-container">
      <h1>ポートフォリオマネージャー</h1>
      <GoogleOAuthProvider clientId="YOUR_GOOGLE_CLIENT_ID">
        <GoogleLogin
          flow="auth-code" // 重要: コードフローを指定
          onSuccess={handleGoogleLoginSuccess}
          onError={() => console.error('ログイン失敗')}
          useOneTap
          shape="pill"
          text="continue_with"
        />
      </GoogleOAuthProvider>
    </div>
  );
};
```

### 2.4 セッション確認

```javascript
// ページロード時やルート変更時にセッションを確認
const checkSession = async () => {
  try {
    const response = await axios.get(
      'https://[api-id].execute-api.region.amazonaws.com/[stage]/auth/session',
      { withCredentials: true } // Cookieを送信するために必要
    );
    
    if (response.data.success && response.data.isAuthenticated) {
      setUser(response.data.user);
      setIsAuthenticated(true);
      return true;
    } else {
      setUser(null);
      setIsAuthenticated(false);
      return false;
    }
  } catch (error) {
    console.error('セッション確認エラー:', error);
    setUser(null);
    setIsAuthenticated(false);
    return false;
  }
};
```

### 2.5 ログアウト

```javascript
const handleLogout = async () => {
  try {
    await axios.post(
      'https://[api-id].execute-api.region.amazonaws.com/[stage]/auth/logout',
      {},
      { withCredentials: true } // Cookieを送信するために必要
    );
    
    setUser(null);
    setIsAuthenticated(false);
    navigate('/login');
  } catch (error) {
    console.error('ログアウトエラー:', error);
  }
};
```

## 3. マーケットデータの取得

### 3.1 基本的なデータ取得

```javascript
const fetchMarketData = async (type, symbols) => {
  try {
    const response = await axios.get(
      'https://[api-id].execute-api.region.amazonaws.com/[stage]/api/market-data',
      {
        params: {
          type, // 'us-stock', 'jp-stock', 'mutual-fund', 'exchange-rate'
          symbols: Array.isArray(symbols) ? symbols.join(',') : symbols
        }
      }
    );
    
    if (response.data.success) {
      return response.data.data;
    } else {
      console.error('APIエラー:', response.data.error);
      return null;
    }
  } catch (error) {
    console.error('API呼び出しエラー:', error);
    return null;
  }
};

// 使用例
const getAppleStock = async () => {
  const data = await fetchMarketData('us-stock', 'AAPL');
  console.log(data);
};

const getMultipleStocks = async () => {
  const data = await fetchMarketData('us-stock', ['AAPL', 'MSFT', 'GOOGL']);
  console.log(data);
};

const getExchangeRate = async () => {
  const data = await fetchMarketData('exchange-rate', 'USD-JPY');
  console.log(data);
};
```

### 3.2 リアルタイム更新

```javascript
const subscribeToMarketData = (type, symbols, callback, intervalMs = 60000) => {
  let intervalId = null;
  
  const fetchAndUpdate = async () => {
    const data = await fetchMarketData(type, symbols);
    if (data) {
      callback(data);
    }
  };
  
  // 初回実行
  fetchAndUpdate();
  
  // 定期的に更新
  intervalId = setInterval(fetchAndUpdate, intervalMs);
  
  // クリーンアップ関数を返す
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
};

// React Hooksでの使用例
useEffect(() => {
  const cleanup = subscribeToMarketData(
    'us-stock',
    ['AAPL', 'MSFT', 'GOOGL'],
    (data) => setStockData(data),
    30000 // 30秒ごとに更新
  );
  
  // クリーンアップ関数を返す
  return cleanup;
}, []);
```

## 4. Google Drive連携

### 4.1 ポートフォリオデータの保存

```javascript
const savePortfolioToGoogleDrive = async (portfolioData) => {
  try {
    const response = await axios.post(
      'https://[api-id].execute-api.region.amazonaws.com/[stage]/drive/save',
      { portfolioData },
      { withCredentials: true } // Cookieを送信するために必要
    );
    
    if (response.data.success) {
      console.log('保存成功:', response.data.file);
      return response.data.file;
    } else {
      console.error('保存エラー:', response.data.error);
      return null;
    }
  } catch (error) {
    console.error('Drive保存エラー:', error);
    
    // 認証エラーの場合はログイン画面にリダイレクト
    if (error.response && error.response.status === 401) {
      redirectToLogin();
    }
    
    return null;
  }
};
```

### 4.2 ポートフォリオデータの読み込み

```javascript
const loadPortfolioFromGoogleDrive = async (fileId) => {
  try {
    const response = await axios.get(
      'https://[api-id].execute-api.region.amazonaws.com/[stage]/drive/load',
      {
        params: { fileId },
        withCredentials: true // Cookieを送信するために必要
      }
    );
    
    if (response.data.success) {
      console.log('読み込み成功:', response.data.file);
      return response.data.data; // ポートフォリオデータ
    } else {
      console.error('読み込みエラー:', response.data.error);
      return null;
    }
  } catch (error) {
    console.error('Drive読み込みエラー:', error);
    
    // 認証エラーの場合はログイン画面にリダイレクト
    if (error.response && error.response.status === 401) {
      redirectToLogin();
    }
    
    return null;
  }
};
```

### 4.3 ファイル一覧の取得

```javascript
const listGoogleDriveFiles = async () => {
  try {
    const response = await axios.get(
      'https://[api-id].execute-api.region.amazonaws.com/[stage]/drive/files',
      { withCredentials: true } // Cookieを送信するために必要
    );
    
    if (response.data.success) {
      console.log('ファイル一覧取得成功:', response.data.files);
      return response.data.files;
    } else {
      console.error('ファイル一覧取得エラー:', response.data.error);
      return [];
    }
  } catch (error) {
    console.error('Driveファイル一覧取得エラー:', error);
    
    // 認証エラーの場合はログイン画面にリダイレクト
    if (error.response && error.response.status === 401) {
      redirectToLogin();
    }
    
    return [];
  }
};
```

## 5. エラーハンドリング

### 5.1 共通エラーコード

| エラーコード | 説明 | HTTP ステータス |
|-------------|------|---------------|
| `INVALID_PARAMS` | パラメータが無効 | 400 |
| `LIMIT_EXCEEDED` | 使用量制限超過 | 429 |
| `SOURCE_ERROR` | データソースエラー | 502 |
| `NOT_FOUND` | リソースが見つからない | 404 |
| `SERVER_ERROR` | サーバー内部エラー | 500 |
| `AUTH_ERROR` | 認証エラー | 401 |
| `NO_SESSION` | セッションなし | 401 |
| `INVALID_SESSION` | 無効なセッション | 401 |
| `TOKEN_REFRESH_ERROR` | トークン更新エラー | 401 |
| `DRIVE_ERROR` | Google Driveエラー | 500 |

### 5.2 包括的なエラーハンドリング

```javascript
const apiRequest = async (url, method = 'get', data = null, params = null) => {
  try {
    const config = {
      withCredentials: true,
      params
    };
    
    let response;
    if (method.toLowerCase() === 'get') {
      response = await axios.get(url, config);
    } else if (method.toLowerCase() === 'post') {
      response = await axios.post(url, data, config);
    } else if (method.toLowerCase() === 'put') {
      response = await axios.put(url, data, config);
    } else if (method.toLowerCase() === 'delete') {
      response = await axios.delete(url, config);
    }
    
    return response.data;
  } catch (error) {
    // 認証エラー
    if (error.response && error.response.status === 401) {
      console.error('認証エラー - ログインが必要です');
      redirectToLogin();
      return { success: false, error: 'ログインが必要です' };
    }
    
    // レート制限エラー
    if (error.response && error.response.status === 429) {
      console.warn('API使用量制限に達しました');
      
      // フォールバック処理
      return { 
        success: false, 
        error: 'API使用量制限に達しました',
        isRateLimited: true
      };
    }
    
    // その他のエラー
    console.error('APIエラー:', error);
    return { 
      success: false, 
      error: error.response?.data?.error?.message || error.message,
      status: error.response?.status
    };
  }
};
```

## 6. React用カスタムフック

### 6.1 認証フック

```javascript
import { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';

// 認証コンテキストの作成
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // セッション確認
  const checkSession = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        'https://[api-id].execute-api.region.amazonaws.com/[stage]/auth/session',
        { withCredentials: true }
      );
      
      if (response.data.success && response.data.isAuthenticated) {
        setUser(response.data.user);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('セッション確認エラー:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };
  
  // ログイン処理
  const login = async (credentialResponse) => {
    try {
      setLoading(true);
      const response = await axios.post(
        'https://[api-id].execute-api.region.amazonaws.com/[stage]/auth/google/login',
        {
          code: credentialResponse.code,
          redirectUri: window.location.origin + '/auth/callback'
        },
        { withCredentials: true }
      );
      
      if (response.data.success) {
        setUser(response.data.user);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('ログインエラー:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  // ログアウト処理
  const logout = async () => {
    try {
      setLoading(true);
      await axios.post(
        'https://[api-id].execute-api.region.amazonaws.com/[stage]/auth/logout',
        {},
        { withCredentials: true }
      );
      
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('ログアウトエラー:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 初回マウント時にセッション確認
  useEffect(() => {
    checkSession();
  }, []);
  
  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        login,
        logout,
        checkSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// カスタムフック
export const useAuth = () => useContext(AuthContext);
```

### 6.2 マーケットデータフック

```javascript
import { useState, useEffect } from 'react';
import axios from 'axios';

export const useMarketData = (type, symbols, refreshInterval = 0) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const fetchData = async () => {
    if (!symbols) return;
    
    try {
      setLoading(true);
      
      const apiUrl = process.env.REACT_APP_API_URL || 'https://[api-id].execute-api.region.amazonaws.com/[stage]';
      
      const response = await axios.get(`${apiUrl}/api/market-data`, {
        params: {
          type,
          symbols: Array.isArray(symbols) ? symbols.join(',') : symbols
        }
      });
      
      if (response.data.success) {
        setData(response.data.data);
        setError(null);
      } else {
        setError(response.data.error || '不明なエラー');
      }
    } catch (err) {
      setError(err.message || 'データ取得エラー');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    let intervalId = null;
    
    fetchData();
    
    if (refreshInterval > 0) {
      intervalId = setInterval(fetchData, refreshInterval);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [type, symbols, refreshInterval]);
  
  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
};
```

### 6.3 Google Drive連携フック

```javascript
import { useState } from 'react';
import axios from 'axios';
import { useAuth } from './useAuth';

export const useGoogleDrive = () => {
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const apiUrl = process.env.REACT_APP_API_URL || 'https://[api-id].execute-api.region.amazonaws.com/[stage]';
  
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
        `${apiUrl}/drive/files`,
        { withCredentials: true }
      );
      
      if (response.data.success) {
        return response.data.files;
      } else {
        setError(response.data.error?.message || '不明なエラー');
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
        `${apiUrl}/drive/save`,
        { portfolioData },
        { withCredentials: true }
      );
      
      if (response.data.success) {
        return response.data.file;
      } else {
        setError(response.data.error?.message || '不明なエラー');
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
        `${apiUrl}/drive/load`,
        {
          params: { fileId },
          withCredentials: true
        }
      );
      
      if (response.data.success) {
        return response.data.data;
      } else {
        setError(response.data.error?.message || '不明なエラー');
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

## 7. 実装例

### 7.1 Google認証ボタンのコンポーネント

```jsx
import React from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const LoginButton = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const handleGoogleLoginSuccess = async (credentialResponse) => {
    const success = await login(credentialResponse);
    if (success) {
      navigate('/dashboard');
    }
  };
  
  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <GoogleLogin
        flow="auth-code"
        onSuccess={handleGoogleLoginSuccess}
        onError={() => console.error('ログイン失敗')}
        useOneTap
        shape="pill"
        text="signin_with"
      />
    </GoogleOAuthProvider>
  );
};

export default LoginButton;
```

### 7.2 ポートフォリオ保存コンポーネント

```jsx
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

### 7.3 Google Driveファイル一覧コンポーネント

```jsx
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

## 8. ベストプラクティス

### 8.1 セキュリティのベストプラクティス

1. **CORS設定の適切な管理**
   - `withCredentials: true` は常に設定する
   - フロントエンドのオリジンをバックエンドで許可する

2. **トークン・クレデンシャル管理**
   - APIキーやGoogle Clientシークレットは絶対にフロントエンドに保存しない
   - Google Client IDだけはフロントエンドに必要

3. **エラーハンドリング**
   - ユーザーに表示するエラーメッセージは適切に抽象化する
   - デバッグ情報は開発環境でのみ表示する

### 8.2 パフォーマンスのベストプラクティス

1. **バッチ処理**
   - 複数銘柄のデータは一度のリクエストで取得する
   - 例: `symbols: 'AAPL,MSFT,GOOGL'`

2. **キャッシュの活用**
   - 頻繁に変化しないデータはローカルストレージに保存
   - `refresh` パラメータは必要な場合のみ `true` に設定

3. **ポーリング間隔の最適化**
   - マーケットデータの更新頻度に応じて適切な間隔を設定
   - 米国株・日本株: 1分〜5分
   - 為替レート: 30秒〜1分
   - 投資信託: 1時間〜1日

### 8.3 UXのベストプラクティス

1. **ローディング状態の表示**
   - データ取得中はスケルトンUIやローディングインジケーターを表示

2. **エラー状態の処理**
   - エラー発生時は適切なフォールバックUIを表示
   - 再試行ボタンを提供

3. **認証状態の管理**
   - ログイン状態を明確に表示
   - 認証が必要な機能は事前に説明

### 8.4 開発フローのベストプラクティス

1. **環境変数の管理**
   - `.env.development` と `.env.production` を使い分ける
   - API URLやGoogle Client IDは環境変数で管理

2. **エラーロギング**
   - 本番環境ではSentry.ioなどのエラー追跡サービスを導入

3. **バージョン管理**
   - API URLにはバージョン番号を含める
   - APIの破壊的変更を追跡する

以上がポートフォリオマーケットデータAPI統合ガイドです。このガイドを参考に、フロントエンド側での効率的な実装を行ってください。不明点がある場合は、APIドキュメントや管理者にお問い合わせください。
