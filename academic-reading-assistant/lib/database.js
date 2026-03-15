// lib/database.js
// Вспомогательные функции для работы с базой терминов

window.TermDatabase = {
  // Загружает базу (уже есть в content.js, но можно вынести сюда)
  load: async function() {
    try {
      const resp = await fetch(chrome.runtime.getURL('data/terms-database.json'));
      this.data = await resp.json();
    } catch {
      this.data = { scientific_terms: {}, idioms_slang: {}, academic_phrases: {} };
    }
    return this.data;
  },

  // Поиск термина по точному совпадению
  findExact: function(word) {
    const all = [];
    for (let cat in this.data) {
      for (let key in this.data[cat]) {
        all.push(this.data[cat][key]);
      }
    }
    return all.filter(t => t.term.toLowerCase() === word.toLowerCase());
  },

  // Поиск с учётом словоформ (заглушка)
  findWithMorph: function(word) {
    // Здесь можно использовать nlp.js
    return this.findExact(word);
  }
};