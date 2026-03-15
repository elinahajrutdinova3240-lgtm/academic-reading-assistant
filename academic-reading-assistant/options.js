// options.js

document.addEventListener('DOMContentLoaded', () => {
  // Загружаем сохранённые настройки
  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || {
      highlightScientific: true,
      highlightSlang: true,
      highlightAcademic: true,
      showTooltips: true,
      autoSave: false
    };
    document.getElementById('highlightScientific').checked = settings.highlightScientific;
    document.getElementById('highlightSlang').checked = settings.highlightSlang;
    document.getElementById('highlightAcademic').checked = settings.highlightAcademic;
    document.getElementById('showTooltips').checked = settings.showTooltips;
    document.getElementById('autoSave').checked = settings.autoSave;
  });

  // Сохранение настроек
  document.getElementById('save').addEventListener('click', () => {
    const settings = {
      highlightScientific: document.getElementById('highlightScientific').checked,
      highlightSlang: document.getElementById('highlightSlang').checked,
      highlightAcademic: document.getElementById('highlightAcademic').checked,
      showTooltips: document.getElementById('showTooltips').checked,
      autoSave: document.getElementById('autoSave').checked
    };
    
    chrome.storage.local.set({ settings }, () => {
      const status = document.getElementById('status');
      status.textContent = '✅ Настройки сохранены!';
      setTimeout(() => status.textContent = '', 2000);
    });
  });
});