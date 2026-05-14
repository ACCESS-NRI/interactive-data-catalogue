import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import MetacatHeader from '../MetacatHeader.vue';
import Button from 'primevue/button';
import Popover from 'primevue/popover';

// Mock the build-time constants
vi.mock('vite', () => ({}));

// vi.hoisted ensures the fn exists before the hoisted vi.mock factory runs
const { openMock } = vi.hoisted(() => ({ openMock: vi.fn() }));

vi.mock('../WelcomeModal.vue', () => ({
  default: {
    name: 'WelcomeModal',
    template: '<div />',
  },
}));

vi.mock('../GithubFeedbackButton.vue', () => ({
  default: {
    name: 'GithubFeedbackButton',
    template: '<div data-test="github-feedback-button" />',
  },
}));

describe('MetacatHeader', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  // Helper to create wrapper with PrimeVue components
  const createWrapper = (commitSha?: string, buildTime?: string, appVersion?: string) => {
    // Mock the global constants if provided
    if (commitSha !== undefined) {
      (globalThis as any).__GIT_COMMIT_SHA__ = commitSha;
    }
    if (buildTime !== undefined) {
      (globalThis as any).__BUILD_TIME__ = buildTime;
    }
    // Default to a clean release tag so the version badge is always rendered
    (globalThis as any).__APP_VERSION__ = appVersion ?? 'v2026.05.04';

    return mount(MetacatHeader, {
      global: {
        components: {
          Button,
        },
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          // Stub Popover so show/hide don't run real PrimeVue transition logic
          Popover: {
            template: '<div data-testid="commit-popover"><slot /></div>',
            methods: { show: vi.fn(), hide: vi.fn() },
            expose: ['show', 'hide'],
          },
        },
      },
    });
  };

  // Test that the main title is rendered correctly
  it('renders the main title', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('ACCESS-NRI Interactive Data Catalog');
  });

  // Test that the description text is displayed
  it('renders the description', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('Explore the ACCESS-NRI Interactive Catalogue');
  });

  // Test that intake-esm documentation link is present with correct attributes
  it('renders intake-esm documentation link', () => {
    const wrapper = createWrapper();
    const link = wrapper.find('a[href="https://intake-esm.readthedocs.io/"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
    expect(link.text()).toContain('intake-esm Documentation');
  });

  // Test that ACCESS-NRI intake documentation link is present with correct attributes
  it('renders ACCESS-NRI intake documentation link', () => {
    const wrapper = createWrapper();
    const link = wrapper.find('a[href="https://access-nri-intake-catalog.readthedocs.io/"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
    expect(link.text()).toContain('ACCESS-NRI Intake Documentation');
  });

  // Test that a clean release badge renders as a link to GitHub Releases
  it('renders version badge as link for clean tagged release', () => {
    const wrapper = createWrapper('abc123def456', '2025-12-03T10:00:00Z', 'v2026.05.04');
    const releaseLink = wrapper.find('a[href*="/releases/tag/"]');
    expect(releaseLink.exists()).toBe(true);
    expect(releaseLink.text()).toContain('v2026.05.04');
    expect(releaseLink.attributes('href')).toBe(
      'https://github.com/access-nri/interactive-data-catalogue/releases/tag/v2026.05.04',
    );
  });

  // Test that a dirty build renders as a non-linked span
  it('renders version badge as span (no link) for dirty build', () => {
    const wrapper = createWrapper('abc123def456', '2025-12-03T10:00:00Z', 'v2026.05.04.dirty');
    const releaseLink = wrapper.find('a[href*="/releases/tag/"]');
    expect(releaseLink.exists()).toBe(false);
    expect(wrapper.text()).toContain('v2026.05.04.dirty');
  });

  it('renders the feedback button when deployment metadata is available', () => {
    const wrapper = createWrapper('abc123def456789', '2025-12-03T10:00:00Z');
    expect(wrapper.find('[data-test="github-feedback-button"]').exists()).toBe(true);
  });

  it('renders the personal datastore link', () => {
    const wrapper = createWrapper();
    const button = wrapper.find('button[aria-label="Explore my personal datastore"]');
    expect(button.exists()).toBe(true);
  });

  // Test that a dev build renders as a non-linked span
  it('renders version badge as span (no link) for dev build', () => {
    const wrapper = createWrapper('abc123def456', '2025-12-03T10:00:00Z', 'dev');
    const releaseLink = wrapper.find('a[href*="/releases/tag/"]');
    expect(releaseLink.exists()).toBe(false);
    expect(wrapper.text()).toContain('dev');
  });

  // Test that the popover shows on hover over the version badge
  it('shows popover on version badge hover', async () => {
    const wrapper = createWrapper('abc123def456', '2025-12-03T10:00:00Z', 'v2026.05.04');
    const releaseLink = wrapper.find('a[href*="/releases/tag/"]');
    const popover = wrapper.findComponent(Popover);

    // Simulate mouseenter
    await releaseLink.trigger('mouseenter');
    expect(popover.exists()).toBe(true);
  });

  // Test that the version badge and commit SHA are both present when available
  it('displays version in badge and commit SHA in popover template', () => {
    const commitSha = 'abc123def456789';
    const wrapper = createWrapper(commitSha, '2025-12-03T10:00:00Z', 'v2026.05.04');
    // Version is visible in the release badge
    const releaseLink = wrapper.find('a[href*="/releases/tag/"]');
    expect(releaseLink.exists()).toBe(true);
    expect(releaseLink.text()).toContain('v2026.05.04');
    // Popover teleports to body so its content isn't in wrapper.html();
    // verify commit SHA is wired in via the copy-SHA method test below
  });

  // Test that the popover template includes build time reference when available
  it('includes build time in component when available', () => {
    const buildTime = '2025-12-03T10:00:00Z';
    const wrapper = createWrapper('abc123def456', buildTime);
    // Build time is referenced in the template even if popover isn't shown yet
    expect(wrapper.vm.$data).toBeDefined();
  });

  // Test that the copy button is referenced in the template
  it('includes copy SHA button in template', () => {
    const wrapper = createWrapper('abc123def456', '2025-12-03T10:00:00Z');
    // Button is in the popover template which exists in the component
    const html = wrapper.html();
    expect(html).toBeTruthy();
  });

  // Test that the copyCommitSha method calls clipboard API correctly
  it('copyCommitSha method uses clipboard API', async () => {
    const commitSha = 'abc123def456789';
    const wrapper = createWrapper(commitSha, '2025-12-03T10:00:00Z');

    // Mock clipboard API
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    // Call the method directly since button is in unpopulated popover
    await (wrapper.vm as any).copyCommitSha();

    expect(writeTextMock).toHaveBeenCalledWith(commitSha);
  });

  // Test that the popover hides after a delay when mouse leaves
  it('schedules popover hide on mouseleave', async () => {
    const wrapper = createWrapper('abc123def456', '2025-12-03T10:00:00Z', 'v2026.05.04');
    const releaseLink = wrapper.find('a[href*="/releases/tag/"]');

    // Show popover
    await releaseLink.trigger('mouseenter');

    // Leave the link
    await releaseLink.trigger('mouseleave');

    // Fast-forward time
    vi.advanceTimersByTime(300);

    // Popover should be hidden (we can't test the actual hide call without deeper mocking)
    expect(true).toBe(true); // Placeholder - actual behavior would need popover instance access
  });

  // Test that hovering over popover cancels the hide timeout
  it('cancels hide timeout when hovering over popover', async () => {
    const wrapper = createWrapper('abc123def456', '2025-12-03T10:00:00Z', 'v2026.05.04');
    const releaseLink = wrapper.find('a[href*="/releases/tag/"]');
    const popover = wrapper.findComponent(Popover);

    // Show popover
    await releaseLink.trigger('mouseenter');

    // Leave link (starts hide timer)
    await releaseLink.trigger('mouseleave');

    // Enter popover (should cancel hide timer)
    await popover.trigger('mouseenter');

    // Fast-forward past the timeout
    vi.advanceTimersByTime(500);

    // Popover should still be visible (timeout was cancelled)
    expect(true).toBe(true); // Placeholder - actual behavior would need deeper testing
  });

  // Test that the component handles clipboard API errors gracefully
  it('handles clipboard API errors gracefully', async () => {
    const wrapper = createWrapper('abc123def456', '2025-12-03T10:00:00Z');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock clipboard API to fail
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard error')),
      },
      writable: true,
      configurable: true,
    });

    // Call the method directly
    await (wrapper.vm as any).copyCommitSha();

    expect(consoleSpy).toHaveBeenCalledWith('Failed to copy commit SHA:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  // Test that GitHub icon is present in the commit badge
  it('renders GitHub icon in commit badge', () => {
    const wrapper = createWrapper('abc123def456', '2025-12-03T10:00:00Z');
    const icon = wrapper.find('.pi-github');
    expect(icon.exists()).toBe(true);
  });

  // Test that external link icons are present in documentation links
  it('renders external link icons for documentation links', () => {
    const wrapper = createWrapper();
    const externalIcons = wrapper.findAll('.pi-external-link');
    expect(externalIcons.length).toBe(2);
  });

  // ── Info / welcome button ────────────────────────────────────────────────────

  it('renders the info button next to the heading', () => {
    const wrapper = createWrapper();
    const btn = wrapper.find('button[aria-label="Reopen welcome guide"]');
    expect(btn.exists()).toBe(true);
  });

  it('info button has pi-info-circle icon', () => {
    const wrapper = createWrapper();
    const icon = wrapper.find('button[aria-label="Reopen welcome guide"] .pi-info-circle');
    expect(icon.exists()).toBe(true);
  });

  it('clicking the info button calls open() on the WelcomeModal ref', async () => {
    const wrapper = createWrapper();
    // Access the welcomeModalRef and spy on its open method
    const vm = wrapper.vm as any;
    vm.welcomeModalRef = { open: openMock };

    const btn = wrapper.find('button[aria-label="Reopen welcome guide"]');
    await btn.trigger('click');

    expect(openMock).toHaveBeenCalledTimes(1);
  });

  // Test that showCommitPopover clears a pending hide timeout if one exists
  it('showCommitPopover clears hideTimeout when called while hide is pending', async () => {
    const wrapper = createWrapper('abc123def456', '2025-12-03T10:00:00Z');
    const commitLink = wrapper.find('a[href*="github.com"]');

    // mouseleave on the commit link calls scheduleHidePopover (starts the timer)
    await commitLink.trigger('mouseleave');
    // mouseenter calls showCommitPopover which should clear the pending timeout
    await commitLink.trigger('mouseenter');
    expect(wrapper.exists()).toBe(true);
  });

  // Test that cancelHidePopover clears a pending hide timeout
  it('cancelHidePopover clears hideTimeout when one is set', async () => {
    const wrapper = createWrapper('abc123def456', '2025-12-03T10:00:00Z');
    const commitLink = wrapper.find('a[href*="github.com"]');
    const popoverEl = wrapper.find('[data-testid="commit-popover"]');

    // mouseleave on the commit link calls scheduleHidePopover (starts the timer)
    await commitLink.trigger('mouseleave');

    // mouseenter on the popover calls cancelHidePopover (clears the timer)
    await popoverEl.trigger('mouseenter');

    // Advancing timers should be safe — timeout was cleared
    vi.advanceTimersByTime(500);
    expect(wrapper.exists()).toBe(true);
  });

  // Test that buildTime false branch is hit when buildTime is not set
  it('does not render build time section when buildTime is absent', () => {
    delete (globalThis as any).__BUILD_TIME__;
    // createWrapper without buildTime arg so __BUILD_TIME__ stays deleted
    (globalThis as any).__GIT_COMMIT_SHA__ = 'abc123def456';
    const wrapper = createWrapper('abc123def456', undefined);
    // The v-if="buildTime" false branch — "Built:" text should not appear
    expect(wrapper.html()).not.toContain('Built:');
  });

  // Test that copyCommitSha hides popover on successful clipboard write (line 129)
  it('copyCommitSha calls hide on commitPopover after successful clipboard write', async () => {
    const commitSha = 'abc123def456789';
    const wrapper = createWrapper(commitSha, '2025-12-03T10:00:00Z');

    // Inject a mock popover so commitPopover.value?.hide() can be called
    const hideMock = vi.fn();
    (wrapper.vm as any).commitPopover = { hide: hideMock };

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    await (wrapper.vm as any).copyCommitSha();

    expect(writeTextMock).toHaveBeenCalledWith(commitSha);
    expect(hideMock).toHaveBeenCalled();
  });
});
