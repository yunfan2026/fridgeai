// Thin client for the Express AI endpoints (Gemini stays server-side).

async function postJSON(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request to ${path} failed`);
  return data;
}

// Read a File into a base64 string (no data: prefix).
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// mode: 'groceries' | 'receipt'. images: array of base64 strings (one shopping trip).
export function scan(images, mode) {
  return postJSON('/api/scan', { images, mode });
}

// Single image of a printed date -> { expiresAt }.
export function captureDate(image) {
  return postJSON('/api/capture-date', { image });
}

export function fetchRecipes(inventory) {
  return postJSON('/api/recipes', { inventory });
}
