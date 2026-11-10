interface TextFileWriter {
  write(data: Uint8Array<ArrayBuffer>): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}
type SaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable(): Promise<TextFileWriter> }>;

export interface PathListDownload {
  write(paths: string[]): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

/** Use direct file writing for large searches when the browser supports it.
 * The fallback creates a download only after the complete list is ready.
 */
export async function createPathListDownload(
  filename: string,
  signal: AbortSignal,
  large = false,
): Promise<PathListDownload> {
  signal.throwIfAborted();
  const picker = (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  let writer: TextFileWriter | undefined;
  if (large && picker) {
    // Invoke the picker before any catalogue query, while the click is still a user gesture.
    const handle = await picker.call(window, {
      suggestedName: filename,
      types: [{ description: 'Text file', accept: { 'text/plain': ['.txt'] } }],
    });
    signal.throwIfAborted();
    writer = await handle.createWritable();
  }
  const chunks: Blob[] = [];
  let bytes = 0;
  let closed = false;
  const encoder = new TextEncoder();
  const abort = async () => {
    if (closed) return;
    closed = true;
    chunks.length = 0;
    signal.removeEventListener('abort', onAbort);
    await writer?.abort();
  };
  const onAbort = () => {
    void abort().catch(() => {});
  };
  signal.addEventListener('abort', onAbort, { once: true });
  if (signal.aborted) {
    await abort();
    signal.throwIfAborted();
  }
  return {
    async write(paths) {
      signal.throwIfAborted();
      if (closed) throw new Error('The path-list download has been closed.');
      if (!paths.length) return;
      const data = encoder.encode(`${paths.join('\n')}\n`);
      if (writer) await writer.write(data);
      else {
        bytes += data.byteLength;
        if (bytes > 512 * 1024 * 1024)
          throw new Error(
            'This list exceeds the browser’s download buffer. Narrow the search and try again. No partial list was downloaded.',
          );
        chunks.push(new Blob([data]));
      }
    },
    async close() {
      signal.throwIfAborted();
      if (closed) throw new Error('The path-list download has been closed.');
      if (writer) await writer.close();
      else {
        const url = URL.createObjectURL(new Blob(chunks, { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        try {
          link.click();
        } finally {
          link.remove();
          // Allow the browser to start reading the Blob before releasing it.
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
      }
      closed = true;
      chunks.length = 0;
      signal.removeEventListener('abort', onAbort);
    },
    abort,
  };
}
