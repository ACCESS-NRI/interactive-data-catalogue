import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import CMIP7QuickLinks from '../CMIP7QuickLinks.vue';

describe('CMIP7QuickLinks', () => {
  it.each([
    ['cmip7_australian', 'ACCESS submissions'],
    ['cmip7_replicas', 'ESGF replicas'],
  ])('opens the %s datastore from the landing page', async (name, label) => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'Home', component: { template: '<div />' } },
        { path: '/datastore/:name', name: 'DatastoreDetail', component: { template: '<div />' } },
      ],
    });
    await router.push('/');
    await router.isReady();

    const wrapper = mount(CMIP7QuickLinks, { global: { plugins: [router] } });
    const link = wrapper.findAll('a').find((item) => item.text().includes(label));

    expect(link?.attributes('href')).toBe(`/datastore/${name}`);
    await link?.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('DatastoreDetail');
    expect(router.currentRoute.value.params.name).toBe(name);
  });
});
