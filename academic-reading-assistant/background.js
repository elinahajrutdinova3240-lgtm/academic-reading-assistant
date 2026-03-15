// background.js - ИСПРАВЛЕННАЯ ВЕРСИЯ

// ===== ПРОВЕРКА ДОСТУПНОСТИ API =====
if (!chrome.contextMenus) {
  console.error('❌ chrome.contextMenus недоступен! Проверьте permissions в manifest.json');
}

// ===== ОБЪЕДИНЁННЫЙ ОБРАБОТЧИК УСТАНОВКИ =====
chrome.runtime.onInstalled.addListener((details) => {
  console.log('🔄 Расширение установлено/обновлено');
  
  // Создаём контекстное меню (только если API доступен)
  if (chrome.contextMenus) {
    chrome.contextMenus.create({
      id: 'add-to-dictionary',
      title: '📚 Добавить в словарь',
      contexts: ['selection']
    }, () => {
      if (chrome.runtime.lastError) {
        console.log('⚠️ Меню уже существует:', chrome.runtime.lastError);
      } else {
        console.log('✅ Контекстное меню создано');
      }
    });
  }
  
  // Инициализация хранилища при установке
  if (details.reason === 'install') {
    chrome.storage.local.set({
      glossary: [],
      customTranslations: {},
      settings: {
        highlightScientific: true,
        highlightSlang: true,
        highlightAcademic: true,
        showTooltips: true,
        autoSave: false
      }
    }, () => {
      console.log('✅ Хранилище инициализировано');
    });
  }
});

// Обработка клика по контекстному меню
if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    console.log('🖱️ Клик по меню:', info);
    
    if (info.menuItemId === 'add-to-dictionary' && info.selectionText) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'showAddWordDialog',
        word: info.selectionText.trim()
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('⚠️ Не удалось отправить сообщение в content.js:', chrome.runtime.lastError);
        }
      });
    }
  });
}

// Обработка сообщений
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📩 Получено сообщение:', request.action);
  
  switch (request.action) {
    case 'getGlossary':
      chrome.storage.local.get(['glossary'], (result) => {
        sendResponse({ glossary: result.glossary || [] });
      });
      return true;

    case 'saveTerm':
      saveTerm(request.term);
      sendResponse({ success: true });
      break;

    case 'removeTerm':
      removeTerm(request.term);
      sendResponse({ success: true });
      break;

    case 'getSettings':
      chrome.storage.local.get(['settings'], (result) => {
        sendResponse({ settings: result.settings });
      });
      return true;

    case 'saveSettings':
      chrome.storage.local.set({ settings: request.settings }, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'getStatistics':
      chrome.storage.local.get(['glossary', 'customTranslations'], (result) => {
        sendResponse({
          glossaryCount: (result.glossary || []).length,
          customCount: Object.keys(result.customTranslations || {}).length
        });
      });
      return true;

    case 'exportGlossary':
      console.log('📤 Экспорт запрошен');
      sendResponse({ success: true });
      break;
      
    case 'getCustomTranslations':
      chrome.storage.local.get(['customTranslations'], (result) => {
        sendResponse({ customTranslations: result.customTranslations || {} });
      });
      return true;
      
    case 'saveCustomTranslation':
      saveCustomTranslation(request.term, request.data);
      sendResponse({ success: true });
      break;
      
    case 'removeCustomTranslation':
      removeCustomTranslation(request.term);
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ error: 'Неизвестное действие' });
      break;
  }
});

function saveTerm(term) {
  chrome.storage.local.get(['glossary'], (result) => {
    let glossary = result.glossary || [];
    if (!glossary.some(item => item.term === term.term)) {
      glossary.push({ ...term, dateAdded: new Date().toISOString() });
      chrome.storage.local.set({ glossary });
      console.log('✅ Термин сохранён в глоссарий:', term.term);
    }
  });
}

function removeTerm(term) {
  chrome.storage.local.get(['glossary'], (result) => {
    let glossary = (result.glossary || []).filter(item => item.term !== term);
    chrome.storage.local.set({ glossary });
    console.log('✅ Термин удалён из глоссария:', term);
  });
}

function saveCustomTranslation(term, data) {
  chrome.storage.local.get(['customTranslations'], (result) => {
    let customTranslations = result.customTranslations || {};
    customTranslations[term] = data;
    chrome.storage.local.set({ customTranslations });
    console.log('✅ Личный перевод сохранён:', term);
  });
}

function removeCustomTranslation(term) {
  chrome.storage.local.get(['customTranslations'], (result) => {
    let customTranslations = result.customTranslations || {};
    delete customTranslations[term];
    chrome.storage.local.set({ customTranslations });
    console.log('✅ Личный перевод удалён:', term);
  });
}

console.log('✅ background.js полностью загружен');