import React, { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

export default function App() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/ping`)
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setErr(e.toString()));
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: 20 }}>
      <h1>Монорепо тест</h1>
      <p>Пытаемся достучаться до FastAPI…</p>
      {err && <p style={{ color: "red" }}>Ошибка: {err}</p>}
      {data ? (
        <pre>{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <p>Загрузка…</p>
      )}
    </div>
  );
}