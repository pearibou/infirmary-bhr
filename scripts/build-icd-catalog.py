"""Build FY2027 public search data from the official CMS code-description ZIP.
Usage: python scripts/build-icd-catalog.py PATH_TO_ZIP
See data/ICD10-NOTICE.md for the pinned accessible source and verification limits.
No patient input is read or migrated.
"""
import hashlib,json,re,sys,zipfile
from pathlib import Path
archive=Path(sys.argv[1])
expected='91c6c9d1117764ce72375a0f3a5493b1725dafbc1ab283b55799076c9e194965'
assert hashlib.sha256(archive.read_bytes()).hexdigest()==expected,'Unexpected source archive; verify before updating pin'
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None,'Corrupt ZIP'
    names={Path(n).name:n for n in z.namelist() if n.endswith('.txt')}
    raw={name:z.read(names[name]) for name in ['icd10cm_codes_2027.txt','icd10cm_order_2027.txt','icd10cm_codes_addenda_2027.txt']}
entries={}
for line in raw['icd10cm_codes_2027.txt'].decode('utf-8-sig').splitlines():
    code,title=line.split(None,1)
    assert re.fullmatch(r'[A-Z][A-Z0-9]{2,6}',code) and title.strip() and code not in entries
    entries[code]=title.strip()
order={}
for line in raw['icd10cm_order_2027.txt'].decode('utf-8-sig').splitlines():
    if line[14]=='1':
        code=line[6:13].strip();assert code not in order
        order[code]=line[77:].strip()
assert entries==order,'Reporting codes/descriptions differ between source files'
for line in raw['icd10cm_codes_addenda_2027.txt'].decode('utf-8-sig').splitlines():
    if line.startswith('Add:'):assert line.split()[1] in entries
    if line.startswith('Delete:'):assert line.split()[1] not in entries
assert len(entries)==74879,len(entries)
assert entries['I10']=='Essential (primary) hypertension'
assert entries['E119']=='Type 2 diabetes mellitus without complications'
assert 'I420' not in entries and entries['I4200']=='Dilated cardiomyopathy, unspecified'
assert 'U071' in entries and 'E11' not in entries
result={'edition':'ICD-10-CM FY2027, October 1 release','effectiveFrom':'2026-10-01','effectiveThrough':'2027-09-30','sourceUrl':'https://www.cms.gov/files/zip/2027-code-descriptions-tabular-order.zip','sourceMirror':'https://github.com/openemr/openemr/blob/0779d64b8fcd112bdccddd83d689b0200f5f0a4c/contrib/icd10/2027-code-descriptions-in-tabular-order.zip','sourceRevision':'0779d64b8fcd112bdccddd83d689b0200f5f0a4c','archiveSha256':expected,'sourceSha256':{n:hashlib.sha256(b).hexdigest() for n,b in raw.items()},'entries':[[code[:3]+'.'+code[3:] if len(code)>3 else code,title] for code,title in sorted(entries.items())]}
old=json.loads(Path('data/icd10cm-2026-april.json').read_text()) if Path('data/icd10cm-2026-april.json').exists() else None
if old:
    previous=dict(old['entries']);current=dict(result['entries']);print(json.dumps({'previous':len(previous),'current':len(current),'added':len(current.keys()-previous.keys()),'removed':len(previous.keys()-current.keys()),'revisedDescriptions':sum(previous[c]!=current[c] for c in previous.keys()&current.keys())}))
Path('data/icd10cm-2027.json').write_text(json.dumps(result,separators=(',',':'),ensure_ascii=False)+'\n')
print(len(entries),'verified public reporting codes')
