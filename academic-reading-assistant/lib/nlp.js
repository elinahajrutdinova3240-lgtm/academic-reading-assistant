// lib/nlp.js - простые NLP-функции

window.NLP = {
  // Очень простой стеммер (убирает окончания)
  stem: function(word) {
    return word.replace(/(ing|ed|s|es|ly)$/, '');
  },

  // Разбивка на слова
  tokenize: function(text) {
    return text.toLowerCase().match(/\b\w+\b/g) || [];
  },

  // Проверка, является ли слово сложным (по длине)
  isComplex: function(word) {
    return word.length > 8;
  }
};