/**
 * Kim Cluster 3 — FR Markers for ROL-K01, VETR02-K, LEUGEN-K01
 * Note: \b doesn't work after accented chars in JS regex, use (?:\b|\s|$|[,.])?
 */

// ROL-K01: Suppressed emotions when care role drops
export const FR_ROL_K01_MARKERS: RegExp[] = [
  /maintenant qu[''](?:il|elle) est (?:hospitalis|stabilis|admis).*tout (?:ressort|remonte)/i,
  /maintenant qu[''](?:il|elle) est stable.*je (?:sens|ressens)/i,
  /j['']ai tellement pris soin.*que je me suis perdu/i,
  /je ne sais plus qui je suis sans m['']occuper/i,
  /quand je n['']ai plus rien [aà] g[eé]rer.*je me sens vide/i,
  /maintenant que je ne dois plus tout r[eé]soudre.*je ressens de la col[eè]re/i,
  /je ressens de la tristesse maintenant qu['']il y a (?:enfin )?du calme/i,
  /je me sens coupable d[''][eê]tre (?:soulag[eé]e|en col[eè]re)/i,
  /tout ce que j['']ai repouss[eé] remonte maintenant/i,
  /j['']ai aval[eé] mes [eé]motions pendant des ann[eé]es/i,
  /je n[''][eé]tais plus qu['']en train de prendre soin/i,
  /mon r[oô]le d['']aidante dispara[iî]t/i,
  /je m['']effondre maintenant qu[''](?:il|elle) a de l['']aide/i,
  /maintenant qu[''](?:il|elle) est en (?:d[eé]tox|traitement).*je me sens (?:vide|[eé]puis[eé]e)/i,
];

// VETR02-K: Triggered hypervigilance/re-experiencing when partner absent/admitted
export const FR_VETR02_K_MARKERS: RegExp[] = [
  /(?:il|elle) est (?:hospitalis|admis|parti).*je (?:continue|n['']arr[eê]te pas) de v[eé]rifier/i,
  /le silence (?:me fait peur|est mena[cç]ant|semble dangereux)/i,
  /je (?:continue|n['']arr[eê]te pas) de v[eé]rifier mon t[eé]l[eé]phone/i,
  /quand (?:il|elle) ne r[eé]pond pas.*(?:panique|peur|alarme)/i,
  /son absence (?:me d[eé]clenche|active quelque chose)/i,
  /je (?:revis|r[eé]exp[eé]rimente).*(?:avant|alors|cette fois)/i,
  /le silence (?:signifiait|signifie) (?:toujours|souvent) (?:quelque chose|un danger)/i,
  /je ne (?:fais|peux) pas confiance au calme/i,
  /mon corps (?:reste|est) (?:en alerte|vigilant|aux aguets)/i,
  /je ne (?:peux|veux) pas me d[eé]tendre.*(?:hospitalis|parti|absent)/i,
];

// LEUGEN-K01: Chronic lying / detective role
export const FR_LEUGEN_K01_MARKERS: RegExp[] = [
  /(?:il|elle) ment (?:tout le temps|constamment|encore|toujours)/i,
  /(?:il|elle) continue [aà] mentir/i,
  /je ne sais plus ce qui est vrai/i,
  /je ne fais plus confiance [aà] rien/i,
  /je contr[oô]le tout/i,
  /je v[eé]rifie ses (?:histoires|messages)/i,
  /je me sens comme un(?:e)? d[eé]tective/i,
  /je cherche des preuves/i,
  /je veux (?:le|la) prendre sur le fait/i,
  /(?:il|elle) promet des choses et fait autre chose/i,
  /(?:il|elle) tourne autour de la v[eé]rit[eé]/i,
  /je deviens folle [aà] cause des mensonges/i,
  /je veux croire mais je n['']y arrive plus/i,
  /je suis partag[eé]e entre l['']espoir et la m[eé]fiance/i,
  /tout ressemble [aà] un mensonge/i,
  /je ne sais plus si je peux croire quelque chose/i,
  /je ne veux pas contr[oô]ler mais je le fais quand m[eê]me/i,
];
