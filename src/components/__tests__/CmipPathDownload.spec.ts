import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import CmipPathDownload from '../CmipPathDownload.vue';
import { createPathListDownload } from '../../services/pathListDownload';

vi.mock('../../services/pathListDownload', () => ({ createPathListDownload: vi.fn() }));
const sink = { write: vi.fn(), close: vi.fn(), abort: vi.fn() };
const search = { page: vi.fn(), files: vi.fn(), dispose: vi.fn(), exportPaths: vi.fn() };
let wrapper: VueWrapper;
const render = (datasetKey?: string) => {
  wrapper = mount(CmipPathDownload, { props: { search, filename: 'cmip7-nci-paths.txt', datasetKey } });
};
const clickDownload = async () => {
  await wrapper.get('button').trigger('click');
  await flushPromises();
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createPathListDownload).mockResolvedValue(sink);
  sink.abort.mockResolvedValue(undefined);
  search.exportPaths.mockImplementation(async function* () {
    yield Array.from({ length: 30 }, (_, index) => `/g/data/${index}.nc`);
    yield ['/g/data/final.nc'];
  });
  vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
});
afterEach(() => {
  wrapper?.unmount();
  vi.restoreAllMocks();
});

describe('CMIP path-list download controls', () => {
  it('copies every dataset path across export batches without copying just the visible page', async () => {
    render('dataset');
    await wrapper.setProps({ allowCopy: true });
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Copy all paths'))!
      .trigger('click');
    await flushPromises();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      [...Array.from({ length: 30 }, (_, i) => `/g/data/${i}.nc`), '/g/data/final.nc'].join('\n') + '\n',
    );
    expect(search.exportPaths).toHaveBeenCalledWith(expect.any(AbortSignal), 'dataset');
    expect(wrapper.text()).toContain('Copied 31 paths.');
    expect(wrapper.text()).not.toContain('One path per line');
    expect(createPathListDownload).not.toHaveBeenCalled();
    expect(search.files).not.toHaveBeenCalled();
  });

  it.each(['failure', 'cancel', 'oversize'])('does not copy an incomplete path list on %s', async (mode) => {
    let resume!: () => void;
    const waiting = new Promise<void>((done) => {
      resume = done;
    });
    search.exportPaths.mockImplementationOnce(async function* () {
      yield ['/g/data/first.nc'];
      if (mode === 'failure') throw new Error('Export failed');
      if (mode === 'cancel') await waiting;
      yield ['/g/data/last.nc'];
    });
    if (mode === 'oversize')
      vi.spyOn(TextEncoder.prototype, 'encode').mockReturnValue({
        byteLength: 17 * 1024 * 1024,
      } as Uint8Array<ArrayBuffer>);
    render('dataset');
    await wrapper.setProps({ allowCopy: true });
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Copy all paths'))!
      .trigger('click');
    await flushPromises();
    if (mode === 'cancel') {
      await wrapper.setProps({ datasetKey: 'new' });
      resume();
      await flushPromises();
    } else expect(wrapper.find('[role=alert]').exists()).toBe(true);
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('downloads all export batches with progress instead of the displayed file or dataset page', async () => {
    render();
    expect(wrapper.text()).toContain('every result page');
    await clickDownload();
    expect(search.exportPaths).toHaveBeenCalledWith(expect.any(AbortSignal), undefined);
    expect(sink.write).toHaveBeenCalledTimes(2);
    expect(sink.close).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('Downloaded 31 paths.');
    expect(search.files).not.toHaveBeenCalled();
    expect(search.page).not.toHaveBeenCalled();
  });

  it('scopes dataset downloads explicitly', async () => {
    render('CMIP7/example/v20260101');
    expect(wrapper.get('button').text()).toContain('Download dataset paths');
    await clickDownload();
    expect(search.exportPaths).toHaveBeenCalledWith(expect.any(AbortSignal), 'CMIP7/example/v20260101');
  });

  it('never saves a partial list after an export error, and allows retry', async () => {
    search.exportPaths.mockImplementationOnce(async function* () {
      yield ['/g/data/first.nc'];
      throw new Error('Catalogue unavailable');
    });
    render();
    await clickDownload();
    expect(sink.abort).toHaveBeenCalledOnce();
    expect(sink.close).not.toHaveBeenCalled();
    expect(wrapper.get('[role=alert]').text()).toContain('Catalogue unavailable');
    await clickDownload();
    expect(sink.close).toHaveBeenCalledOnce();
    expect(wrapper.find('[role=alert]').exists()).toBe(false);
  });

  it.each(['cancel', 'change', 'unmount'])('cancels pending exports on %s without a late download', async (action) => {
    let resume!: () => void;
    const waiting = new Promise<void>((done) => {
      resume = done;
    });
    search.exportPaths.mockImplementationOnce(async function* () {
      await waiting;
      yield ['/g/data/stale.nc'];
    });
    render();
    await clickDownload();
    const signal = vi.mocked(createPathListDownload).mock.lastCall![1];
    if (action === 'cancel') await wrapper.findAll('button')[1]!.trigger('click');
    else if (action === 'change') await wrapper.setProps({ datasetKey: 'different-dataset' });
    else wrapper.unmount();
    expect(signal.aborted).toBe(true);
    resume();
    await flushPromises();
    expect(sink.write).not.toHaveBeenCalled();
    expect(sink.close).not.toHaveBeenCalled();
    expect(sink.abort).toHaveBeenCalledOnce();
    if (action === 'cancel') expect(wrapper.text()).toContain('Cancelled.');
  });

  it('does not export before the search is ready or download an unexpected empty list', async () => {
    render();
    await wrapper.setProps({ disabled: true });
    await clickDownload();
    expect(createPathListDownload).not.toHaveBeenCalled();
    await wrapper.setProps({ disabled: false });
    search.exportPaths.mockImplementationOnce(async function* () {});
    await clickDownload();
    expect(sink.close).not.toHaveBeenCalled();
    expect(wrapper.get('[role=alert]').text()).toContain('No matching file paths');
  });
});
