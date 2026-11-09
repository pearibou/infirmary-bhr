"""Synthetic real-ID workspace upgrade, desktop containment and reconnect."""
import json,re,urllib.parse
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,ignore_event_log_projection
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':900},service_workers='block');prepare_test_page(page)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    mime='application/vnd.google-apps.folder';counter=[0]
    files={'actual-root':{'id':'actual-root','name':'My Drive','mimeType':mime,'parents':[]},'directory':{'id':'directory','name':'people_directory.json','mimeType':'application/json','parents':['actual-root']},'legacy-folder':{'id':'legacy-folder','name':'Synthetic old folder','mimeType':mime,'parents':['actual-root'],'appProperties':{'bhrDesktop':'1','kind':'folder'}},'unrelated':{'id':'unrelated','name':'Unrelated file','mimeType':'text/plain','parents':['actual-root']}}
    data={'directory':{'version':1,'people':[]}}
    for file in files.values():file['capabilities']={'canAddChildren':True};file['modifiedTime']='2026-01-01T00:00:00.000Z'
    def drive(route):
        req=route.request;url=urllib.parse.urlparse(req.url);params=urllib.parse.parse_qs(url.query);method=req.method
        if '/userinfo' in url.path:route.fulfill(json={'sub':'synthetic-staff','name':'Synthetic Staff'});return
        id=url.path.rsplit('/',1)[-1];id='actual-root' if id=='root' else id
        if url.path.endswith('/files') and method=='GET':
            q=params.get('q',[''])[0];parent=re.search("'([^']+)' in parents",q);name=re.search("name = '([^']+)'",q)
            found=[file for file in files.values() if not file.get('trashed') and (not parent or ('actual-root' if parent[1]=='root' else parent[1]) in file.get('parents',[])) and (not name or file['name']==name[1]) and ("key='bhrDesktop'" not in q or file.get('appProperties',{}).get('bhrDesktop')=='1')]
            route.fulfill(json={'files':found});return
        if params.get('uploadType')==['multipart']:
            boundary=req.headers['content-type'].split('boundary=')[1];parts=req.post_data.split('--'+boundary)
            meta=json.loads(parts[1].split('\r\n\r\n',1)[1].strip());body=json.loads(parts[2].split('\r\n\r\n',1)[1].strip())
            counter[0]+=1;id='new-note-'+str(counter[0]);files[id]={'id':id,**meta,'modifiedTime':'2026-01-01T00:01:00.000Z'};data[id]=body;route.fulfill(json=files[id]);return
        if method=='POST':
            counter[0]+=1;id='folder-'+str(counter[0]);files[id]={'id':id,**req.post_data_json,'capabilities':{'canAddChildren':True},'modifiedTime':'2026-01-01T00:01:00.000Z'};files[id]['parents']=['actual-root' if parent=='root' else parent for parent in files[id]['parents']];route.fulfill(json=files[id]);return
        if id not in files:route.fulfill(status=404,json={'error':{'message':'Synthetic file missing'}});return
        if method=='PATCH':
            if params.get('uploadType')==['media']:data[id]=req.post_data_json
            else:
                files[id].update(req.post_data_json)
                if params.get('addParents'):files[id]['parents']=params['addParents']
            route.fulfill(json=files[id]);return
        route.fulfill(json=data[id] if params.get('alt')==['media'] else files[id])
    page.route('https://www.googleapis.com/**',drive);ignore_event_log_projection(page)
    page.goto('http://127.0.0.1:8000')
    page.wait_for_function("window.google?.accounts?.oauth2 && !document.querySelector('#drive-status').textContent.startsWith('Preparing')")
    page.locator('#google-connect').click();page.locator('#use-drive-root').click()
    page.wait_for_function("!document.body.classList.contains('drive-locked')")
    container=next(file for file in files.values() if file['name']=='Infirmary-BHR');home=container['id']
    assert files['directory']['parents']==[home] and files['legacy-folder']['parents']==[home]
    assert files['unrelated']['parents']==['actual-root']
    assert page.evaluate("JSON.parse(localStorage.getItem('infirmary.drive')).folder")==home
    assert page.locator('#sync-folder-name').text_content()=='Infirmary-BHR'
    page.locator('#drive-dialog [data-close]').click()
    page.locator('#desktop-icons .drive-file').filter(has_text='Synthetic old folder').wait_for()
    page.locator('.desktop').click(button='right',position={'x':20,'y':210});page.locator('#new-rich-note').click()
    page.locator('#rich-note-name').fill('Synthetic contained note');page.locator('#rich-note-body').fill('Synthetic protected body');page.locator('#rich-note-save').click()
    page.wait_for_function("document.querySelector('#rich-note-dialog').classList.contains('note-viewing') && !document.querySelector('#rich-note-edit').disabled");page.locator('#rich-note-dialog [data-close]').click()
    note=next(file for file in files.values() if file['name']=='Synthetic contained note');assert note['parents']==[home]
    assert 'Synthetic protected body' not in page.evaluate("localStorage.getItem('infirmary.directory.v1')")
    page.locator('#logout-power').click();page.locator('#confirm-logout').click()
    page.wait_for_function("document.body.classList.contains('drive-locked')")
    assert page.evaluate("localStorage.getItem('infirmary.directory.v1')") is None
    page.locator('#google-connect').click();page.locator('#use-drive-root').click();page.wait_for_function("!document.body.classList.contains('drive-locked')")
    assert len([file for file in files.values() if file['name']=='Infirmary-BHR'])==1
    assert files[note['id']]['parents']==[home]
    assert not errors,errors
    browser.close()
print('PASS: create/reuse Infirmary-BHR; migrate recognized files with IDs intact; leave unrelated root files; contain new notes; remember container; clean logout/reconnect without duplicates')
