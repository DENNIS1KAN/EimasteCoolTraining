/** Save text as a file through a Blob and a temporary <a download>. */
export function downloadText(filename: string, text: string, type = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Safari needs the URL to live until the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Read a picked file as text (UTF-8). */
export const readFileText = (file: File): Promise<string> =>
  typeof file.text === 'function'
    ? file.text()
    : new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result ?? ''))
        r.onerror = () => reject(r.error)
        r.readAsText(file)
      })
