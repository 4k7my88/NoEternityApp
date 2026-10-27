const pad = (n: number) => String(n).padStart(2, '0');

/** `no-eternity-20261027-213005.png`, in local time. */
export function artworkFileName(date: Date): string {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `no-eternity-${day}-${time}.png`;
}

export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * On phones and tablets the share sheet is the way to put an image in the photo
 * library, so offer that first; everywhere else, download the file.
 */
export async function saveImage(blob: Blob, name: string): Promise<SaveOutcome> {
  const file = new File([blob], name, { type: blob.type });
  const touchFirst = window.matchMedia('(pointer: coarse)').matches;
  if (touchFirst && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'no Eternity' });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Sharing is unavailable after all; fall back to a download.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
