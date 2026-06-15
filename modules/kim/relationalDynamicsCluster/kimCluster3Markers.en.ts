/**
 * Kim Cluster 3 — EN Markers for ROL-K01, VETR02-K, LEUGEN-K01
 */

// ROL-K01: Suppressed emotions when care role drops
export const EN_ROL_K01_MARKERS: RegExp[] = [
  /now that (?:he|she) is (?:admitted|in treatment|stable).*(?:everything is coming|I feel|I collapse)/i,
  /now that (?:he|she) is stable.*I feel (?:how )?(?:exhausted|tired|empty)/i,
  /I have cared for so long that I lost myself/i,
  /I do not know who I am without caring/i,
  /when I do not have to (?:manage|care|fix).*I feel (?:empty|nothing)/i,
  /now that I do not have to fix anything.*I feel (?:anger|rage)/i,
  /I feel (?:grief|sad) now that there is finally (?:calm|peace|rest)/i,
  /I feel guilty that I (?:feel relieved|am angry|am relieved)/i,
  /everything I pushed away is coming (?:up|out) now/i,
  /I (?:swallowed|suppressed|pushed down) my emotions for (?:years|a long time)/i,
  /I was only caring anymore/i,
  /my caregiver role is falling away/i,
  /I (?:cannot stop crying|collapse) now that (?:he|she) (?:is safe|has help)/i,
  /now that (?:he|she) is in (?:detox|treatment|rehab).*I feel (?:empty|exhausted|angry)/i,
  /I put (?:everything|myself) aside for (?:him|her)/i,
  /who am I (?:really )?(?:if|when) I (?:do not|don't) (?:have to )?care/i,
];

// VETR02-K: Triggered hypervigilance/re-experiencing when partner absent/admitted
export const EN_VETR02_K_MARKERS: RegExp[] = [
  /(?:he|she) is (?:admitted|away|in treatment|in detox).*(?:keep checking|still check)/i,
  /the silence feels (?:unsafe|threatening|scary)/i,
  /I (?:keep|cannot stop) checking my phone/i,
  /when (?:he|she) (?:does not respond|is silent).*(?:panic|fear|alarm)/i,
  /I (?:get scared|become afraid) (?:of|with) (?:every|any) (?:silence|absence)/i,
  /his absence (?:triggers|activates) (?:me|something in me)/i,
  /her absence (?:triggers|activates) (?:me|something in me)/i,
  /I (?:relive|re-experience).*(?:before|then|that time)/i,
  /silence (?:meant|means) (?:always|often) (?:something is wrong|danger)/i,
  /I (?:do not trust|cannot trust) the (?:calm|quiet|peace)/i,
  /my body (?:keeps|is) (?:scanning|on alert|vigilant)/i,
  /I (?:cannot|will not) (?:relax|let go).*(?:admitted|away|absent)/i,
];

// LEUGEN-K01: Chronic lying / detective role
export const EN_LEUGEN_K01_MARKERS: RegExp[] = [
  /(?:he|she) lies (?:constantly|always|again|all the time)/i,
  /(?:he|she) keeps lying/i,
  /I do not know what is true anymore/i,
  /I do not trust (?:anything|him|her) anymore/i,
  /I check everything/i,
  /I check (?:his|her) (?:stories|phone|messages)/i,
  /I feel like a detective/i,
  /I (?:look|search) for proof/i,
  /I want to catch (?:him|her)/i,
  /(?:he|she) promises things and does something else/i,
  /(?:he|she) (?:twists|bends) the truth/i,
  /I am going crazy from the lies/i,
  /I want to believe but I (?:cannot|can't) anymore/i,
  /I am torn between hope and distrust/i,
  /everything feels like a lie/i,
  /I do not know if I can believe anything/i,
  /I do not want to control but I (?:still )?do it/i,
  /(?:he|she) (?:denies|lies|hides).*(?:while|but) I (?:know|see|feel)/i,
];
