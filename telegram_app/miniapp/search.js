(() => {
  'use strict';
  const words = value => String(value || '').toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim().split(/\s+/).filter(Boolean);
  const roots = [
    [/^(семг|лосос)/u,'семг'], [/^кревет/u,'кревет'], [/^сырник/u,'сырник'],
    [/^(капуч|каппуч)/u,'капучино'], [/^(латте|латэ)$/u,'латте'],
    [/^авокад/u,'авокадо'], [/^шоколад/u,'шоколад'], [/^вишн/u,'вишн'],
    [/^кури/u,'кури'], [/^блин/u,'блин'], [/^панкейк/u,'блин'],
    [/^кофе/u,'coffee'], [/^чай$/u,'tea']
  ];
  const canonical = word => roots.find(([pattern]) => pattern.test(word))?.[1] || word;
  const ignored = new Set(['хочу','покажи','пожалуйста','мне','с','и','на']);
  function distance(a,b) {
    let row = Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++) {
      const next=[i];
      for(let j=1;j<=b.length;j++) next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));
      row=next;
    }
    return row[b.length];
  }
  const tokens = item => {
    const raw = words([item.title,item.description,item.group,item.profile?.summary,
      ...(item.profile?.directions || [])].filter(Boolean).join(' '));
    return [...new Set([...raw,...raw.map(canonical)])];
  };
  function search(items,query) {
    const terms=words(query).filter(term=>!ignored.has(term)).map(canonical);
    if(!terms.length) return {items,approximate:false};
    const indexed=items.map(item=>({item,tokens:tokens(item)}));
    const contains=(term,word)=>word.includes(term);
    const exact=indexed.filter(entry=>terms.every(term=>entry.tokens.some(word=>contains(term,word))));
    if(exact.length) return {items:exact.map(entry=>entry.item),approximate:false};
    const near=indexed.filter(entry=>terms.every(term=>entry.tokens.some(word=>contains(term,word) ||
      (term.length>=4 && Math.abs(word.length-term.length)<=1 && distance(term,word)<=1))));
    return {items:near.map(entry=>entry.item),approximate:near.length>0};
  }
  window.KoritsaSearch={search};
})();
