/**
 * Kim Cluster 3 — NL Markers for ROL-K01, VETR02-K, LEUGEN-K01
 */

// ROL-K01: Suppressed emotions when care role drops
export const NL_ROL_K01_MARKERS: RegExp[] = [
  /nu (?:hij|zij) opgenomen is.*(?:komt alles|voel ik|stort ik)/i,
  /nu (?:hij|zij) stabiel is.*voel ik/i,
  /ik heb zo lang gezorgd dat ik mezelf kwijt ben/i,
  /ik weet niet wie ik ben zonder te zorgen/i,
  /als ik niet (?:moet|hoef te) (?:regelen|zorgen).*voel ik (?:leegte|niets)/i,
  /nu ik niets (?:moet|hoef te) oplossen.*voel ik (?:woede|boosheid)/i,
  /ik voel (?:verdriet|me verdrietig) nu er (?:eindelijk )?rust is/i,
  /ik voel me schuldig dat ik (?:opgelucht|boos|kwaad) ben/i,
  /alles wat ik heb weggeduwd komt nu (?:boven|naar boven)/i,
  /ik heb mijn emoties (?:jaren|lang) (?:ingeslikt|weggestopt|onderdrukt)/i,
  /ik was alleen nog maar aan het zorgen/i,
  /mijn zorgrol valt weg/i,
  /ik (?:kan niet meer stoppen met huilen|stort (?:pas )?in) nu (?:hij|zij) (?:veilig is|hulp heeft)/i,
  /nu (?:hij|zij) in (?:detox|behandeling|opname) is.*voel ik me (?:leeg|moe|boos)/i,
  /ik heb (?:alles|mezelf) opzij gezet voor (?:hem|haar)/i,
  /wie ben ik (?:eigenlijk )?als ik niet (?:meer )?(?:hoef te )?zorgen/i,
];

// VETR02-K: Triggered hypervigilance/re-experiencing when partner absent/admitted
export const NL_VETR02_K_MARKERS: RegExp[] = [
  /(?:hij|zij) is (?:opgenomen|weg|in behandeling|in detox).*(?:telefoon check|blijf ik (?:checken|controleren))/i,
  /de stilte voelt (?:onveilig|bedreigend|eng)/i,
  /ik (?:blijf|kan niet stoppen met) (?:mijn )?telefoon (?:checken|controleren)/i,
  /als (?:hij|zij) (?:niet reageert|stil is).*(?:paniek|angst|alarm)/i,
  /ik (?:schrik|word bang) (?:van|bij) (?:elke|iedere) (?:stilte|afwezigheid)/i,
  /zijn afwezigheid (?:triggert|activeert) (?:mij|iets in mij)/i,
  /haar afwezigheid (?:triggert|activeert) (?:mij|iets in mij)/i,
  /ik (?:herleef|herbeleef).*(?:vroeger|toen|die keer)/i,
  /stilte (?:betekende|betekent) (?:altijd|vaak) (?:dat er iets mis|gevaar)/i,
  /ik (?:vertrouw|geloof) de rust niet/i,
  /mijn lichaam (?:blijft|is) (?:scannen|op alert|waakzaam)/i,
  /ik (?:kan|wil) niet (?:ontspannen|loslaten).*(?:opgenomen|weg|afwezig)/i,
];

// LEUGEN-K01: Chronic lying / detective role
export const NL_LEUGEN_K01_MARKERS: RegExp[] = [
  /(?:hij|zij) liegt (?:constant|altijd|weer|steeds)/i,
  /(?:hij|zij) blijft liegen/i,
  /ik weet niet meer wat waar is/i,
  /ik vertrouw (?:niets|hem|haar) (?:niet )?meer/i,
  /ik controleer alles/i,
  /ik check (?:zijn|haar) (?:verhalen|telefoon|berichten)/i,
  /ik voel me (?:een|als een) detective/i,
  /ik zoek bewijs/i,
  /ik wil (?:hem|haar) betrappen/i,
  /(?:hij|zij) belooft (?:dingen|het) en doet (?:iets )?anders/i,
  /(?:hij|zij) draait rond de waarheid/i,
  /ik word (?:gek|stapelgek) van de leugens/i,
  /ik wil geloven maar ik kan niet meer/i,
  /ik ben heen en weer tussen hoop en wantrouwen/i,
  /alles voelt als een leugen/i,
  /ik weet niet of ik nog iets kan geloven/i,
  /ik wil niet controleren maar ik doe het toch/i,
  /(?:hij|zij) (?:ontkent|liegt|verzwijgt).*(?:terwijl|maar) ik (?:weet|zie|voel)/i,
];
