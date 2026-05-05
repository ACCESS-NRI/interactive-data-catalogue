import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import Button from 'primevue/button';
import GithubFeedbackButton from '../GithubFeedbackButton.vue';

const { captureMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
}));

vi.mock('../../composables/usePosthog', () => ({
  usePostHog: () => ({ capture: captureMock }),
}));

describe('GithubFeedbackButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createWrapper = () =>
    mount(GithubFeedbackButton, {
      global: {
        components: { Button },
      },
    });

  it('renders the feedback button label and title', () => {
    const wrapper = createWrapper();

    expect(wrapper.text()).toContain('Give us feedback');
    expect(wrapper.find('button').attributes('title')).toBe('Open a new issue pre-filled with the feedback template');
  });

  it('opens the feedback issue template in a new tab and tracks the click', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const wrapper = createWrapper();

    await wrapper.find('button').trigger('click');

    expect(captureMock).toHaveBeenCalledWith('feedback_button_clicked');
    expect(openSpy).toHaveBeenCalledWith(
      'https://github.com/access-nri/interactive-data-catalogue/issues/new?template=feedback.yml',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('clears opener on the opened window when available', async () => {
    const openedWindow = { opener: 'not-null' } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(openedWindow);
    const wrapper = createWrapper();

    await wrapper.find('button').trigger('click');

    expect(openedWindow.opener).toBeNull();
  });
});
