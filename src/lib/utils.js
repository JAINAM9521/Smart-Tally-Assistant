export function downloadText(filename, content, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}
export function save(key, value) { if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value)); }
export function read(key, fallback) { if (typeof window === "undefined") return fallback; try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
export function append(key, value) { const existing = read(key, []); save(key, [value, ...existing]); return [value, ...existing]; }
