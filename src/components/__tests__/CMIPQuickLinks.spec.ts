import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import CMIPQuickLinks from '../CMIPQuickLinks.vue';

describe('CMIPQuickLinks', () => {
  it.each(['cmip7_australian', 'cmip7_replicated', 'cmip6_fs38', 'cmip6_oi10'])(
    'opens the %s datastore from the landing page',
    async (name) => {
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [
          { path: '/', name: 'Home', component: { template: '<div />' } },
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
    },
  );
});
