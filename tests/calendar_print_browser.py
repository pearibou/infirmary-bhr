"""Synthetic projection, overflow and Letter page-size checks independent of Drive."""
import subprocess
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(service_workers='block');prepare_test_page(page)
    page.add_init_script("""(()=>{const append=Element.prototype.append;Element.prototype.append=function(...nodes){const r=append.apply(this,nodes);for(const n of nodes)if(n instanceof HTMLIFrameElement&&n.id==='calendar-print-frame')n.contentWindow.print=()=>window.calls=(window.calls||0)+1;return r;};})()""")
    page.goto('http://127.0.0.1:8000')
    page.evaluate("""async()=>{const model=await import('./calendar-model.js?v=0.24.1');window.syntheticCalendar=model.newCalendar({id:'synthetic',name:'Synthetic author'},'2026-11-09');syntheticCalendar.appointments=Array.from({length:30},(_,i)=>({id:'synthetic-'+i,day:i%5,name:'Synthetic community '+i,leaving:'8 AM',returning:'Noon',area:'Synthetic town',appointmentTime:'PRIVATE APPT',reason:'PRIVATE REASON '+('Long synthetic text '.repeat(80)),address:'PRIVATE ADDRESS'}));}""")
    page.evaluate("""()=>{window.printError='';window.job=import('./calendar-print.js?v=0.24.1').then(module=>module.printCalendar(syntheticCalendar,'administrator')).catch(error=>window.printError=error.message);}""")
    page.wait_for_function("window.printError.includes('too much information')");assert page.locator('#calendar-print-frame').count()==0 and page.evaluate('window.calls||0')==0
    page.evaluate("""()=>{syntheticCalendar.appointments=syntheticCalendar.appointments.slice(0,12);window.job=import('./calendar-print.js?v=0.24.1').then(module=>module.printCalendar(syntheticCalendar,'public'));}""")
    page.wait_for_function('window.calls===1');html=page.locator('#calendar-print-frame').evaluate('frame=>frame.contentDocument.documentElement.outerHTML');assert 'PRIVATE' not in html
    preview=browser.new_page();preview.set_content(html);preview.pdf(path='/tmp/bhr-calendar-fitted-public.pdf',prefer_css_page_size=True);preview.close()
    assert 'Pages:           1' in subprocess.check_output(['pdfinfo','/tmp/bhr-calendar-fitted-public.pdf'],text=True)
    assert 'PRIVATE' not in subprocess.check_output(['pdftotext','/tmp/bhr-calendar-fitted-public.pdf','-'],text=True)
    page.evaluate("document.querySelector('#calendar-print-frame').contentWindow.dispatchEvent(new Event('afterprint'))");assert page.locator('#calendar-print-frame').count()==0
    browser.close()
print('PASS: excessive administrator detail blocks print without clipping; public projection stays private and fits Letter on one page; frame cleanup')
