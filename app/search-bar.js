"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchBar() {
  const [q, setQ] = useState("");
  const router = useRouter();

  function handleSubmit(e) {
    e.preventDefault();
    if (q.trim()) {
      router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    }
  }

  return (
    <form className="nav-search" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Search anime..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        id="search-input"
      />
      <button type="submit" id="search-btn">
        Search
      </button>
    </form>
  );
}
