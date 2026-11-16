# Public ICD-10-CM FY2027 catalog

This folder contains public classification data only. Patient diagnoses, queries and charts are never saved here.

Edition: **ICD-10-CM FY2027, October 1 release**, effective October 1, 2026–September 30, 2027, subject to later official updates. It is the U.S. diagnosis classification (CM), not the procedure classification (PCS). The catalog contains **74,879 reporting codes**; nonreportable parent categories are excluded.

## Sources and reproducibility

- CDC/NCHS release information: https://www.cdc.gov/nchs/icd/icd-10-cm/files.html
- CMS release information: https://www.cms.gov/medicare/coding-billing/icd-10-codes
- Original CMS archive URL: https://www.cms.gov/files/zip/2027-code-descriptions-tabular-order.zip
- Accessible source copy: https://github.com/openemr/openemr/blob/0779d64b8fcd112bdccddd83d689b0200f5f0a4c/contrib/icd10/2027-code-descriptions-in-tabular-order.zip
- Pinned archive SHA-256: `91c6c9d1117764ce72375a0f3a5493b1725dafbc1ab283b55799076c9e194965`.

Run `python scripts/build-icd-catalog.py /path/to/2027-code-descriptions-in-tabular-order.zip`. The builder checks the pinned hash, ZIP integrity, code uniqueness, valid shapes, nonempty descriptions, and exact agreement of every reporting code and full description between `icd10cm_codes_2027.txt` and reporting rows in `icd10cm_order_2027.txt`. It checks the published 74,879 total, addition/deletion membership from the included addendum, representative existing/new codes and exclusion of parent categories. The JSON records source URLs, revision, archive hash and source-file hashes.

Verified on November 16, 2026: official CDC/CMS pages establish release dates; the published FY2027 total is also documented in the federal final rule (https://www.govinfo.gov/content/pkg/FR-2026-08-04/pdf/2026-15833.pdf). Direct CDC/CMS archive downloads were blocked by this workspace's network policy. Therefore the archive was obtained from the pinned OpenEMR source copy; no direct byte-for-byte comparison with an independently downloaded government archive was possible. Hash pinning establishes reproducibility of that copy, not independent government authentication of its bytes.

Compared with the prior bundled 74,706-code April 2026 catalog: 203 codes added, 30 absent, and 123 differing descriptions among shared codes. These are differences from that old bundled catalog, not a claim that its completeness or generated titles exactly matched the official prior release. FY2026 data is no longer shipped.

## Search and historical records

Search is entirely local: exact/dotted/undotted code matches rank first; text search expands curated common abbreviations and everyday terms, supports prefixes and bounded spelling corrections, ignores filler words, and ranks related matches below complete matches. Spelling/partial and related results are labeled and require explicit selection. Clinical qualifiers such as without, laterality, acute/chronic and type numbers are retained. This does not provide the full tabular instructions or automatically determine a diagnosis or billing validity.

Saved spreadsheet rows keep their original code, official description and edition. Older codes, including codes no longer selectable in FY2027, remain readable/editable/printable without lookup or automatic recoding. The public search catalog is the only data replaced; no patient-sheet migration occurs. Public code files can be cached; search text stays in session memory and is never sent to a lookup service.

The underlying classification data is a U.S. government publication. The retained ICD10-MIRROR-LICENSE.txt documents the previous catalog's mirror attribution; that mirror is no longer the source of the shipped catalog.
