// src/components/LoginForm.js
import React, { useState } from "react";
import { fetchJSON } from "../api";
import "../App.css";

export default function LoginForm({ onLogin }) {
  const [user, setUser] = useState("ipoca_test");
  const [pwd, setPwd] = useState("ipoca_test");
  const [authErr, setAuthErr] = useState("");

  const login = async () => {
    setAuthErr("");
    try {
      await fetchJSON("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: user, password: pwd }),
      });
      onLogin();
    } catch (e) {
      setAuthErr(e.message);
    }
  };

  return (
    <div className="login-container">
      <h2 className="login-title">ログイン</h2>
      <input
        className="login-input"
        value={user}
        onChange={(e) => setUser(e.target.value)}
        placeholder="ユーザー名"
      />
      <input
        className="login-input"
        type="password"
        value={pwd}
        onChange={(e) => setPwd(e.target.value)}
        placeholder="パスワード"
      />
      <button className="login-button" onClick={login}>
        ログイン
      </button>
      {authErr && <p className="error-message">{authErr}</p>}
    </div>
  );
}
