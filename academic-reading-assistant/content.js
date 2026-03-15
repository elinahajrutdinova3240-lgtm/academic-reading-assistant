// content.js - ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ

window.highlightedTerms = [];
window.glossary = [];
window.translatedTerms = {}; // Кэш для переведённых терминов

// Загрузка базы терминов
async function loadTermDatabase() {
  try {
    console.log('Попытка загрузки базы терминов...');
    const url = chrome.runtime.getURL('data/terms-database.json');
    console.log('URL базы:', url);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ошибка! статус: ${response.status}`);
    }
    
    window.termDatabase = await response.json();
    console.log('✅ База терминов успешно загружена!');
    console.log('📊 Статистика базы:');
    console.log('- Научных терминов:', Object.keys(window.termDatabase.scientific_terms || {}).length);
    console.log('- Сленг/идиом:', Object.keys(window.termDatabase.idioms_slang || {}).length);
    console.log('- Академических фраз:', Object.keys(window.termDatabase.academic_phrases || {}).length);
    
    const sampleTerm = Object.values(window.termDatabase.scientific_terms || {})[0];
    if (sampleTerm) {
      console.log('Пример термина:', sampleTerm.term, '->', sampleTerm.translation);
    }
  } catch (error) {
    console.error('❌ Ошибка загрузки базы терминов:', error);
    window.termDatabase = {
      scientific_terms: {},
      idioms_slang: {},
      academic_phrases: {}
    };
    console.log('✅ Используется пустая база, будет работать автоперевод');
  }
}

// ===== ФУНКЦИЯ АВТОПЕРЕВОДА =====
async function translateWord(word) {
  // Проверяем кэш
  if (window.translatedTerms[word]) {
    return window.translatedTerms[word];
  }
  
  // Не переводим короткие слова
  if (word.length < 3) return null;
  
  try {
    console.log('🔄 Перевод слова:', word);
    
    // Используем бесплатный Google Translate API
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&dt=bd&dj=1&q=${encodeURIComponent(word)}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data && data.sentences && data.sentences.length > 0) {
      const translation = data.sentences[0].trans;
      
      // Получаем определение если есть
      let definition = '';
      if (data.dict && data.dict.length > 0) {
        definition = data.dict[0].terms?.join(', ') || data.dict[0].pos || '';
      }
      
      const termData = {
        term: word,
        definition: definition || `Перевод: ${translation}`,
        translation: translation,
        example: `"${word}" — ${translation}`,
        category: 'auto',
        autoTranslated: true
      };
      
      // Сохраняем в кэш
      window.translatedTerms[word] = termData;
      console.log('✅ Переведено:', word, '->', translation);
      
      return termData;
    }
  } catch (error) {
    console.log('❌ Ошибка перевода:', error);
  }
  
  return null;
}

// ===== ФУНКЦИЯ ДЛЯ НОРМАЛИЗАЦИИ СЛОВ =====
function normalizeWord(word) {
  // Приводим к нижнему регистру
  let normalized = word.toLowerCase();
  
  // Убираем окончания для лучшего поиска
  const endings = ['ing', 'ed', 's', 'es', 'ly'];
  for (let ending of endings) {
    if (normalized.endsWith(ending) && normalized.length > ending.length + 2) {
      normalized = normalized.slice(0, -ending.length);
    }
  }
  
  return normalized;
}

// ===== ФУНКЦИЯ ДЛЯ АВТОМАТИЧЕСКОГО ПЕРЕВОДА ВСЕХ СЛОВ =====
async function translateAllWords() {
  console.log('🌍 Начинаю перевод всех слов на странице...');
  
  // Получаем весь текст
  const text = document.body.innerText;
  
  // Разбиваем на слова (только английские слова длиной >= 3 букв)
  const words = text.match(/\b[a-zA-Z]{3,}\b/g) || [];
  const uniqueWords = [...new Set(words)].slice(0, 100); // Первые 100 уникальных слов
  
  console.log(`📝 Найдено ${uniqueWords.length} уникальных слов для перевода`);
  
  let translated = 0;
  
  // Переводим по одному с задержкой
  for (const word of uniqueWords) {
    // Проверяем, нет ли уже в базе
    const inDatabase = Object.values(getAllTermsFromDatabase()).some(t => 
      t.term.toLowerCase() === word.toLowerCase()
    );
    
    if (!inDatabase && !window.translatedTerms[word]) {
      const result = await translateWord(word);
      if (result) translated++;
      // Небольшая задержка чтобы не заблокировали API
      await new Promise(r => setTimeout(r, 300));
    }
  }
  
  console.log(`✅ Перевод завершён, переведено ${translated} новых слов, обновляю страницу...`);
  processPageText();
  
  return translated;
}

// ===== ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ВСЕХ ТЕРМИНОВ ИЗ БАЗЫ =====
function getAllTermsFromDatabase() {
  const all = {};
  for (const cat in window.termDatabase) {
    for (const key in window.termDatabase[cat]) {
      const term = window.termDatabase[cat][key];
      all[term.term.toLowerCase()] = term;
    }
  }
  return all;
}

// ===== ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ВСЕХ ТЕРМИНОВ =====
function getAllTerms() {
  const all = {};
  
  // Загружаем личные переводы из хранилища
  if (!window.customTranslations) {
    window.customTranslations = {};
    chrome.storage.local.get(['customTranslations'], (result) => {
      window.customTranslations = result.customTranslations || {};
    });
  }
  
  // Термины из базы
  for (const cat in window.termDatabase) {
    for (const key in window.termDatabase[cat]) {
      const term = window.termDatabase[cat][key];
      all[term.term.toLowerCase()] = term;
      
      // Добавляем нормализованные версии (без окончаний)
      const normalized = normalizeWord(term.term);
      if (normalized !== term.term.toLowerCase()) {
        all[normalized] = term;
      }
      
      // Добавляем вариант без 'ing' если есть
      if (term.term.toLowerCase().endsWith('ing')) {
        const withoutIng = term.term.toLowerCase().slice(0, -3);
        if (withoutIng.length > 2) {
          all[withoutIng] = term;
        }
      }
      
      // Добавляем вариант без 'ed' если есть
      if (term.term.toLowerCase().endsWith('ed')) {
        const withoutEd = term.term.toLowerCase().slice(0, -2);
        if (withoutEd.length > 2) {
          all[withoutEd] = term;
        }
      }
      
      // Добавляем вариант без 's' если есть
      if (term.term.toLowerCase().endsWith('s') && !term.term.toLowerCase().endsWith('ss')) {
        const withoutS = term.term.toLowerCase().slice(0, -1);
        if (withoutS.length > 2) {
          all[withoutS] = term;
        }
      }
    }
  }
  
  // Добавляем личные переводы (они имеют приоритет)
  for (const word in window.customTranslations) {
    const term = window.customTranslations[word];
    all[word.toLowerCase()] = term;
    
    // Добавляем варианты для личных переводов
    const normalized = normalizeWord(word);
    if (normalized !== word.toLowerCase()) {
      all[normalized] = term;
    }
  }
  
  // Добавляем переведённые термины
  for (const word in window.translatedTerms) {
    if (!all[word.toLowerCase()]) {
      all[word.toLowerCase()] = window.translatedTerms[word];
    }
  }
  
  return all;
}

// ===== ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ТЕКСТОВЫХ УЗЛОВ (ИСПРАВЛЕНО) =====
function getTextNodes() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: node => {
        if (node.parentElement.tagName === 'SCRIPT' ||
            node.parentElement.tagName === 'STYLE' ||
            node.parentElement.classList.contains('academic-term')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}

function shouldSkipNode(el) {
  return ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME'].includes(el.tagName);
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightTerms(text) {
  let result = text;
  const allTerms = getAllTerms();

  for (const termKey in allTerms) {
    const termData = allTerms[termKey];
    const term = termData.term;
    const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi');
    
    if (regex.test(text)) {
      const colorClass = termData.autoTranslated ? 'auto-translated-term' :
                        (termData.category === 'scientific' ? 'scientific-term' :
                        termData.category === 'informal' ? 'slang-term' : 'academic-term');
      
      result = result.replace(regex, match => {
        const id = `term-${Date.now()}-${Math.random()}`;
        window.highlightedTerms.push({ id, term: match, data: termData });
        
        const termDataStr = JSON.stringify(termData).replace(/"/g, '&quot;');
        return `<span class="academic-term ${colorClass}" data-term-id="${id}" data-term='${termDataStr}'>${match}</span>`;
      });
    }
  }
  
  return result;
}

// ===== ФУНКЦИЯ ОБРАБОТКИ СТРАНИЦЫ =====
function processPageText() {
  console.log('🔍 Поиск терминов на странице...');
  const textNodes = getTextNodes();
  console.log('Найдено текстовых узлов:', textNodes.length);
  
  textNodes.forEach(node => {
    const parent = node.parentNode;
    if (parent && !shouldSkipNode(parent)) {
      const text = node.textContent;
      const processed = highlightTerms(text);
      if (processed !== text) {
        const span = document.createElement('span');
        span.innerHTML = processed;
        parent.replaceChild(span, node);
      }
    }
  });
  
  console.log('✅ Выделено терминов:', window.highlightedTerms.length);
  updateStatistics(); // Теперь функция определена
}

// ===== ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ СТАТИСТИКИ (ДОБАВЛЕНО) =====
function updateStatistics() {
    const statsDiv = document.getElementById('stats-content');
    if (!statsDiv) return;
    
    chrome.runtime.sendMessage({ action: 'getStatistics' }, response => {
        const translatedCount = Object.keys(window.translatedTerms || {}).length;
        const customCount = Object.keys(window.customTranslations || {}).length;
        
        statsDiv.innerHTML = `
            <div class="stat-item">
                <span>📊 Обработано терминов:</span>
                <strong>${window.highlightedTerms?.length || 0}</strong>
            </div>
            <div class="stat-item">
                <span>📚 В глоссарии:</span>
                <strong>${response?.glossaryCount || 0}</strong>
            </div>
            <div class="stat-item">
                <span>🔄 Автопереведено:</span>
                <strong>${translatedCount}</strong>
            </div>
            <div class="stat-item">
                <span>📝 Личных переводов:</span>
                <strong>${customCount}</strong>
            </div>
            <div class="stat-item">
                <span>⏱️ Сэкономлено времени:</span>
                <strong>~${Math.round(((window.highlightedTerms?.length || 0) * 30) / 60)} мин</strong>
            </div>
        `;
    });
}

// ===== ФУНКЦИЯ ОБНОВЛЕНИЯ ГЛОССАРИЯ (ИСПРАВЛЕНО) =====
function updateGlossaryList() {
    const list = document.getElementById('glossary-list');
    if (!list) return;

    chrome.runtime.sendMessage({ action: 'getGlossary' }, response => {
        const glossary = response.glossary || [];
        if (glossary.length === 0) {
            list.innerHTML = '<p>📭 Пока нет сохранённых терминов</p>';
        } else {
            list.innerHTML = glossary.map(term => `
                <div class="glossary-item">
                    <strong>${term.term}</strong>
                    <p>${term.translation}</p>
                    <small>${term.category === 'scientific' ? 'научный' : 
                              term.category === 'informal' ? 'сленг' : 
                              term.category === 'auto' ? 'переведено' : 'академический'}</small>
                    <button class="remove-term" data-term="${term.term}">❌ Удалить</button>
                </div>
            `).join('');
            
            list.querySelectorAll('.remove-term').forEach(btn => {
                btn.addEventListener('click', e => {
                    const term = e.target.dataset.term;
                    chrome.runtime.sendMessage({ action: 'removeTerm', term });
                    updateGlossaryList();
                    showNotification('🗑️ Термин удалён');
                });
            });
        }
    });
}

// ===== ФУНКЦИЯ ДЛЯ ОТОБРАЖЕНИЯ ЛИЧНОГО СЛОВАРЯ =====
function updateMyWordsList() {
  const list = document.getElementById('mywords-list');
  if (!list) return;
  
  chrome.storage.local.get(['customTranslations'], (result) => {
    const customWords = result.customTranslations || {};
    
    if (Object.keys(customWords).length === 0) {
      list.innerHTML = '<p>📭 Пока нет личных переводов. Нажмите "✏️ Редактировать перевод" у любого слова, чтобы добавить.</p>';
      return;
    }
    
    list.innerHTML = Object.values(customWords).map(term => `
      <div class="glossary-item" style="border-left-color: #FF9800;">
        <strong>${term.term}</strong>
        <p><strong>Перевод:</strong> ${term.translation}</p>
        ${term.alternatives && term.alternatives.length ? 
          `<p><small>📚 Варианты: ${term.alternatives.join(', ')}</small></p>` : ''}
        ${term.definition ? `<p><small>📖 ${term.definition}</small></p>` : ''}
        <small>Добавлено: ${new Date(term.dateAdded).toLocaleDateString()}</small>
        <div style="display:flex; gap:5px; margin-top:8px;">
          <button class="edit-custom-term" data-term="${term.term}" style="flex:1; padding:5px; background:#2196F3; color:white; border:none; border-radius:4px;">✏️ Редактировать</button>
          <button class="remove-custom-term" data-term="${term.term}" style="flex:1; padding:5px; background:#ff4444; color:white; border:none; border-radius:4px;">🗑️ Удалить</button>
        </div>
      </div>
    `).join('');
    
    list.querySelectorAll('.edit-custom-term').forEach(btn => {
      btn.addEventListener('click', () => {
        const term = btn.dataset.term;
        showEditDialog(customWords[term]);
      });
    });
    
    list.querySelectorAll('.remove-custom-term').forEach(btn => {
      btn.addEventListener('click', () => {
        const term = btn.dataset.term;
        if (confirm(`Удалить "${term}" из словаря?`)) {
          chrome.storage.local.get(['customTranslations'], (result) => {
            const customTranslations = result.customTranslations || {};
            delete customTranslations[term];
            chrome.storage.local.set({ customTranslations }, () => {
              window.customTranslations = customTranslations;
              updateMyWordsList();
              processPageText();
              showNotification(`🗑️ "${term}" удалён`);
            });
          });
        }
      });
    });
  });
}

// ===== ФУНКЦИИ ДЛЯ УВЕДОМЛЕНИЙ =====
function showNotification(msg) {
  const notif = document.createElement('div');
  notif.className = 'academic-notification';
  notif.textContent = msg;
  notif.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    z-index: 10000;
    font-family: sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s;
  `;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
(async function() {
  await loadTermDatabase();
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

function init() {
  console.log('🔧 Инициализация расширения...');
  setTimeout(() => {
    processPageText();
    setupEventListeners();
    loadGlossaryFromStorage();
    
    // Добавляем кнопку для ручного перевода
    setTimeout(addTranslateButton, 2000);
    
    // Запускаем автоматический перевод через 5 секунд
    setTimeout(async () => {
      await translateAllWords();
    }, 5000);
  }, 500);
}

function loadGlossaryFromStorage() {
  chrome.runtime.sendMessage({ action: 'getGlossary' }, response => {
    if (response?.glossary) {
      window.glossary = response.glossary;
      updateGlossaryList();
    }
  });
}

function setupEventListeners() {
  document.addEventListener('mouseover', e => {
    const term = e.target.closest('.academic-term');
    if (term) showTooltip(e, term);
  });

  document.addEventListener('click', e => {
    const term = e.target.closest('.academic-term');
    if (term) {
      e.preventDefault();
      showSidebarWithTerm(term);
    }
  });

  document.addEventListener('mouseout', e => {
    if (!e.target.closest('.academic-tooltip')) removeTooltip();
  });
}

function showTooltip(event, element) {
  removeTooltip();
  
  let termData;
  try {
    termData = JSON.parse(element.dataset.term);
  } catch (e) {
    console.error('Ошибка парсинга данных термина:', e);
    return;
  }
  
  const tooltip = document.createElement('div');
  tooltip.className = 'academic-tooltip';
  
  const autoTranslatedBadge = termData.autoTranslated ? '<span style="background:#FF9800; color:white; padding:2px 8px; border-radius:12px; font-size:10px; margin-left:8px;">автоперевод</span>' : '';
  
  tooltip.innerHTML = `
    <div class="tooltip-header">
      <strong>${termData.term}</strong>
      <span class="term-category">${termData.category === 'scientific' ? 'научный' : 
                                    termData.category === 'informal' ? 'сленг' : 
                                    termData.category === 'auto' ? 'переведено' : 'академический'}${autoTranslatedBadge}</span>
    </div>
    <div class="tooltip-content">
      <p><strong>Определение:</strong> ${termData.definition || 'Не найдено'}</p>
      <p><strong>Перевод:</strong> ${termData.translation}</p>
      <p><strong>Пример:</strong> "${termData.example || termData.term}"</p>
    </div>
    <div class="tooltip-actions">
      <button class="save-term-btn">📚 Сохранить в глоссарий</button>
      <button class="edit-term-btn">✏️ Редактировать перевод</button>
      <button class="more-info-btn">ℹ️ Подробнее</button>
    </div>
  `;
  
  document.body.appendChild(tooltip);
  
  const rect = element.getBoundingClientRect();
  tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
  tooltip.style.left = `${rect.left + window.scrollX}px`;

  tooltip.querySelector('.save-term-btn').addEventListener('click', () => {
    saveTermToGlossary(termData);
    tooltip.remove();
  });
  
  tooltip.querySelector('.edit-term-btn').addEventListener('click', () => {
    showEditDialog(termData, element);
    tooltip.remove();
  });
  
  tooltip.querySelector('.more-info-btn').addEventListener('click', () => {
    showSidebarWithTerm(element);
    tooltip.remove();
  });
}

function removeTooltip() {
  const t = document.querySelector('.academic-tooltip');
  if (t) t.remove();
}

function showSidebarWithTerm(element) {
  if (!document.getElementById('academic-sidebar')) {
    createSidebar();
  }
  
  let termData;
  try {
    termData = JSON.parse(element.dataset.term);
  } catch (e) {
    console.error('Ошибка парсинга данных термина:', e);
    return;
  }
  
  updateSidebarContent(termData);
}

function createSidebar() {
  const sidebar = document.createElement('div');
  sidebar.id = 'academic-sidebar';
  sidebar.className = 'academic-sidebar';
  
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <h3>📚 Academic Reading Assistant</h3>
      <button class="close-sidebar">&times;</button>
    </div>
    <div class="sidebar-tabs">
      <button class="tab-btn active" data-tab="info">Информация</button>
      <button class="tab-btn" data-tab="glossary">Глоссарий</button>
      <button class="tab-btn" data-tab="mywords">📝 Мой словарь</button>
      <button class="tab-btn" data-tab="stats">Статистика</button>
    </div>
    <div class="sidebar-content" id="sidebar-content">
      <div class="tab-pane active" id="info-tab">
        <p>Нажмите на любой подсвеченный термин, чтобы увидеть подробности</p>
      </div>
      <div class="tab-pane" id="glossary-tab">
        <div id="glossary-list"></div>
      </div>
      <div class="tab-pane" id="mywords-tab">
        <div id="mywords-list"></div>
      </div>
      <div class="tab-pane" id="stats-tab">
        <div id="stats-content"></div>
      </div>
    </div>
    <div class="sidebar-footer">
      <button id="export-pdf" class="footer-btn">📄 Экспорт в PDF</button>
      <button id="export-anki" class="footer-btn">🃏 Экспорт в Anki</button>
      <button id="import-words" class="footer-btn" style="background:#FF9800;">📥 Импорт</button>
    </div>
  `;
  
  document.body.appendChild(sidebar);
  setupSidebarListeners(sidebar);
  updateGlossaryList();
  updateMyWordsList();
  updateStatistics();
}

function setupSidebarListeners(sidebar) {
  sidebar.querySelector('.close-sidebar').addEventListener('click', () => {
    sidebar.remove();
  });

  sidebar.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      sidebar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      sidebar.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      const tab = e.target.dataset.tab;
      document.getElementById(`${tab}-tab`).classList.add('active');
    });
  });

  sidebar.querySelector('#export-pdf').addEventListener('click', () => {
    exportGlossary('pdf');
  });

  sidebar.querySelector('#export-anki').addEventListener('click', () => {
    exportGlossary('anki');
  });

  sidebar.querySelector('#import-words').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          chrome.storage.local.get(['customTranslations'], (result) => {
            const current = result.customTranslations || {};
            const merged = { ...current, ...imported };
            chrome.storage.local.set({ customTranslations: merged }, () => {
              window.customTranslations = merged;
              updateMyWordsList();
              showNotification(`✅ Импортировано ${Object.keys(imported).length} слов`);
            });
          });
        } catch (err) {
          showNotification('❌ Ошибка в файле');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

function updateSidebarContent(termData) {
  const infoTab = document.getElementById('info-tab');
  
  const autoTranslatedBadge = termData.autoTranslated ? '<p><span style="background:#FF9800; color:white; padding:2px 8px; border-radius:12px;">автоматический перевод</span></p>' : '';
  
  infoTab.innerHTML = `
    <div class="term-detail">
      <h4>${termData.term}</h4>
      ${autoTranslatedBadge}
      <p><strong>Категория:</strong> ${termData.category === 'scientific' ? 'научный' : 
                                       termData.category === 'informal' ? 'сленг' : 
                                       termData.category === 'auto' ? 'переведено' : 'академический'}</p>
      <p><strong>Определение:</strong> ${termData.definition || 'Не найдено'}</p>
      <p><strong>Перевод на русский:</strong> ${termData.translation}</p>
      <p><strong>Пример:</strong> "${termData.example || termData.term}"</p>
      ${termData.synonyms ? `<p><strong>Синонимы:</strong> ${termData.synonyms.join(', ')}</p>` : ''}
      <button class="save-from-sidebar">📚 Сохранить в глоссарий</button>
    </div>
  `;
  
  infoTab.querySelector('.save-from-sidebar').addEventListener('click', () => {
    saveTermToGlossary(termData);
  });
}

function saveTermToGlossary(termData) {
  chrome.runtime.sendMessage({ action: 'saveTerm', term: termData }, response => {
    if (response?.success) {
      showNotification('✅ Термин сохранён!');
      updateGlossaryList();
    }
  });
}

function showEditDialog(termData, element) {
  // Создаём модальное окно
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 30px;
    border-radius: 15px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 100000;
    width: 400px;
    max-width: 90%;
    font-family: sans-serif;
  `;
  
  // Затемнение фона
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 99999;
  `;
  
  // Загружаем существующие переводы из хранилища
  chrome.storage.local.get(['customTranslations'], (result) => {
    const customTranslations = result.customTranslations || {};
    const existingData = customTranslations[termData.term] || termData;
    
    // Создаём форму
    dialog.innerHTML = `
      <h3 style="margin-top:0; color:#2196F3;">✏️ Редактировать перевод: "${termData.term}"</h3>
      
      <div style="margin-bottom:15px">
        <label style="display:block; margin-bottom:5px; font-weight:bold;">Перевод (основной):</label>
        <input id="edit-translation" type="text" value="${existingData.translation}" 
               style="width:100%; padding:8px; border:2px solid #ddd; border-radius:5px; font-size:14px;">
      </div>
      
      <div style="margin-bottom:15px">
        <label style="display:block; margin-bottom:5px; font-weight:bold;">Дополнительные переводы (через запятую):</label>
        <input id="edit-alternatives" type="text" value="${existingData.alternatives ? existingData.alternatives.join(', ') : ''}" 
               style="width:100%; padding:8px; border:2px solid #ddd; border-radius:5px; font-size:14px;" 
               placeholder="например: значение, смысл, толкование">
      </div>
      
      <div style="margin-bottom:15px">
        <label style="display:block; margin-bottom:5px; font-weight:bold;">Определение:</label>
        <textarea id="edit-definition" rows="3" style="width:100%; padding:8px; border:2px solid #ddd; border-radius:5px; font-size:14px;">${existingData.definition || ''}</textarea>
      </div>
      
      <div style="margin-bottom:20px">
        <label style="display:block; margin-bottom:5px; font-weight:bold;">Пример:</label>
        <textarea id="edit-example" rows="2" style="width:100%; padding:8px; border:2px solid #ddd; border-radius:5px; font-size:14px;">${existingData.example || ''}</textarea>
      </div>
      
      <div style="display:flex; gap:10px; justify-content:flex-end;">
        <button id="cancel-edit" style="padding:10px 20px; background:#f44336; color:white; border:none; border-radius:5px; cursor:pointer;">Отмена</button>
        <button id="save-edit" style="padding:10px 20px; background:#4CAF50; color:white; border:none; border-radius:5px; cursor:pointer;">Сохранить</button>
        ${existingData.custom ? '<button id="delete-word" style="padding:10px 20px; background:#ff9800; color:white; border:none; border-radius:5px; cursor:pointer;">🗑️ Удалить из словаря</button>' : ''}
      </div>
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
    
    // Обработчики
    document.getElementById('cancel-edit').onclick = () => {
      dialog.remove();
      overlay.remove();
    };
    
    document.getElementById('save-edit').onclick = () => {
      const translation = document.getElementById('edit-translation').value;
      const alternatives = document.getElementById('edit-alternatives').value.split(',').map(s => s.trim()).filter(s => s);
      const definition = document.getElementById('edit-definition').value;
      const example = document.getElementById('edit-example').value;
      
      // Сохраняем в личный словарь
      const updatedTerm = {
        ...termData,
        translation: translation,
        alternatives: alternatives,
        definition: definition,
        example: example,
        custom: true,
        dateAdded: new Date().toISOString()
      };
      
      chrome.storage.local.get(['customTranslations'], (result) => {
        const customTranslations = result.customTranslations || {};
        customTranslations[termData.term] = updatedTerm;
        
        chrome.storage.local.set({ customTranslations }, () => {
          // Обновляем кэш
          window.customTranslations = customTranslations;
          
          // Обновляем отображение
          dialog.remove();
          overlay.remove();
          
          showNotification(`✅ Перевод для "${termData.term}" сохранён!`);
          
          // Перезапускаем подсветку
          processPageText();
        });
      });
    };
    
    if (document.getElementById('delete-word')) {
      document.getElementById('delete-word').onclick = () => {
        if (confirm(`Удалить "${termData.term}" из личного словаря?`)) {
          chrome.storage.local.get(['customTranslations'], (result) => {
            const customTranslations = result.customTranslations || {};
            delete customTranslations[termData.term];
            
            chrome.storage.local.set({ customTranslations }, () => {
              window.customTranslations = customTranslations;
              
              dialog.remove();
              overlay.remove();
              
              showNotification(`🗑️ "${termData.term}" удалён из словаря`);
              processPageText();
            });
          });
        }
      };
    }
  });
}

function showAddWordDialog(word) {
  // Создаём модальное окно
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 30px;
    border-radius: 15px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 100000;
    width: 400px;
    max-width: 90%;
    font-family: sans-serif;
  `;
  
  // Затемнение фона
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 99999;
  `;
  
  dialog.innerHTML = `
    <h3 style="margin-top:0; color:#FF9800;">➕ Добавить слово в словарь: "${word}"</h3>
    
    <div style="margin-bottom:15px">
      <label style="display:block; margin-bottom:5px; font-weight:bold;">Перевод (основной):</label>
      <input id="new-translation" type="text" value="" 
             style="width:100%; padding:8px; border:2px solid #ddd; border-radius:5px; font-size:14px;" 
             placeholder="Введите перевод">
    </div>
    
    <div style="margin-bottom:15px">
      <label style="display:block; margin-bottom:5px; font-weight:bold;">Дополнительные переводы (через запятую):</label>
      <input id="new-alternatives" type="text" value="" 
             style="width:100%; padding:8px; border:2px solid #ddd; border-radius:5px; font-size:14px;" 
             placeholder="например: значение, смысл, толкование">
    </div>
    
    <div style="margin-bottom:15px">
      <label style="display:block; margin-bottom:5px; font-weight:bold;">Определение:</label>
      <textarea id="new-definition" rows="3" style="width:100%; padding:8px; border:2px solid #ddd; border-radius:5px; font-size:14px;" 
                placeholder="Введите определение (необязательно)"></textarea>
    </div>
    
    <div style="margin-bottom:20px">
      <label style="display:block; margin-bottom:5px; font-weight:bold;">Пример:</label>
      <textarea id="new-example" rows="2" style="width:100%; padding:8px; border:2px solid #ddd; border-radius:5px; font-size:14px;" 
                placeholder="Введите пример использования">"${word}"</textarea>
    </div>
    
    <div style="display:flex; gap:10px; justify-content:flex-end;">
      <button id="cancel-add" style="padding:10px 20px; background:#f44336; color:white; border:none; border-radius:5px; cursor:pointer;">Отмена</button>
      <button id="save-add" style="padding:10px 20px; background:#4CAF50; color:white; border:none; border-radius:5px; cursor:pointer;">Добавить</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  document.body.appendChild(dialog);
  
  document.getElementById('cancel-add').onclick = () => {
    dialog.remove();
    overlay.remove();
  };
  
  document.getElementById('save-add').onclick = () => {
    const translation = document.getElementById('new-translation').value;
    const alternatives = document.getElementById('new-alternatives').value.split(',').map(s => s.trim()).filter(s => s);
    const definition = document.getElementById('new-definition').value;
    const example = document.getElementById('new-example').value;
    
    if (!translation) {
      alert('Введите перевод!');
      return;
    }
    
    const newTerm = {
      term: word,
      translation: translation,
      alternatives: alternatives,
      definition: definition || `Перевод: ${translation}`,
      example: example || `"${word}" — ${translation}`,
      category: 'custom',
      custom: true,
      dateAdded: new Date().toISOString()
    };
    
    chrome.storage.local.get(['customTranslations'], (result) => {
      const customTranslations = result.customTranslations || {};
      customTranslations[word] = newTerm;
      
      chrome.storage.local.set({ customTranslations }, () => {
        window.customTranslations = customTranslations;
        
        dialog.remove();
        overlay.remove();
        
        showNotification(`✅ Слово "${word}" добавлено в словарь!`);
        processPageText();
      });
    });
  };
}

function addTranslateButton() {
  if (document.getElementById('translate-button')) return;
  
  const button = document.createElement('button');
  button.id = 'translate-button';
  button.innerHTML = '🌍 Перевести все слова';
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 50px;
    padding: 14px 28px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    transition: all 0.3s;
    border: 2px solid white;
  `;
  
  button.onmouseover = () => {
    button.style.transform = 'scale(1.05)';
    button.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
  };
  
  button.onmouseout = () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
  };
  
  button.onclick = async () => {
    button.innerHTML = '⏳ Перевод...';
    button.disabled = true;
    
    const count = await translateAllWords();
    
    button.innerHTML = `✅ Переведено ${count} слов!`;
    button.style.background = 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)';
    
    setTimeout(() => {
      button.remove();
    }, 3000);
  };
  
  document.body.appendChild(button);
}

