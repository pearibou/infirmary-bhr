"""Synthetic appointment calendars only; no imported PDF contents or real Google data."""
import copy,json,re,subprocess,urllib.parse,xml.etree.ElementTree as ET
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive,ignore_event_log_projection
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1100},service_workers='block');page=context.new_page();prepare_test_page(page)
    page.add_init_script("""(()=>{const append=Element.prototype.append;Element.prototype.append=function(...nodes){const result=append.apply(this,nodes);for(const node of nodes)if(node instanceof HTMLIFrameElement&&node.id==='calendar-print-frame')node.contentWindow.print=()=>{window.calendarPrintCalls=(window.calendarPrintCalls||0)+1};return result;};})()""")
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    files={};contents={};serial=[0];directory=[{'version':1,'people':[]}];lost=[False];fail=[False];calendar_requests=[]
    def drive(route):
        request=route.request;url=urllib.parse.urlparse(request.url);params=urllib.parse.parse_qs(url.query);method=request.method
        if '/userinfo' in url.path:route.fulfill(json={'sub':'synthetic-calendar-author','name':'Synthetic Calendar Staff'});return
        if url.path.endswith('/root'):route.fulfill(json={'id':'root','name':'Infirmary-BHR','mimeType':'application/vnd.google-apps.folder','appProperties':{'bhrWorkspace':'1'},'capabilities':{'canAddChildren':True}});return
        if url.path.endswith('/files') and method=='GET':
            q=params.get('q',[''])[0]
            if 'bhrCalendar' in q:
                found=list(files.values());match=re.search(r"key='calendarId' and value='([^']+)'",q)
                if match:found=[file for file in found if file['appProperties']['calendarId']==match[1]]
                route.fulfill(json={'files':found});return
            route.fulfill(json={'files':[{'id':'directory'}] if 'people_directory.json' in q else []});return
        if url.path.endswith('/directory'):
            if method=='GET':route.fulfill(json=directory[0])
            else:directory[0]=request.post_data_json;route.fulfill(json={'id':'directory'})
            return
        if 'uploadType' in params and 'bhrCalendar' in (request.post_data or ''):
            calendar_requests.append(request.post_data)
            if fail[0]:route.fulfill(status=503,json={'error':{'message':'Synthetic calendar failure'}});return
            boundary=request.headers['content-type'].split('boundary=')[1];parts=request.post_data.split('--'+boundary);meta=json.loads(parts[1].split('\r\n\r\n')[1]);value=json.loads(parts[2].split('\r\n\r\n')[1])
            id=url.path.split('/')[-1]
            if method=='POST':serial[0]+=1;id='calendar-'+str(serial[0])
            previous=files.get(id,{})
            files[id]={**previous,**meta,'id':id,'parents':['root'],'modifiedTime':f'2026-11-09T12:00:{len(calendar_requests):02d}Z'};contents[id]=value
            if lost[0]:lost[0]=False;route.fulfill(status=503,json={'error':{'message':'Synthetic lost save reply'}});return
            route.fulfill(json=files[id]);return
        id=url.path.split('/')[-1]
        if id in files:route.fulfill(json=contents[id] if params.get('alt')==['media'] else files[id]);return
        route.fulfill(status=404,json={'error':{'message':'Unknown synthetic route'}})
    page.route('https://www.googleapis.com/**',drive);ignore_event_log_projection(page)
    page.goto('http://127.0.0.1:8000')
    try:unlock_test_drive(page)
    except Exception:
        print({'errors':errors,'drive':page.locator('#drive-status').inner_text(),'connection':page.locator('#connection').inner_text()});raise
    icon=page.locator('#calendar-maker-icon');event=page.locator('#bhr-icon');assert icon.bounding_box()['x']<event.bounding_box()['x'] and abs(icon.bounding_box()['y']-event.bounding_box()['y'])<2
    icon.dblclick();page.locator('#calendar-new').click();page.locator('#calendar-week').fill('2026-11-10');page.locator('#calendar-week').press('Tab');assert page.locator('#calendar-week').input_value()=='2026-11-08'
    page.locator('#calendar-name').fill('Synthetic appointments')
    def add(day,name='Synthetic public name',private=True):
        section=page.locator(f'.calendar-day[data-day="{day}"]');section.get_by_role('button',name='+ Add appointment',exact=True).click();row=section.locator('.calendar-appointment').last
        if row.count()==0:print({'errors':errors,'status':page.locator('#calendar-status').inner_text(),'day':section.inner_html()[:1000]})
        for field,value in [('name',name),('leaving','8:30 AM'),('returning','11:00 AM'),('area','Synthetic town'),('appointmentTime','PRIVATE APPT TOKEN' if private else ''),('reason','PRIVATE REASON TOKEN' if private else ''),('address','PRIVATE ADDRESS TOKEN\n555 0100' if private else '')]:row.locator(f'[data-field="{field}"]').fill(value)
        return row
    add(1);add(3,'Synthetic Wednesday');add(6,'Synthetic Saturday');add(0,'Synthetic Sunday')
    assert '2 appointment(s)' in page.locator('#calendar-weekend-note').inner_text()
    fail[0]=True;page.locator('#calendar-save').click();page.wait_for_function("!document.querySelector('#calendar-save').disabled");assert 'failed' in page.locator('#calendar-status').inner_text(),page.locator('#calendar-status').inner_text();assert len(files)==0 and page.locator('[data-field=reason]').first.input_value()=='PRIVATE REASON TOKEN'
    fail[0]=False;lost[0]=True;page.locator('#calendar-save').click();page.wait_for_function("!document.querySelector('#calendar-save').disabled");assert 'failed' in page.locator('#calendar-status').inner_text(),page.locator('#calendar-status').inner_text();assert len(files)==1
    page.locator('#calendar-save').click();page.wait_for_function("document.querySelector('#calendar-status').textContent==='Calendar saved' && !document.querySelector('#calendar-save').disabled");assert len(files)==1
    saved_id=next(iter(files));assert files[saved_id]['parents']==['root'] and contents[saved_id]['weekStart']=='2026-11-08' and len(contents[saved_id]['appointments'])==4
    assert 'PRIVATE REASON' not in page.evaluate("localStorage.getItem('infirmary.directory.v1')")
    def print_mode(mode):
        page.locator('#calendar-print-'+('full' if mode=='administrator' else 'public')).click()
        try:page.wait_for_function("document.querySelector('#calendar-print-frame')?.contentDocument?.querySelector('table')",timeout=10000)
        except Exception:
            print({'status':page.locator('#calendar-status').inner_text(),'errors':errors});raise
        # The print engine waits for fonts, providing a normal asynchronous turn.
        frame=page.frame_locator('#calendar-print-frame');page.wait_for_function("!document.querySelector('#calendar-save').disabled")
        assert page.locator('#calendar-status').inner_text().startswith('Print dialog requested'),page.locator('#calendar-status').inner_text()
        assert page.evaluate('window.calendarPrintCalls')>=1
        assert frame.locator('.week').evaluate("e=>getComputedStyle(e).backgroundColor")=='rgb(255, 255, 179)'
        assert frame.locator('.day-heading th').first.evaluate("e=>getComputedStyle(e).backgroundColor")=='rgb(243, 243, 243)'
        assert frame.locator('thead th').nth(3).evaluate("e=>getComputedStyle(e).textAlign")=='center'
        assert frame.locator('.notice-row .notice-mark').evaluate("e=>e.tagName.toLowerCase()==='svg'||(e.complete&&e.naturalWidth>0)")
        html=page.locator('#calendar-print-frame').evaluate('frame=>frame.contentDocument.documentElement.outerHTML')
        if mode=='public':assert 'PRIVATE' not in html and 'Reason' not in html and 'Address / phone' not in html and 'appointmentTime' not in html
        else:assert 'PRIVATE REASON TOKEN' in html and 'PRIVATE ADDRESS TOKEN' in html and frame.locator('.private-start').count()>0
        preview=browser.new_page(viewport={'width':1100,'height':1100});preview.set_content(html);preview.emulate_media(media='print');path='/tmp/bhr-calendar-'+mode+'.pdf';preview.pdf(path=path,prefer_css_page_size=True);preview.screenshot(path='/tmp/bhr-calendar-'+mode+'.png');preview.close()
        info=subprocess.check_output(['pdfinfo',path],text=True);assert 'Pages:           1' in info
        assert ('792 x 612' if mode=='administrator' else '612 x 792') in info
        text=subprocess.check_output(['pdftotext','-layout',path,'-'],text=True)
        if mode=='public':assert 'PRIVATE' not in text and 'Synthetic Saturday' not in text and 'Synthetic Sunday' not in text
        page.evaluate("document.querySelector('#calendar-print-frame').contentWindow.dispatchEvent(new Event('afterprint'))");assert page.locator('#calendar-print-frame').count()==0
        return text
    assert page.locator('#calendar-reading').is_visible() and page.locator('#calendar-editor').is_hidden()
    assert 'Synthetic public name' in page.locator('#calendar-reading').inner_text() and page.locator('#calendar-edit svg').count()==1
    before_print=contents[saved_id]['updatedAt'];print_mode('public');assert contents[saved_id]['updatedAt']==before_print
    page.locator('#calendar-dialog').screenshot(path='/tmp/bhr-calendar-reading.png')
    page.locator('#calendar-edit').click();page.locator('#calendar-saturday').check();page.locator('#calendar-sunday').check();page.locator('#calendar-symbols').get_by_role('button',name='Stethoscope',exact=True).click();page.locator('#calendar-symbols').screenshot(path='/tmp/bhr-calendar-symbols.png');text=print_mode('administrator');assert 'Synthetic Saturday' in text and 'Synthetic Sunday' in text;assert text.index('Synthetic Sunday')<text.index('Synthetic public name')<text.index('Synthetic Saturday')
    # A conflicting calendar must retain the working draft and refuse overwrite.
    files[saved_id]['modifiedTime']='2099-01-01T00:00:00Z';page.locator('#calendar-edit').click();page.locator('#calendar-name').fill('Synthetic retained draft');page.locator('#calendar-save').click();page.wait_for_function("document.querySelector('#calendar-status').textContent.includes('changed in Drive')");assert page.locator('#calendar-name').input_value()=='Synthetic retained draft'
    page.locator('#calendar-new').click();page.locator('#calendar-switch-discard').click();assert page.locator('#calendar-name').input_value()=='Outgoing Medical Appts'
    page.locator('#calendar-archive button').first.click();page.wait_for_function("document.querySelector('#calendar-name').value==='Synthetic appointments'")
    assert contents[saved_id]['symbol']=='stethoscope'
    assert page.locator('[data-calendar-symbol=stethoscope]').get_attribute('aria-pressed')=='true'
    assert page.locator('[data-field=reason]').first.input_value()=='PRIVATE REASON TOKEN'
    assert page.locator('#calendar-reading').is_visible() and page.locator('#calendar-editor').is_hidden()
    page.locator('#calendar-edit').click();page.locator('#calendar-name').fill('Synthetic discard preview')
    page.locator('#calendar-view-button').click();page.locator('#calendar-switch-dialog [data-close]').click();assert page.locator('#calendar-name').input_value()=='Synthetic discard preview'
    page.locator('#calendar-view-button').click();page.locator('#calendar-switch-discard').click();assert page.locator('#calendar-reading').is_visible() and 'Synthetic discard preview' not in page.locator('#calendar-reading').inner_text()
    page.locator('#calendar-edit').click()
    page.locator('#calendar-name').fill('Synthetic pending');page.locator('#calendar-new').click();page.locator('#calendar-switch-dialog [data-close]').click();assert page.locator('#calendar-name').input_value()=='Synthetic pending'
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('#calendar-dialog [data-close]').click();icon.dblclick();assert page.locator('#calendar-name').input_value()=='Synthetic pending'
    page.locator('#calendar-dialog [data-close]').click();page.locator('#logout-power').click();page.locator('#confirm-logout').click();page.wait_for_function("document.body.classList.contains('drive-locked')")
    assert page.locator('#calendar-days').text_content()=='' and page.locator('#calendar-archive').text_content()=='' and page.locator('#calendar-name').input_value()==''
    assert page.locator('#calendar-reading').text_content()==''
    assert 'PRIVATE' not in page.locator('body').text_content() and len(contents)==1
    assert not errors,errors
    browser.close()
print('PASS: icon grid; Sunday week; day entries; optional weekends; protected Drive save/archive; failure/idempotent retry; public projection; Letter portrait/landscape one-page PDFs; stale-edit denial; retained draft; mobile; logout')
