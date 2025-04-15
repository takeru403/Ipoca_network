import React, { useState } from "react";

function Login({ onLogin }) {
  const [username, setUsername] = useState("ipoca_test");
  const [password, setPassword] = useState("ipoca_test");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        throw new Error("ログイン失敗");
      }
      onLogin();
    } catch (err) {
      setError("ログインに失敗しました。IDとパスワードを確認してください。");
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>ログイン</h1>
      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          value={username}
          placeholder="ユーザー名"
          onChange={(e) => setUsername(e.target.value)}
          style={{ padding: "0.5rem", marginRight: "0.5rem" }}
        />
        <input
          type="password"
          value={password}
          placeholder="パスワード"
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: "0.5rem", marginRight: "0.5rem" }}
        />
        <button onClick={handleLogin} style={{ padding: "0.5rem 1rem" }}>
          ログイン
        </button>
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

export default Login;