function exportGlossary(type) {
  chrome.runtime.sendMessage({ action: 'exportGlossary', format: type === 'anki' ? 'csv' : 'txt' });
  showNotification(`📥 Экспорт в ${type === 'anki' ? 'Anki' : 'PDF'} начат`);
}

// ===== ОБРАБОТЧИК СООБЩЕНИЙ =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📩 Получено сообщение:', request.action);
  
  if (request.action === 'ping') {
    sendResponse({ pong: true });
    return true;
  }
  
  if (request.action === 'getProcessedCount') {
    sendResponse({ count: window.highlightedTerms?.length || 0 });
    return true;
  }
  
  if (request.action === 'openSidebar') {
    if (!document.getElementById('academic-sidebar')) {
      createSidebar();
    } else {
      document.getElementById('academic-sidebar').style.display = 'flex';
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'downloadFile') {
    const a = document.createElement('a');
    a.href = request.url;
    a.download = request.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(request.url), 100);
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'translatePage') {
    translateAllWords().then(count => {
      sendResponse({ count: count });
    });
    return true;
  }
  
  if (request.action === 'showAddWordDialog') {
    showAddWordDialog(request.word);
    sendResponse({ success: true });
    return true;
  }
  
  return true;
});

// Периодическое обновление статистики
setInterval(updateStatistics, 2000);

// Дополнительная обработка после полной загрузки страницы
window.addEventListener('load', () => {
  setTimeout(() => {
    console.log('🔄 Повторная обработка после load');
    processPageText();
  }, 1000);
});

console.log('✅ content.js полностью загружен');