# Public ICD-10-CM catalog

This folder contains public classification data only. Patient conditions, queries and charts must never be saved here.

Edition: ICD-10-CM FY2026, April 1 update (effective April 1–September 30, 2026). This is a historical edition as of November 2026, not a claim to cover FY2027. The UI states this limitation and saved rows retain the edition. Update the public catalog deliberately when a newer verified release is obtained; never silently recode existing history entries.

Origin: CDC/NCHS, https://www.cdc.gov/nchs/icd/icd-10-cm/files.html . Source mirror: https://github.com/StefanoTrv/simple_icd_10_CM/tree/4a7d11a5eafe6dff3017520adcb8b523ff71ff8d/all-data/2026-04 . The mirror notes removal of one empty instructional XML node. Code descriptions come from tabular descriptions; seventh-character descriptions are expanded using the published extension definitions and confirmed code list. Nonselectable parent categories are excluded. The catalog contains 74,706 selectable leaf codes, including U07.1.

Reproduce with `python scripts/build-icd-catalog.py /path/to/pinned/source/checkout`. The JSON includes source revision and SHA-256 hashes. The source code list, tabular XML and mirror attribution are used to build descriptions; neither a condition-search API nor third-party tracking is used at runtime. This is a diagnosis lookup, not automated clinical coding, reimbursement validation or a substitute for tabular coding instructions.

The mirror is distributed under the MIT License; see ICD10-MIRROR-LICENSE.txt. CDC's U.S. government classification publication is the underlying data source.
