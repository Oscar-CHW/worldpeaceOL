/**
 * Language selector component for the 天下太平 website
 * Allows users to switch between available languages
 */

import i18n from './i18n.js';

/**
 * Creates and initializes a language selector dropdown
 * @param {string} containerId - ID of the container element for the language selector
 */
function createLanguageSelector(containerId = 'language-selector') {
  // Get container element
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container element with ID "${containerId}" not found.`);
    return;
  }
  
  // Get available languages
  const languages = i18n.getAvailableLanguages();
  const currentLang = i18n.getCurrentLanguage();
  
  // Create selector element
  const selectorWrapper = document.createElement('div');
  selectorWrapper.className = 'language-selector-wrapper';
  
  // Create dropdown
  const select = document.createElement('select');
  select.id = 'language-select';
  select.className = 'language-select';
  
  // Add options for each language
  Object.entries(languages).forEach(([code, name]) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = name;
    option.selected = code === currentLang;
    select.appendChild(option);
  });
  
  // Add change event listener
  select.addEventListener('change', (e) => {
    const newLang = e.target.value;
    i18n.setLanguage(newLang);
  });
  
  // Create language label
  const label = document.createElement('label');
  label.htmlFor = 'language-select';
  label.className = 'language-label';
  label.textContent = 'Language: ';
  
  // Append elements
  selectorWrapper.appendChild(label);
  selectorWrapper.appendChild(select);
  container.appendChild(selectorWrapper);
  
  // Style the language selector
  const style = document.createElement('style');
  style.textContent = `
    .language-selector-wrapper {
      display: flex;
      align-items: center;
      margin: 10px 0;
    }
    
    .language-label {
      margin-right: 8px;
      font-size: 14px;
    }
    
    .language-select {
      padding: 4px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background-color: white;
      font-size: 14px;
    }
    
    .language-select:focus {
      outline: none;
      border-color: #4a69bd;
    }
  `;
  document.head.appendChild(style);
}

export { createLanguageSelector }; 