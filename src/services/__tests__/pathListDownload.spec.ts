import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPathListDownload } from '../pathListDownload';

const createURL = vi.fn((_blob: Blob | MediaSource) => 'blob:test-paths');
const revokeURL = vi.fn();
const write = vi.fn();
const close = vi.fn();
const abort = vi.fn();
const createWritable = vi.fn();
const picker = vi.fn();
let click: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  vi.stubGlobal('showSaveFilePicker', picker);
  createWritable.mockResolvedValue({ write, close, abort });
  picker.mockResolvedValue({ createWritable });
  vi.spyOn(URL, 'createObjectURL').mockImplementation(createURL);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeURL);
  click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('plain text path downloads', () => {
  it('downloads the complete UTF-8 list with one literal path per line, then releases the URL', async () => {
    const sink = await createPathListDownload('cmip7-nci-paths.txt', new AbortController().signal);
    await sink.write(['/g/data/a b.nc', '/g/data/温度.nc']);
    await sink.write(['/g/data/c.nc']);
    expect(click).not.toHaveBeenCalled();
    await sink.close();
    const blob = createURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('text/plain;charset=utf-8');
    expect(await blob.text()).toBe('/g/data/a b.nc\n/g/data/温度.nc\n/g/data/c.nc\n');
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe('cmip7-nci-paths.txt');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(picker).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60000);
    expect(revokeURL).toHaveBeenCalledWith('blob:test-paths');
  });

  it('cancels buffered output without downloading a partial list', async () => {
    const controller = new AbortController();
    const sink = await createPathListDownload('paths.txt', controller.signal);
    await sink.write(['/g/data/first.nc']);
    controller.abort();
    await expect(sink.close()).rejects.toThrow();
    await expect(sink.write(['/g/data/last.nc'])).rejects.toThrow();
    expect(createURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it('streams large exports to the chosen file and commits only on completion', async () => {
    const sinkPromise = createPathListDownload('paths.txt', new AbortController().signal, true);
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: 'paths.txt' }));
    const sink = await sinkPromise;
    await sink.write(['/g/data/first.nc']);
    await sink.write(['/g/data/last.nc']);
    expect(write.mock.calls.map(([data]) => new TextDecoder().decode(data))).toEqual([
      '/g/data/first.nc\n',
      '/g/data/last.nc\n',
    ]);
    expect(close).not.toHaveBeenCalled();
    await sink.close();
    expect(close).toHaveBeenCalledOnce();
    expect(createURL).not.toHaveBeenCalled();
  });

  it('aborts a direct file write on cancellation and propagates a cancelled picker', async () => {
    const controller = new AbortController();
    const sink = await createPathListDownload('paths.txt', controller.signal, true);
    await sink.write(['/g/data/first.nc']);
    controller.abort();
    await sink.abort();
    expect(abort).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    picker.mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'));
    await expect(createPathListDownload('paths.txt', new AbortController().signal, true)).rejects.toThrow('Cancelled');
    expect(createURL).not.toHaveBeenCalled();
  });

  it('uses a complete Blob download when direct file saving is unavailable', async () => {
    vi.stubGlobal('showSaveFilePicker', undefined);
    const sink = await createPathListDownload('paths.txt', new AbortController().signal, true);
    await sink.write(['/g/data/file.nc']);
    await sink.close();
    expect(click).toHaveBeenCalledOnce();
  });

  it('reports a buffer limit instead of saving a truncated fallback download', async () => {
    vi.spyOn(TextEncoder.prototype, 'encode').mockReturnValue({
      byteLength: 512 * 1024 * 1024 + 1,
    } as Uint8Array<ArrayBuffer>);
    const sink = await createPathListDownload('paths.txt', new AbortController().signal);
    await expect(sink.write(['/g/data/file.nc'])).rejects.toThrow('No partial list was downloaded');
    await sink.abort();
    expect(click).not.toHaveBeenCalled();
  });
});
