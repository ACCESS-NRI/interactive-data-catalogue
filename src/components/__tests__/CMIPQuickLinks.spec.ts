import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import CMIPQuickLinks from '../CMIPQuickLinks.vue';

describe('CMIPQuickLinks', () => {
  it.each(['esmvaltool-obs-ct11'])('opens the %s datastore from the landing page', async (name) => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'Home', component: { template: '<div />' } },
        { path: '/cmip', name: 'CmipSearch', component: { template: '<div />' } },
        { path: '/datastore/:name', name: 'DatastoreDetail', component: { template: '<div />' } },
      ],
    });
    await router.push('/');
    await router.isReady();

    const wrapper = mount(CMIPQuickLinks, { global: { plugins: [router] } });
    const link = wrapper.findAll('a').find((item) => item.text().includes(name));

    expect(link?.attributes('href')).toBe(`/datastore/${name}`);
    await link?.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('DatastoreDetail');
    expect(router.currentRoute.value.params.name).toBe(name);
  });

  it('distinguishes the curated observation shortcut', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'Home', component: { template: '<div />' } },
        { path: '/cmip', name: 'CmipSearch', component: { template: '<div />' } },
        { path: '/datastore/:name', name: 'DatastoreDetail', component: { template: '<div />' } },
      ],
    });
    const wrapper = mount(CMIPQuickLinks, { global: { plugins: [router] } });
    const link = wrapper.findAll('a').find((item) => item.text().includes('esmvaltool-obs-ct11'));

    expect(link?.text()).toContain('CMIP curated observation product');
    expect(link?.classes()).toContain('bg-violet-50');
  });

  it('offers one card for both CMIP versions linking to the combined search', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/cmip', name: 'CmipSearch', component: { template: '<div />' } },
        { path: '/datastore/:name', name: 'DatastoreDetail', component: { template: '<div />' } },
      ],
    });
    await router.push('/');
    const wrapper = mount(CMIPQuickLinks, { global: { plugins: [router] } });
    const links = wrapper.findAll('a').filter((link) => link.text().includes('CMIP7'));
    expect(wrapper.findAll('a')).toHaveLength(2);
    expect(links).toHaveLength(1);
    expect(links[0]!.text()).toContain('CMIP6 and CMIP7');
    expect(links[0]!.text()).toContain('Search data held at NCI and international data on ESGF');
    await links[0]!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/cmip');
  });
});
