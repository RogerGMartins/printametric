/** Download only on explicit user actions; release URLs after the browser consumes them. */
export function downloadBytes(bytes: Uint8Array<ArrayBuffer>, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  try { document.body.append(anchor); anchor.click(); }
  finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
