import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import RequiredProjectsWarning from '../RequiredProjectsWarning.vue';

describe('RequiredProjectsWarning', () => {
  // Helper to create wrapper with tooltip directive stubbed
  const createWrapper = (props: any) => {
    return mount(RequiredProjectsWarning, {
      props,
      global: {
        directives: {
          tooltip: {}, // Stub the PrimeVue tooltip directive
        },
      },
    });
  };

  // Test that the component renders when projects array has items
  it('renders warning when projects are provided', () => {
    const wrapper = createWrapper({
      projects: ['xp65', 'dk92'],
    });

    expect(wrapper.html()).toBeTruthy();
    expect(wrapper.text()).toContain('Required Project Access:');
  });

  // Test that the component does not render when projects array is empty
  it('does not render when no projects', () => {
    const wrapper = createWrapper({
      projects: [],
    });

    expect(wrapper.text()).toBe('');
  });

  // Test that all project codes are displayed as clickable badges
  it('renders all project codes', () => {
    const wrapper = createWrapper({
      projects: ['xp65', 'dk92', 'ab12'],
    });

    expect(wrapper.text()).toContain('xp65');
    expect(wrapper.text()).toContain('dk92');
    expect(wrapper.text()).toContain('ab12');
    const projectSpans = wrapper.findAll('span').filter((span) => span.classes().includes('px-2'));
    expect(projectSpans.length).toBe(3 + 1);
    // Extra span for the conda warning now
  });

  // Test that singular "project" text is used when only one project
  it('uses singular "project" when only one project', () => {
    const wrapper = createWrapper({
      projects: ['xp65'],
    });

    expect(wrapper.text()).toContain('following project:');
    expect(wrapper.text()).not.toContain('projects:');
  });

  // Test that plural "projects" text is used when multiple projects
  it('uses plural "projects" when multiple projects', () => {
    const wrapper = createWrapper({
      projects: ['xp65', 'dk92'],
    });

    expect(wrapper.text()).toContain('following projects:');
  });

  // Test that clicking a project badge opens the correct NCI join URL
  it('opens correct NCI join URL when project is clicked', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const wrapper = createWrapper({
      projects: ['xp65', 'dk92'],
    });

    const projectSpans = wrapper.findAll('span').filter((span) => span.classes().includes('px-2'));
    projectSpans[0]!.trigger('click');

    expect(openSpy).toHaveBeenCalledWith('https://my.nci.org.au/mancini/project/xp65/join', '_blank');

    openSpy.mockRestore();
  });

  // Test that each project badge opens its own specific URL
  it('opens different URLs for different projects', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const wrapper = createWrapper({
      projects: ['xp65', 'dk92'],
    });

    const projectSpans = wrapper.findAll('span').filter((span) => span.classes().includes('px-2'));

    projectSpans[0]!.trigger('click');
    expect(openSpy).toHaveBeenCalledWith('https://my.nci.org.au/mancini/project/xp65/join', '_blank');

    projectSpans[1]!.trigger('click');
    expect(openSpy).toHaveBeenCalledWith('https://my.nci.org.au/mancini/project/dk92/join', '_blank');

    openSpy.mockRestore();
  });

  // Test that the info icon is displayed in the warning header
  it('renders info icon', () => {
    const wrapper = createWrapper({
      projects: ['xp65'],
    });

    const icon = wrapper.find('i.pi-info-circle');
    expect(icon.exists()).toBe(true);
  });

  // Test that project badges have the proper styling classes for visual appearance
  it('applies correct styling classes to project badges', () => {
    const wrapper = createWrapper({
      projects: ['xp65'],
    });

    const projectSpan = wrapper.findAll('span').filter((span) => span.classes().includes('px-2'))[0]!;
    expect(projectSpan.classes()).toContain('bg-yellow-100');
    expect(projectSpan.classes()).toContain('cursor-pointer');
    expect(projectSpan.classes()).toContain('font-mono');
  });
});
