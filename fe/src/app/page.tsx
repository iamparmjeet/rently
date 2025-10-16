"use client";
import { useEffect } from "react";

export default function HealthTest() {
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("http://localhost:8787/api/v1/health", {
          credentials: "include",
        });
        const data = await res.json();
        console.log("✅ Health:", data);
      } catch (err) {
        console.error("❌ Error:", err);
      }
    })();
  }, []);

  return (
    <div className="p-4">
      <h1>Check console for backend health response</h1>
    </div>
  );
}
