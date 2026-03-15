// popup.js - ПРОСТАЯ ВЕРСИЯ

document.addEventListener('DOMContentLoaded', function() {
  console.log('✅ Popup загружен');
  
  // Загружаем количество терминов из background
  chrome.runtime.sendMessage({ action: 'getGlossary' }, function(response) {
    if (response && response.glossary) {
      document.getElementById('glossaryCount').textContent = response.glossary.length;
    }
  });
  
  // Кнопка открытия боковой панели
  document.getElementById('openSidebar').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'openSidebar'}, function(response) {
          if (chrome.runtime.lastError) {
            alert('Откройте страницу с текстом и обновите её');
          }
        });
      }
    });
  });
  
  // Кнопка настроек
  document.getElementById('openOptions').addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
  
  // Кнопка экспорта (временно отключена)
  document.getElementById('exportCSV').addEventListener('click', function() {
    alert('Функция экспорта временно отключена');
  });
});