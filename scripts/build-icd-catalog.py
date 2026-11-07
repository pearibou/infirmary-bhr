"""Build public leaf-code search data from a pinned CDC-tabular mirror.
Usage: python scripts/build-icd-catalog.py PATH_TO_SIMPLE_ICD_10_CM_CHECKOUT
No patient input is read. See data/ICD10-NOTICE.md for provenance.
"""
import hashlib,json,re,sys,xml.etree.ElementTree as ET
from pathlib import Path
source=Path(sys.argv[1])/'all-data/2026-04'
xml=source/'icd10c-tabular-April-1-2026.xml';codes=source/'icd10cm-codes-April-1-2026.txt'
confirmed={line.strip() for line in codes.read_text().splitlines() if re.fullmatch(r'[A-Z][0-9][A-Z0-9]{1,5}',line.strip())}
entries={}
def walk(node,inherited=None):
    definitions=node.find('sevenChrDef')
    extensions={item.attrib['char']:item.text for item in definitions.findall('extension')} if definitions is not None else inherited
    name=node.findtext('name','').replace('.','');description=node.findtext('desc','');children=node.findall('diag')
    if not children:
        if extensions and len(name)<7:
            for suffix,label in extensions.items():
                code=name.ljust(6,'X')+suffix
                if code in confirmed:entries[code]=description+', '+label
        elif name in confirmed:entries[name]=description
    for child in children:walk(child,extensions)
root=ET.parse(xml).getroot()
for chapter in root.findall('chapter'):
    for section in chapter.findall('section'):
        for diag in section.findall('diag'):walk(diag)
assert len(entries)>70000,len(entries)
assert entries['I10']=='Essential (primary) hypertension'
result={'edition':'ICD-10-CM FY2026, April 1 update','effectiveFrom':'2026-04-01','effectiveThrough':'2026-09-30','sourceRevision':'4a7d11a5eafe6dff3017520adcb8b523ff71ff8d','sourceSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [xml,codes]},'entries':[[code[:3]+'.'+code[3:] if len(code)>3 else code,title] for code,title in sorted(entries.items())]}
Path('data/icd10cm-2026-april.json').write_text(json.dumps(result,separators=(',',':'),ensure_ascii=False)+'\n')
print(len(entries),'public leaf codes')
