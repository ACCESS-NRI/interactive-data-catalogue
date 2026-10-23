import { ref } from 'vue';

const STORAGE_KEY = 'catalogue-theme';

export const isDarkMode = ref(false);

export function initializeTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEY);
  isDarkMode.value =
    savedTheme === 'dark' ||
    (savedTheme !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true);
  document.documentElement.classList.toggle('dark', isDarkMode.value);
}

export function toggleTheme() {
  isDarkMode.value = !isDarkMode.value;
  document.documentElement.classList.toggle('dark', isDarkMode.value);
  localStorage.setItem(STORAGE_KEY, isDarkMode.value ? 'dark' : 'light');
}
