"""Synthetic appointment rundowns only; no imported PDF contents or real Google data."""
import copy,json,re,subprocess,urllib.parse,xml.etree.ElementTree as ET
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive,ignore_event_log_projection
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1100},service_workers='block');page=context.new_page();prepare_test_page(page)
    page.add_init_script("""(()=>{const append=Element.prototype.append;Element.prototype.append=function(...nodes){const result=append.apply(this,nodes);for(const node of nodes)if(node instanceof HTMLIFrameElement&&node.id==='bhr-print-frame')node.contentWindow.print=()=>{window.rundownPrintCalls=(window.rundownPrintCalls||0)+1};return result;};})()""")
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    files={};contents={};serial=[0];directory=[{'version':1,'people':[{'id':'synthetic-person','name':'Brother Synthetic','preferredName':'Brother Synthetic','firstName':'John','lastName':'Example','birthDate':{'month':'1','day':'2','year':'1940'},'info':'','notes':[],'updatedAt':'2026-01-01T00:00:00Z'}]}];lost=[False];fail=[False];rundown_requests=[]
    def drive(route):
        request=route.request;url=urllib.parse.urlparse(request.url);params=urllib.parse.parse_qs(url.query);method=request.method
        if '/userinfo' in url.path:route.fulfill(json={'sub':'synthetic-rundown-author','name':'Synthetic Rundown Staff'});return
        if url.path.endswith('/root'):route.fulfill(json={'id':'root','name':'Infirmary-BHR','mimeType':'application/vnd.google-apps.folder','appProperties':{'bhrWorkspace':'1'},'capabilities':{'canAddChildren':True}});return
        if url.path.endswith('/files') and method=='GET':
            q=params.get('q',[''])[0]
            if 'bhrRundown' in q:
                found=list(files.values());match=re.search(r"key='rundownId' and value='([^']+)'",q)
                if match:found=[file for file in found if file['appProperties']['rundownId']==match[1]]
                route.fulfill(json={'files':found});return
            route.fulfill(json={'files':[{'id':'directory'}] if 'people_directory.json' in q else []});return
        if url.path.endswith('/directory'):
            if method=='GET':route.fulfill(json=directory[0])
            else:directory[0]=request.post_data_json;route.fulfill(json={'id':'directory'})
            return
        if 'uploadType' in params and 'bhrRundown' in (request.post_data or ''):
            rundown_requests.append(request.post_data)
            if fail[0]:route.fulfill(status=503,json={'error':{'message':'Synthetic rundown failure'}});return
            boundary=request.headers['content-type'].split('boundary=')[1];parts=request.post_data.split('--'+boundary);meta=json.loads(parts[1].split('\r\n\r\n')[1]);value=json.loads(parts[2].split('\r\n\r\n')[1])
            id=url.path.split('/')[-1]
            if method=='POST':serial[0]+=1;id='rundown-'+str(serial[0])
            previous=files.get(id,{})
            files[id]={**previous,**meta,'id':id,'parents':['root'],'modifiedTime':f'2026-11-09T12:00:{len(rundown_requests):02d}Z'};contents[id]=value
            if lost[0]:lost[0]=False;route.fulfill(status=503,json={'error':{'message':'Synthetic lost save reply'}});return
            route.fulfill(json=files[id]);return
        id=url.path.split('/')[-1]
        if id in files:route.fulfill(json=contents[id] if params.get('alt')==['media'] else files[id]);return
        route.fulfill(status=404,json={'error':{'message':'Unknown synthetic route'}})
    page.route('https://www.googleapis.com/**',drive);ignore_event_log_projection(page)
    page.add_init_script("if(!localStorage.getItem('infirmary.directory.v1'))localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(directory[0]))+");")
    page.goto('http://127.0.0.1:8000');unlock_test_drive(page,open_records=False)
    page.locator('#rundown-icon').dblclick();page.locator('#rundown-new').click();page.locator('#rundown-date').fill('11/10/2026')
    page.locator('#rundown-person').select_option('synthetic-person');page.locator('#rundown-add-person').click()
    body=page.locator('.rundown-text').first;body.fill('Synthetic ongoing issue')
    body.evaluate("el=>{el.focus();const range=document.createRange();range.selectNodeContents(el);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);}")
    page.locator('#rundown-format [data-command=bold]').click();page.locator('#rundown-format [data-command=highlight]').click()
    page.locator('#rundown-add-general').click();page.locator('.rundown-text').last.fill('Synthetic general concern')
    lost[0]=True;page.locator('#rundown-save').click();page.wait_for_function("document.querySelector('#rundown-status').textContent.includes('kept')")
    assert len(files)==1 and page.locator('#rundown-editor').is_visible()
    page.locator('#rundown-save').click();page.wait_for_function("!document.querySelector('#rundown-reader').hidden && !document.querySelector('#rundown-new').disabled")
    assert len(files)==1;original_id=next(iter(files));original=copy.deepcopy(contents[original_id])
    assert 'Tuesday, 10 November 2026' in page.locator('#rundown-reader').inner_text()
    assert 'Brother Synthetic (01/02/1940)' in page.locator('#rundown-reader').inner_text()
    assert page.locator('#rundown-reader [style]').count()==1 and page.locator('#rundown-reader b').count()==1
    assert 'Synthetic ongoing issue' not in page.evaluate("localStorage.getItem('infirmary.directory.v1')")
    page.locator('#rundown-print').click();page.wait_for_function("window.rundownPrintCalls===1")
    frame=page.frame_locator('#bhr-print-frame');assert 'Tuesday, 10 November 2026' in frame.locator('body').inner_text()
    assert frame.locator('header img').evaluate('e=>parseFloat(getComputedStyle(e).width)')==36
    assert frame.locator('.clinical-print-text [style]').count()==1
    preview=browser.new_page();preview.set_content(page.locator('#bhr-print-frame').evaluate('f=>f.contentDocument.documentElement.outerHTML'));preview.pdf(path='/tmp/bhr-rundown.pdf',format='Letter');preview.close()
    assert 'Pages:           1' in subprocess.check_output(['pdfinfo','/tmp/bhr-rundown.pdf'],text=True)
    page.evaluate("document.querySelector('#bhr-print-frame').contentWindow.dispatchEvent(new Event('afterprint'))")
    page.locator('#rundown-dialog').screenshot(path='/tmp/bhr-rundown.png')
    page.locator('#rundown-copy').click();assert page.locator('.rundown-text').count()==2
    page.locator('#rundown-date').fill('11/11/2026');page.locator('.rundown-text').first.fill('Synthetic new snapshot');page.locator('#rundown-save').click();page.wait_for_function("!document.querySelector('#rundown-reader').hidden && !document.querySelector('#rundown-new').disabled")
    assert len(files)==2 and contents[original_id]==original
    # Unsaved archive switches offer cancel/save/discard, keeping drafts intact.
    page.locator('#rundown-edit').click();page.locator('.rundown-text').first.fill('Synthetic unsaved draft')
    page.locator('#rundown-archive button').last.click();page.locator('#rundown-switch-dialog [data-close]').click();assert page.locator('.rundown-text').first.inner_text()=='Synthetic unsaved draft'
    page.locator('#rundown-archive button').last.click();page.locator('#rundown-switch-discard').click();page.wait_for_function("!document.querySelector('#rundown-reader').hidden")
    assert 'Synthetic ongoing issue' in page.locator('#rundown-reader').inner_text()
    # Stale saved document writes fail and preserve the working text.
    page.locator('#rundown-edit').click();page.locator('.rundown-text').first.fill('Synthetic conflict draft');files[original_id]['modifiedTime']='2099-01-01T00:00:00Z'
    page.locator('#rundown-save').click();page.wait_for_function("document.querySelector('#rundown-status').textContent.includes('changed in Drive')")
    assert page.locator('.rundown-text').first.inner_text()=='Synthetic conflict draft' and contents[original_id]==original
    # Sanitizer keeps controlled highlights but drops executable markup and arbitrary styles.
    safe=page.evaluate("async()=>{const {cleanNoteHtml}=await import('./documents-model.js?v=0.31.1');return cleanNoteHtml('<script>bad()</script><span style=background-color:yellow onclick=bad()>Safe</span><img src=x onerror=bad()>',{highlight:true})}")
    assert 'onclick' not in safe and 'script' not in safe and 'img' not in safe and 'background-color' in safe
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('#rundown-dialog .window-control').click();page.locator('#logout-power').click();page.locator('#confirm-logout').click();page.wait_for_function("document.body.classList.contains('drive-locked')")
    assert page.locator('#rundown-reader').text_content()=='' and page.locator('#rundown-sections').text_content()=='' and page.locator('#rundown-archive').text_content()==''
    assert not errors,errors;browser.close()
print('PASS: private rundown editor/archive, exact dates, formatting/highlighting, compact Letter print, copy isolation, lost-save retry, stale edits, draft guards, mobile and logout cleanup')
