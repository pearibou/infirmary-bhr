"""Synthetic multi-page printing, escaping and sensitive-document cleanup."""
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(service_workers='block');prepare_test_page(page)
    page.goto('http://127.0.0.1:8000')
    page.wait_for_function("document.querySelector('#drive-dialog').open")
    original_title=page.title()
    names=page.evaluate("""async()=>{const {printFilenameTitle:f}=await import('./printing.js?v=0.31.1');const date=new Date(2026,10,5);return [f('Demographics',{lastName:'Smith',firstName:'John-Carrol'},date),f('Medication List',{lastName:'Smith',firstName:'John',middleName:'Carrol James'},date),f('Immunizations — Master list',null,date),f('Notes / Draft',{name:'Legacy Name'},date)];}""")
    assert names==['11-05-2026 - Smith, JC - Demographics','11-05-2026 - Smith, JCJ - Medication List','11-05-2026 - Immunizations — Master list','11-05-2026 - Legacy Name - Notes Draft']
    pending=[];release_logo=[False]
    def logo_route(route):
        if release_logo[0]:route.fulfill(content_type='image/png',body=Path('icons/icon-512.png').read_bytes())
        else:pending.append(route)
    page.route('**/icons/icon-512.png',logo_route)
    page.evaluate("""()=>{window.printJob=import('./printing.js?v=0.31.1').then(module=>module.printDocument({title:'Synthetic multi-page medications',person:{name:'Synthetic Patient',firstName:'Synthetic',lastName:'Patient',birthDate:{year:'1950',month:'1',day:'2'},allergies:'Synthetic allergy',demographics:{sex:'Male'}},sections:[{title:'Active medications',columns:['Medication','Dose / Route','Instructions','Indication / Prescriber','Dates'],rows:Array.from({length:80},(_,i)=>['Synthetic medicine '+i,i===0?'<script>window.injected=true</script>':'Synthetic dose','Synthetic instructions that wrap over multiple lines for print pagination.','Synthetic clinician and indication','2026-11-07'])}],retrievedAt:new Date().toISOString()}));}""")
    page.wait_for_function("document.querySelector('#bhr-print-frame')?.contentDocument?.querySelectorAll('tbody tr').length===80")
    page.evaluate("window.calls=0;document.querySelector('#bhr-print-frame').contentWindow.print=()=>window.calls++")
    page.wait_for_timeout(100);assert pending
    release_logo[0]=True
    while pending:pending.pop().fulfill(content_type='image/png',body=Path('icons/icon-512.png').read_bytes())
    page.wait_for_function('window.calls===1')
    date_prefix=page.evaluate("String(new Date().getMonth()+1).padStart(2,'0')+'-'+String(new Date().getDate()).padStart(2,'0')+'-'+new Date().getFullYear()")
    expected_title=date_prefix+' - Patient, S - Synthetic multi-page medications'
    assert page.frame_locator('#bhr-print-frame').locator('title').text_content()==expected_title
    assert page.title()==expected_title
    expected_age=page.evaluate('new Date().getFullYear()-1950-((new Date().getMonth()===0&&new Date().getDate()<2)?1:0)')
    identity=page.frame_locator('#bhr-print-frame').locator('.identity p').all_text_contents()
    assert identity[identity.index('Date of birth: 1 / 2 / 1950')+1]==f'{expected_age} y.o. Male'
    assert page.frame_locator('#bhr-print-frame').locator('thead th div').inner_text()==f'{expected_age} y.o. Male'
    assert page.frame_locator('#bhr-print-frame').locator('script').count()==0
    assert page.frame_locator('#bhr-print-frame').locator('table').evaluate('table=>table.getBoundingClientRect().right<=document.body.getBoundingClientRect().right')
    html=page.locator('#bhr-print-frame').evaluate('frame=>frame.contentDocument.documentElement.outerHTML')
    preview=browser.new_page(viewport={'width':720,'height':960});preview.set_content(html);preview.locator('header img').evaluate('image=>image.decode()');preview.emulate_media(media='print')
    assert preview.locator('table').evaluate('table=>table.getBoundingClientRect().right<=document.body.getBoundingClientRect().right')
    for format in ['Letter','A4']:
        preview.add_style_tag(content='@page{margin:0.5in}')
        path='/tmp/bhr-multipage-'+format+'.pdf';preview.pdf(path=path,format=format,display_header_footer=True)
        bounds=ET.fromstring(subprocess.check_output(['pdftotext','-bbox',path,'-']))
        ns={'p':'http://www.w3.org/1999/xhtml'}
        for paper in bounds.findall('.//p:page',ns):
            assert all(float(word.attrib['xMax'])<=float(paper.attrib['width'])-30 for word in paper.findall('.//p:word',ns) if 36<float(word.attrib['yMin'])<float(paper.attrib['height'])-36)
    preview.pdf(path='/tmp/bhr-multipage-print.pdf',format='Letter');preview.close()
    text=subprocess.check_output(['pdftotext','-layout','/tmp/bhr-multipage-print.pdf','-'],text=True)
    pages=[part for part in text.split('\f') if part.strip()];assert len(pages)>1
    assert all('Synthetic Patient' in part and 'Medication' in part and f'{expected_age} y.o. Male' in part for part in pages)
    assert 'Synthetic medicine 79' in text
    page.evaluate("document.querySelector('#bhr-print-frame').contentWindow.dispatchEvent(new Event('afterprint'))");assert page.locator('#bhr-print-frame').count()==0;assert page.title()==original_title
    release_logo[0]=False
    page.evaluate("""()=>{window.cancelledPrint=import('./printing.js?v=0.31.1').then(module=>module.printDocument({title:'Synthetic cancelled print',person:{name:'Synthetic patient'},sections:[]}).catch(error=>window.printError=error.message));}""")
    page.wait_for_function("document.querySelector('#bhr-print-frame')?.contentDocument?.body?.textContent.includes('Synthetic cancelled print')")
    page.evaluate("async()=>{const module=await import('./printing.js?v=0.31.1');module.clearPrint();}");assert page.locator('#bhr-print-frame').count()==0;assert page.title()==original_title
    for route in pending:route.fulfill(content_type='image/png',body=Path('icons/icon-512.png').read_bytes())
    browser.close()
print('PASS: multi-page PDF with repeated identity/column headers; complete content; escaped HTML; cleanup after print and cancellation')
