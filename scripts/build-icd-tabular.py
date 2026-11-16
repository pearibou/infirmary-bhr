"""Build public FY2027 tabular browsing data from user-supplied official CDC ZIPs.
Usage: python scripts/build-icd-tabular.py TABLE_AND_INDEX.zip CODE_DESCRIPTIONS.zip
No patient data is read. Every reporting code must reconcile with both sources.
"""
import hashlib,json,sys,zipfile,xml.etree.ElementTree as ET
from pathlib import Path
archive,codes_archive=map(Path,sys.argv[1:3]);catalog=json.loads(Path('data/icd10cm-2027.json').read_text());reporting=dict(catalog['entries'])
with zipfile.ZipFile(codes_archive) as z:
    assert z.testzip() is None
    member=next(n for n in z.namelist() if n.endswith('icd10cm-codes-2027.txt'))
    raw_codes=z.read(member);confirmed={}
    for line in raw_codes.decode('utf-8-sig').splitlines():
        code,title=line.split(None,1);code=code[:3]+'.'+code[3:] if len(code)>3 else code
        assert code not in confirmed;confirmed[code]=title.strip()
    assert confirmed==reporting,'Uploaded CDC descriptions do not match shipped reporting codes'
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    member=next(n for n in z.namelist() if n.endswith('icd10cm-tabular_-2027.xml'))
    raw=z.read(member);assert b'<!ENTITY' not in raw and b'<!DOCTYPE' not in raw
    root=ET.fromstring(raw)
assert root.tag=='ICD10CM.tabular' and root.findtext('version')=='2027'
notes_tags=['notes','includes','inclusionTerm','excludes1','excludes2','codeFirst','useAdditionalCode','codeAlso','sevenChrNote']
nodes=[];ids=set();by_compact={};extensions={}
def notes(el):
    result=[]
    for tag in notes_tags:
        for group in el.findall(tag):
            for item in group.findall('note'):
                text=' '.join(''.join(item.itertext()).split())
                if text:result.append([tag,text])
    for group in el.findall('sevenChrDef'):
        for item in group.findall('extension'):result.append(['sevenChrDef',item.attrib['char']+' — '+' '.join(''.join(item.itertext()).split())])
    return result

def add(id,parent,code,title,el=None):
    assert id not in ids;ids.add(id);nodes.append([id,parent,code,reporting.get(code,title),notes(el) if el is not None else []])

def diag(el,parent,inherited=None):
    code=el.findtext('name');definition=el.find('sevenChrDef')
    chars={item.attrib['char'] for item in definition.findall('extension')} if definition is not None else inherited
    add(code,parent,code,el.findtext('desc'),el);by_compact[code.replace('.','')]=code;extensions[code]=chars
    for child in el.findall('diag'):diag(child,code,chars)
for chapter in root.findall('chapter'):
    chapter_id='chapter:'+chapter.findtext('name');add(chapter_id,None,'',chapter.findtext('desc'),chapter)
    for block in chapter.findall('section'):
        block_id='block:'+block.attrib['id'];add(block_id,chapter_id,'',block.findtext('desc'),block)
        for el in block.findall('diag'):diag(el,block_id)
for code,title in reporting.items():
    if code in ids:continue
    compact=code.replace('.','');parent=next((by_compact[compact[:n]] for n in range(len(compact)-1,2,-1) if compact[:n] in by_compact),None)
    assert parent and compact[-1] in (extensions[parent] or set()),('Missing tabular parent/extension',code,parent)
    assert parent.replace('.','').ljust(6,'X')+compact[-1]==compact,(code,parent)
    add(code,parent,code,title)
assert len(reporting)==74879 and all(c in ids for c in reporting)
assert all(parent is None or parent in ids for _,parent,_,_,_ in nodes)
result={'edition':catalog['edition'],'effectiveFrom':catalog['effectiveFrom'],'effectiveThrough':catalog['effectiveThrough'],'sourceUrl':'https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/2027/icd10cm-table-and-index-2027.zip','archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'xmlSha256':hashlib.sha256(raw).hexdigest(),'codesArchiveSha256':hashlib.sha256(codes_archive.read_bytes()).hexdigest(),'codesSha256':hashlib.sha256(raw_codes).hexdigest(),'reportableCount':len(reporting),'nodes':nodes}
Path('data/icd10cm-tabular-2027.json').write_text(json.dumps(result,separators=(',',':'),ensure_ascii=False)+'\n')
print(json.dumps({'nodes':len(nodes),'chapters':len(root.findall('chapter')),'reportable':len(reporting),'nodesWithNotes':sum(bool(n[4]) for n in nodes),'bytes':Path('data/icd10cm-tabular-2027.json').stat().st_size}))
