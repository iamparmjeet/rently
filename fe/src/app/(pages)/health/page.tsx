"use client";
import { useEffect, useState } from "react";

export default function page() {
  const [data, setData] = useState()
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("http://localhost:8787/api/v1/health", {
          credentials: "include",
        });
        const resData = await res.json();
        // console.log(resData)
        setData(resData)
        console.log("✅ Health:", resData);
      } catch (err) {
        console.error("❌ Error:", err);
      }
    })();
  }, []);

  return (
    <div className="p-4">
      <h1>Check console for backend health response</h1>
      <h2>HealthStatus: {JSON.stringify(data)}</h2>
    </div>
  );
}
