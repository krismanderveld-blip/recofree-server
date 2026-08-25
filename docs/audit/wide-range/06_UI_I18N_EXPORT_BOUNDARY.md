# Laag 6 — UI, i18n en exports

**Status:** Conditional pass. I18n en exportservices zijn getest; meerdere schermen en native interacties missen gerichte device-/componenttests.

De i18n-completeness test controleert gelijke NL/EN/FR keys. Behandelaar-export heeft nu afzonderlijke lokale opslag en share-acties met unittests. Export/import wordt end-to-end met encryptie getest.[1] [2]

| Risico | Ernst | Actie |
|---|---|---|
| Day Planning, GDPR Consent en Proposal History ongetest | P1/P2 | Gerichte component-/flowtests |
| Native filepicker/share sheet alleen gemockt | P1 | Eén APK-deviceprotocol |
| Silent taal/storage fallback | P2 | Debugreden en gebruikersfeedback |
| Wizardinhoud kan taal van document volgen | P2 | Gebruikerstaal als expliciete outputcontracttest |

## References

[1]: ../../../__tests__/i18n-completeness.test.ts "I18n completeness"
[2]: ../../../__tests__/vspInsight/vspInsightFileExport.test.ts "Behandelaar-export tests"
[3]: ../../../__tests__/exportImport/encryptedExportImport.acceptance.test.ts "Encrypted export/import"

