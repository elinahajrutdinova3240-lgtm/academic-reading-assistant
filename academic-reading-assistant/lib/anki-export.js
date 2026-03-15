// lib/anki-export.js
// Функции экспорта в Anki (используются в background)

window.AnkiExport = {
  toCSV: function(glossary) {
    let csv = 'Term,Definition,Translation,Example\n';
    glossary.forEach(t => {
      csv += `"${t.term}","${t.definition}","${t.translation}","${t.example}"\n`;
    });
    return csv;
  },

  // Для более продвинутого экспорта можно генерировать .apkg, но это сложно.
  // Ограничимся CSV.
};