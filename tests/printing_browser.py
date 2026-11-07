"""Synthetic multi-page printing, escaping and sensitive-document cleanup."""
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(service_workers='block');prepare_test_page(page)
    page.goto('http://127.0.0.1:8000')
    pending=[];page.route('**/icons/abbey-letterhead.png',lambda route:pending.append(route))
    page.evaluate("""()=>{window.printJob=import('./printing.js?v=0.10.0').then(module=>module.printDocument({title:'Synthetic multi-page medications',person:{name:'Synthetic Patient',firstName:'Synthetic',lastName:'Patient',birthDate:{year:'1950',month:'1',day:'2'},allergies:'Synthetic allergy'},sections:[{title:'Active medications',columns:['Medication','Dose','Instructions'],rows:Array.from({length:80},(_,i)=>['Synthetic medicine '+i,i===0?'<script>window.injected=true</script>':'Synthetic dose','Synthetic instructions that wrap over multiple lines for print pagination.'])}],retrievedAt:new Date().toISOString()}));}""")
    page.wait_for_function("document.querySelector('#bhr-print-frame')?.contentDocument?.querySelectorAll('tbody tr').length===80")
    page.evaluate("window.calls=0;document.querySelector('#bhr-print-frame').contentWindow.print=()=>window.calls++")
    page.wait_for_timeout(100);assert pending;pending.pop().fulfill(content_type='image/png',body=Path('icons/abbey-letterhead.png').read_bytes());page.wait_for_function('window.calls===1')
    assert page.frame_locator('#bhr-print-frame').locator('script').count()==0
    preview=browser.new_page();preview.set_content(page.locator('#bhr-print-frame').evaluate('frame=>frame.contentDocument.documentElement.outerHTML'));preview.locator('img').evaluate('image=>image.decode()');preview.pdf(path='/tmp/bhr-multipage-print.pdf',format='Letter');preview.close()
    text=subprocess.check_output(['pdftotext','-layout','/tmp/bhr-multipage-print.pdf','-'],text=True)
    pages=[part for part in text.split('\f') if part.strip()];assert len(pages)>1
    assert all('Synthetic Patient' in part and 'Medication' in part for part in pages)
    assert 'Synthetic medicine 79' in text
    page.evaluate("document.querySelector('#bhr-print-frame').contentWindow.dispatchEvent(new Event('afterprint'))");assert page.locator('#bhr-print-frame').count()==0
    page.evaluate("""()=>{window.cancelledPrint=import('./printing.js?v=0.10.0').then(module=>module.printDocument({title:'Synthetic cancelled print',person:{name:'Synthetic patient'},sections:[]}).catch(error=>window.printError=error.message));}""")
    page.wait_for_function("document.querySelector('#bhr-print-frame')?.contentDocument?.body?.textContent.includes('Synthetic cancelled print')")
    page.evaluate("async()=>{const module=await import('./printing.js?v=0.10.0');module.clearPrint();}");assert page.locator('#bhr-print-frame').count()==0
    for route in pending:route.fulfill(content_type='image/png',body=Path('icons/abbey-letterhead.png').read_bytes())
    browser.close()
print('PASS: multi-page PDF with repeated identity/column headers; complete content; escaped HTML; cleanup after print and cancellation')
