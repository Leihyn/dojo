"use client";

import { useEffect, useState } from "react";

function legacyCopy(text: string): boolean {
  const t = document.createElement("textarea");
  t.value = text;
  t.setAttribute("readonly", "");
  t.style.position = "fixed";
  t.style.opacity = "0";
  document.body.appendChild(t);
  t.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  document.body.removeChild(t);
  return ok;
}

/** Copies the curl command. Falls back to execCommand, then tells the reader to copy by hand. */
export function CopyButton({ text }: { text: string }) {
  const [label, setLabel] = useState("Copy");

  useEffect(() => {
    if (label === "Copy") return;
    const id = window.setTimeout(() => setLabel("Copy"), 2000);
    return () => window.clearTimeout(id);
  }, [label]);

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      setLabel("Copied");
    } catch {
      setLabel(legacyCopy(text) ? "Copied" : "Select the command to copy");
    }
  }

  return (
    <button type="button" onClick={copy} className="hm-copy" aria-live="polite">
      {label}
    </button>
  );
}
