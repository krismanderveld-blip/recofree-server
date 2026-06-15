/**
 * STOA-K FR Markers — French marker patterns for stoic reflective framework detection
 * Note: Use (?:\b|\s|^) and (?:\b|\s|$|[,\.]) for word boundaries around accented chars
 */

export const FR_STOA_K_CONTROL_DISTINCTION: RegExp[] = [
  /je ne peux pas (?:le|la) changer/i,
  /je ne peux pas (?:contr[oô]ler|controler) (?:son|sa) (?:comportement|gu[eé]rison)/i,
  /je ne sais plus ce que je peux (?:encore\s+)?faire/i,
  /qu.est.ce que je peux (?:encore\s+)?faire/i,
  /qu.est.ce qui (?:d[eé]pend|reste) (?:encore\s+)?de moi/i,
  /quelle est ma responsabilit[eé]/i,
  /qu.est.ce qui n.est pas ma responsabilit[eé]/i,
  /qu.est.ce que je (?:peux|ne peux pas) influencer/i,
];

export const FR_STOA_K_CONTROL_LOOP: RegExp[] = [
  /je continue [àa] (?:essayer de\s+)?(?:le|la) contr[oô]ler/i,
  /je continue [àa] tout (?:g[eé]rer|prendre en charge)/i,
  /j.essaie de diriger ses choix/i,
  /je n.arrive pas [àa] l[aâ]cher le contr[oô]le/i,
  /je sais que je ne peux pas (?:le|la) sauver mais je continue/i,
];

export const FR_STOA_K_LETTING_GO: RegExp[] = [
  /comment l[aâ]cher prise/i,
  /comment (?:le|la) laisser aller sans (?:l.)?abandonner/i,
  /l[aâ]cher prise (?:donne l.impression|semble|revient [àa]) (?:d.)?abandonner/i,
  /accepter (?:donne l.impression|semble|revient [àa]) (?:d.)?abandonner/i,
  /je veux rester impliqu[eé]e? sans me perdre/i,
  /je veux prendre soin sans sauver/i,
];

export const FR_STOA_K_VALUES: RegExp[] = [
  /quelles sont mes valeurs/i,
  /comment rester fid[eè]le [àa] moi.m[eê]me/i,
  /quel genre de (?:partenaire|parent) je veux [eê]tre/i,
  /quel est mon compas/i,
  /[àa] partir de quoi je veux agir/i,
  /comment agir selon mes valeurs/i,
  /je veux rester calme sans devenir froid/i,
];

export const FR_STOA_K_ACCEPTANCE: RegExp[] = [
  /comment accepter ce que je ne peux pas changer/i,
  /comment accepter sans approuver/i,
  /l.acceptation ressemble [àa] (?:de\s+)?l.indiff[eé]rence/i,
  /je ne veux pas devenir indiff[eé]rent/i,
  /je veux de la paix sans repousser mes [eé]motions/i,
  /je ne veux pas devenir dur/i,
  /je veux rester impliqu[eé]e? sans contr[oô]le/i,
];

export const FR_STOA_K_BOUNDARY_CONTROL: RegExp[] = [
  /une limite (?:est\s+)?(?:quelque chose\s+)?que je (?:fais|pose)/i,
  /limites sans contr[oô]le/i,
  /quelle est ma limite/i,
  /quelle limite (?:m.aide|me convient)/i,
];

export const FR_STOA_K_RESPONSIBILITY: RegExp[] = [
  /quelle est ma responsabilit[eé] et (?:qu.est.ce qui ne l.est pas|quelle ne l.est pas)/i,
  /o[uù] s.arr[eê]te ma responsabilit[eé]/i,
  /je ne suis pas responsable de (?:son|sa) (?:gu[eé]rison|choix|comportement)/i,
  /s[eé]parer (?:les\s+)?responsabilit[eé]s/i,
];

export const FR_STOA_K_DEEPER_REFLECTION: RegExp[] = [
  /sto[ïi]cien(?:ne)? (?:regarder|r[eé]fl[eé]chir|penser)/i,
  /r[eé]fl[eé]chir (?:plus\s+)?profond[eé]ment (?:sur|au) (?:contr[oô]le|l[aâ]cher prise|valeurs)/i,
  /comment vivre avec ce que je ne peux pas contr[oô]ler/i,
];

export const FR_STOA_K_FAST_GROUNDING: RegExp[] = [
  /donne.moi (?:vite\s+)?quelque chose (?:de\s+)?sto[ïi](?:que|cien)/i,
  /j.ai besoin (?:vite\s+)?de (?:me\s+)?calmer/i,
  /(?:vite|rapidement) (?:ancrage|calmer)/i,
];
