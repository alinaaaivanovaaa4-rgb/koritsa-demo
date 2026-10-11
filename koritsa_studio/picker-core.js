/* Shared pure selection rules: used by the page and the scenario checks. */
((root) => {
  'use strict';
  const any = { id: 'any', label: 'Любой вариант', hint: 'Покажите все подходящие идеи.' };
  const moment = (data, id) => data.moments.find(entry => entry.id === id);
  const candidates = (data, answers, withFlavour = true) => {
    const current = moment(data, answers.moment);
    if (!current) return [];
    return data.items.filter(item => item.category === current.category &&
      (!answers.direction || answers.direction === 'any' || item.directions.includes(answers.direction)) &&
      (!withFlavour || !answers.flavour || answers.flavour === 'any' || item.flavours.includes(answers.flavour)));
  };
  const directions = (data, answers) => {
    const current = moment(data, answers.moment);
    if (!current) return [];
    const pool = candidates(data, { moment: current.id });
    return [...current.directions.filter(choice => pool.some(item => item.directions.includes(choice.id))), any];
  };
  const flavours = (data, answers) => {
    const current = moment(data, answers.moment);
    if (!current) return [];
    const pool = candidates(data, answers, false);
    return [...current.flavours.filter(choice =>
      (!choice.when || choice.when.includes(answers.direction)) && pool.some(item => item.flavours.includes(choice.id))), any];
  };
  const normalize = (data, input = {}) => {
    const clean = {};
    if (!moment(data, input.moment)) return clean;
    clean.moment = input.moment;
    if (!directions(data, clean).some(choice => choice.id === input.direction)) return clean;
    clean.direction = input.direction;
    if (flavours(data, clean).some(choice => choice.id === input.flavour)) clean.flavour = input.flavour;
    return clean;
  };
  const question = (data, input) => {
    const answers = normalize(data, input);
    const current = moment(data, answers.moment);
    if (!current) return { key: 'moment', number: 1, title: 'Какой будет ваша пауза?', hint: 'Начнём с того, чего хочется сейчас.', options: data.moments };
    if (!answers.direction) return { key: 'direction', number: 2, title: current.question, hint: 'Выберите то, что сегодня ближе по вкусу.', options: directions(data, answers) };
    if (answers.flavour) return null;
    const pool = candidates(data, answers, false);
    const options = flavours(data, answers);
    // Finish early when another question would not narrow the choice.
    const useful = options.filter(choice => choice.id !== 'any' && pool.filter(item => item.flavours.includes(choice.id)).length < pool.length);
    if (pool.length <= 1 || !useful.length) return null;
    return { key: 'flavour', number: 3, title: 'И какой вкус хочется?', hint: 'Последний штрих — и покажем ваши варианты.', options };
  };
  const results = (data, input, offset = 0) => {
    const answers = normalize(data, input);
    const current = moment(data, answers.moment);
    if (!current) return { pool: [], visible: [] };
    const order = new Map(current.featured.map((id, index) => [id, index]));
    const pool = candidates(data, answers).sort((a, b) =>
      (order.get(a.id) ?? current.featured.length + data.items.indexOf(a)) -
      (order.get(b.id) ?? current.featured.length + data.items.indexOf(b)));
    const start = ((offset % pool.length) + pool.length) % pool.length;
    return { pool, visible: pool.length ? Array.from({ length: Math.min(3, pool.length) }, (_, i) => pool[(start + i) % pool.length]) : [] };
  };
  const labels = (data, input) => {
    const answers = normalize(data, input);
    return [moment(data, answers.moment)?.label,
      answers.direction !== 'any' && directions(data, answers).find(choice => choice.id === answers.direction)?.label,
      answers.flavour !== 'any' && flavours(data, answers).find(choice => choice.id === answers.flavour)?.label].filter(Boolean);
  };
  const api = { moment, candidates, directions, flavours, normalize, question, results, labels };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.KoritsaPicker = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
