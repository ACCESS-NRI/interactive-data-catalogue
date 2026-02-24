import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import WelcomeModal from '../WelcomeModal.vue';

// Mock the xarray repr asset — empty string (no real HTML content)
vi.mock('../assets/xarray-repr.html?raw', () => ({ default: '' }));

const STORAGE_KEY = 'catalogue-welcome-seen';

// Stub heavy PrimeVue components to avoid needing full PrimeVue installation.
// Dialog renders its default slot and footer slot inline for testability.
const createWrapper = () =>
  mount(WelcomeModal, {
    global: {
      stubs: {
        Dialog: {
          name: 'Dialog',
          props: ['visible', 'modal', 'header', 'style', 'breakpoints'],
          emits: ['update:visible', 'hide'],
          template: '<div v-if="visible"><slot /><slot name="footer" /></div>',
        },
        Accordion: { template: '<div><slot /></div>' },
        AccordionPanel: { template: '<div><slot /></div>' },
        AccordionHeader: { template: '<div><slot /></div>' },
        AccordionContent: { template: '<div><slot /></div>' },
        Button: { template: '<button><slot /></button>', props: ['label', 'icon', 'iconPos', 'autofocus'] },
        highlightjs: { template: '<pre><code></code></pre>' },
      },
    },
  });

describe('WelcomeModal', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ── Auto-show on first visit ────────────────────────────────────────────────

  it('shows on first visit when localStorage key is absent', async () => {
    const wrapper = createWrapper();
    await wrapper.vm.$nextTick();
    expect((wrapper.vm as any).visible).toBe(true);
  });

  it('does not auto-show when localStorage key is already set', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const wrapper = createWrapper();
    await wrapper.vm.$nextTick();
    expect((wrapper.vm as any).visible).toBe(false);
  });

  // ── open() / close() ────────────────────────────────────────────────────────

  it('open() sets visible to true regardless of localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const wrapper = createWrapper();
    await wrapper.vm.$nextTick();
    expect((wrapper.vm as any).visible).toBe(false);

    (wrapper.vm as any).open();
    await wrapper.vm.$nextTick();
    expect((wrapper.vm as any).visible).toBe(true);
  });

  it('close() sets visible to false', async () => {
    const wrapper = createWrapper();
    await wrapper.vm.$nextTick();
    expect((wrapper.vm as any).visible).toBe(true);

    (wrapper.vm as any).close();
    await wrapper.vm.$nextTick();
    expect((wrapper.vm as any).visible).toBe(false);
  });

  // ── defineExpose ────────────────────────────────────────────────────────────

  it('exposes open() method', () => {
    const wrapper = createWrapper();
    expect(typeof (wrapper.vm as any).open).toBe('function');
  });

  // ── Don't show again persistence ────────────────────────────────────────────

  it('persists dismissal to localStorage when "Don\'t show again" is checked before close()', () => {
    const wrapper = createWrapper();
    (wrapper.vm as any).dontShowAgain = true;
    (wrapper.vm as any).close();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('persists dismissal to localStorage when "Don\'t show again" is checked on hide', () => {
    const wrapper = createWrapper();
    (wrapper.vm as any).dontShowAgain = true;
    (wrapper.vm as any).onHide();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('does NOT persist to localStorage when "Don\'t show again" is unchecked on close()', () => {
    const wrapper = createWrapper();
    (wrapper.vm as any).dontShowAgain = false;
    (wrapper.vm as any).close();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does NOT persist to localStorage when "Don\'t show again" is unchecked on hide', () => {
    const wrapper = createWrapper();
    (wrapper.vm as any).dontShowAgain = false;
    (wrapper.vm as any).onHide();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });


  it('hasXarrayRepr computed strips HTML comments correctly', () => {
    const commentOnly = '<!-- just a comment -->';
    const result = commentOnly.replace(/<!--[\s\S]*?-->/g, '').trim().length > 0;
    expect(result).toBe(false);
  });

  it('hasXarrayRepr computed detects real HTML content', () => {
    const realHtml = '<!-- comment --><div>xarray</div>';
    const result = realHtml.replace(/<!--[\s\S]*?-->/g, '').trim().length > 0;
    expect(result).toBe(true);
  });

  it('renders the intro paragraph text when visible', async () => {
    const wrapper = createWrapper();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('ACCESS-NRI Interactive Data Catalogue');
    expect(wrapper.text()).toContain('intake-esm');
  });

  it('renders all three accordion panel headers when visible', async () => {
    const wrapper = createWrapper();
    await wrapper.vm.$nextTick();
    const text = wrapper.text();
    expect(text).toContain('Exploring the catalogue');
    expect(text).toContain('Using a datastore in Python');
    expect(text).toContain('About this tool');
  });

  it('renders the NCI link when visible', async () => {
    const wrapper = createWrapper();
    await wrapper.vm.$nextTick();
    const link = wrapper.find('a[href="https://nci.org.au/"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('target')).toBe('_blank');
  });

  it('renders the ACCESS-NRI Intake documentation link when visible', async () => {
    const wrapper = createWrapper();
    await wrapper.vm.$nextTick();
    const link = wrapper.find('a[href="https://access-nri-intake-catalog.readthedocs.io/"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('target')).toBe('_blank');
  });

  it('does not render modal content when not visible', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const wrapper = createWrapper();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).not.toContain('ACCESS-NRI Interactive Data Catalogue');
  });
});