/**
 * download.ts
 *
 * Handing a Blob to the browser as a file. One implementation, because there
 * used to be two — one in `programDataStore`, one inside `saveProjectToFile` —
 * and they disagreed on the two details that actually matter.
 */

/**
 * Trigger a browser download of `blob` under `filename`.
 *
 * The anchor is appended to the document before clicking: Firefox ignores a
 * click on a detached anchor. And the object URL is revoked on the next tick
 * rather than synchronously, because revoking in the same tick as the click
 * races the download and truncates it in some browsers.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
