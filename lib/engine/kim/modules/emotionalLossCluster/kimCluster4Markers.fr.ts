/**
 * Kim Cluster 4 — FR Markers
 * HOOP-K01, SCHAAM-K01, ROUW-K01, ISOL-K01
 * Note: Use (?:\b|\s|$|[,.]|') instead of trailing \b after accented characters
 */

// ─── HOOP-K01 ─────────────────────────────────────────────────────────────────

export const FR_HOOP_MARKERS: RegExp[] = [
  /\bquand est-ce que [cç]a suffit\b/i,
  /\bje ne sais (?:plus|pas) si [cç]a (?:a encore|vaut) (?:un )?sens/i,
  /\bje perds (?:tout )?espoir/i,
  /\bje n'ai plus d'espoir/i,
  /\bcombien de temps (?:dois-je|je dois) (?:encore )?tenir/i,
  /\bje n'en peux plus/i,
  /\bje suis fatigu[ée]e? d'esp[ée]rer/i,
  /\bje n'y crois plus/i,
  /\b[cç]a n'a plus de sens/i,
  /\bj'abandonne/i,
  /\bje ne sais pas si (?:il|elle) changera jamais/i,
  /\bpeut-[eê]tre (?:que )?je devrais (?:arr[eê]ter|partir|abandonner)/i,
  /\bet si [cç]a ne s'am[ée]liore jamais/i,
  /\bje suis [ée]puis[ée]e? d'attendre/i,
];

// ─── SCHAAM-K01 ───────────────────────────────────────────────────────────────

export const FR_SCHAAM_MARKERS: RegExp[] = [
  /\bj'ai honte de (?:son|sa) (?:addiction|d[ée]pendance)(?:\b|\s|$|[,.])/i,
  /\bje n'ose pas (?:le )?dire [àa] (?:ma famille|mes amis)/i,
  /\bje le cache [àa] tout le monde/i,
  /\bje mens [àa] (?:ma famille|mes amis)/i,
  /\bj'invente des excuses pour (?:lui|elle)/i,
  /\bje ne veux pas que (?:les gens|quelqu'un) (?:le )?sache(?:nt)?/i,
  /\bj'ai peur qu'ils (?:me|le|la) jugent/i,
  /\bje me retire parce que j'ai honte/i,
  /\bje ne vais plus nulle part parce que j'ai honte/i,
  /\bque vont penser les gens/i,
  /\bje me sens responsable de son comportement/i,
];

// ─── ROUW-K01 ─────────────────────────────────────────────────────────────────

export const FR_ROUW_MARKERS: RegExp[] = [
  /\b(?:il|elle) me manque comme (?:il|elle) [ée]tait avant/i,
  /\bje fais le deuil de (?:celui|celle) qu'(?:il|elle) [ée]tait/i,
  /\bj'ai l'impression de l'avoir perdu(?:e)? alors qu'(?:il|elle) est encore (?:vivant|vivante)(?:\b|\s|$|[,.])/i,
  /\bnotre ancienne relation me manque/i,
  /\bla fa[cç]on dont c'[ée]tait avant me manque/i,
  /\bje fais le deuil de l'avenir/i,
  /\bj'avais imagin[ée] une autre vie/i,
  /\bj'ai perdu quelqu'un qui est encore l[àa](?:\b|\s|$|[,.])/i,
  /\bl'addiction a chang[ée] notre relation/i,
  /\bje fais le deuil de nous/i,
  /\bmon partenaire me manque/i,
  /\bla s[ée]curit[ée] que nous avions me manque/i,
];

// ─── ISOL-K01 ─────────────────────────────────────────────────────────────────

export const FR_ISOL_MARKERS: RegExp[] = [
  /\bje ne vois plus personne/i,
  /\bje ne parle plus [àa] mes amis/i,
  /\bje n'ai plus de vie sociale/i,
  /\bje me suis isol[ée]e?(?:\b|\s|$|[,.])/i,
  /\bje suis compl[èe]tement seule? avec [cç]a/i,
  /\bje n'ai plus d'[ée]nergie pour les gens/i,
  /\bj'annule tout/i,
  /\bje ne vais plus nulle part/i,
  /\ble r[oô]le d'aidant(?:e)? prend toute la place/i,
  /\bson (?:addiction|d[ée]pendance) prend toute ma vie/i,
  /\bsa d[ée]pendance prend toute ma vie/i,
  /\bje n'ai plus de temps pour moi/i,
  /\bj'ai perdu mes propres contacts/i,
  /\bje ne sais plus comment laisser entrer les gens/i,
  /\bje n'ose plus voir personne/i,
  /\bje me cache de tout le monde/i,
  /\bje n'ai personne [àa] qui parler de [cç]a/i,
];
