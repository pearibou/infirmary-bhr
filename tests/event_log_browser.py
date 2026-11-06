"""Protected data is synthetic. Full Event Log JSON/text persistence across users."""
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page
import copy,json
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    backend={'directory':{'version':1,'people':[]},'text':None,'writes':0}
    errors=[]
    def setup(name):
        context=browser.new_context(viewport={'width':1280,'height':900},service_workers='block');page=context.new_page();prepare_test_page(page)
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.route('**/config.js*',lambda route:route.fulfill(content_type='application/javascript',body="window.INFIRMARY_CONFIG={clientId:'test.apps.googleusercontent.com'}"))
        def drive(route):
            request=route.request;url=request.url
            if '/oauth2/' in url:route.fulfill(json={'sub':name,'name':name})
            elif 'uploadType=resumable' in url:route.fulfill(status=200,headers={'Access-Control-Expose-Headers':'Location','Location':'https://www.googleapis.com/upload/drive/v3/files?upload_id=synthetic'})
            elif request.method=='PUT':route.fulfill(json={'id':'synthetic-file'})
            elif request.method=='PATCH':
                if '/files/event-text?' in url:backend['text']=request.post_data
                else:backend['directory']=copy.deepcopy(request.post_data_json)
                backend['writes']+=1;route.fulfill(json={'id':'saved'})
            elif request.method=='POST':
                assert 'BHR_event_log.txt' in request.post_data
                backend['text']=request.post_data.split('Content-Type: text/plain; charset=UTF-8\r\n\r\n',1)[1].rsplit('\r\n--',1)[0]
                backend['writes']+=1;route.fulfill(json={'id':'event-text'})
            elif 'files?q=' in url:
                log='BHR_event_log.txt' in url
                route.fulfill(json={'files':([{'id':'event-text'}] if backend['text'] is not None else []) if log else [{'id':'directory'}]})
            elif '/files/event-text?' in url:route.fulfill(content_type='text/plain',body=backend['text'])
            elif 'alt=media' in url:route.fulfill(json=backend['directory'])
            else:route.fulfill(json={'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}})
        page.route('https://www.googleapis.com/**',drive);page.goto('http://127.0.0.1:8000');return context,page
    def connect(page):
        page.locator('#google-connect').click();page.locator('#use-drive-root').click();page.wait_for_function("!document.body.classList.contains('drive-locked')");page.locator('#drive-dialog').get_by_role('button',name='Close',exact=True).click()
    def sync(page):
        page.locator('#manual-sync').click();page.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'")
    c,a=setup('Synthetic Staff A');connect(a)
    icon=a.locator('#event-log-icon');trash=a.locator('#desktop-trash')
    assert icon.bounding_box()['y']>trash.bounding_box()['y'] and abs(icon.bounding_box()['x']-trash.bounding_box()['x'])<1
    icon.dblclick();assert a.locator('#event-log-dialog').is_visible();assert a.locator('#event-log-text').get_attribute('contenteditable') is None
    assert a.locator('#event-log-dialog textarea').count()==0
    a.locator('#event-log-dialog').get_by_role('button',name='Close',exact=True).click()
    a.locator('#add-person').click();form=a.locator('#person-dialog');form.get_by_label('Preferred name',exact=True).fill('Synthetic Brother');form.get_by_label('Additional information').fill('SYNTHETIC PRIVATE HEALTH INFORMATION');a.locator('#person-submit').click()
    a.get_by_label('New note',exact=True).fill('SYNTHETIC CLINICAL NOTE');a.get_by_label('New note',exact=True).press('Enter')
    a.locator('.note-pencil').click();a.locator('#note-edit-text').fill('SYNTHETIC CORRECTED CLINICAL NOTE');a.get_by_role('button',name='Save note edit',exact=True).click()
    a.get_by_role('button',name='Attach folder…',exact=True).click();a.get_by_label('Google Drive folder link',exact=True).fill('https://drive.google.com/drive/folders/person-docs');a.locator('#folder-dialog').get_by_role('button',name='Attach folder',exact=True).click()
    a.get_by_role('button',name='Upload file…',exact=True).click();a.locator('#upload-file').set_input_files({'name':'synthetic.any','mimeType':'application/octet-stream','buffer':bytes([0,255,44])});a.locator('#upload-submit').click();a.wait_for_function("document.querySelector('#upload-status').textContent.startsWith('Uploaded')");a.locator('#upload-dialog').get_by_role('button',name='Close',exact=True).click()
    a.locator('.note').first.focus();a.locator('.note').first.press('Delete');a.locator('#trash-dialog').get_by_role('button',name='Permanently delete',exact=True).click()
    top=a.locator('.menubar').bounding_box()['height'];a.mouse.click(15,top+15,button='right')
    assert a.get_by_role('menuitem',name='New Sticky Note',exact=True).is_visible()
    a.get_by_role('menuitem',name='New Sticky Note',exact=True).click();a.locator('#sticky-text').fill('SYNTHETIC HANDOFF CONTENT');a.get_by_role('button',name='Leave note',exact=True).click()
    a.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'");sync(a)
    ids={event['id'] for event in backend['directory']['eventLog']};actions={event['action'] for event in backend['directory']['eventLog']}
    assert {'drive.connected','directory.selected','person.created','note.created','note.edited','note.deleted','folder.attached','file.uploaded','sticky.created'}<=actions
    assert 'SYNTHETIC CLINICAL' not in backend['text'] and 'SYNTHETIC PRIVATE' not in backend['text'] and 'SYNTHETIC HANDOFF CONTENT' not in backend['text']
    icon.dblclick();view=a.locator('#event-log-text').inner_text();assert 'Chronological note permanently deleted' in view and 'Synthetic Staff A' in view
    a.locator('#event-log-dialog').get_by_role('button',name='Close',exact=True).click()
    # The second user is allowed to delete the first user's shared sticky.
    c2,b=setup('Synthetic Staff B');connect(b);assert b.locator('.sticky-note').is_visible()
    b.locator('.sticky-note').focus();b.locator('.sticky-note').press('Delete');b.locator('#trash-dialog').get_by_role('button',name='Permanently delete',exact=True).click();sync(b)
    assert any(event['action']=='sticky.deleted' and event['actorId']=='Synthetic Staff B' for event in backend['directory']['eventLog'])
    assert ids<={event['id'] for event in backend['directory']['eventLog']}
    sync(a);assert a.locator('.sticky-note').count()==0
    events=backend['directory']['eventLog'];assert [e['createdAt'] for e in events]==sorted([e['createdAt'] for e in events],reverse=True)
    # Recover history when canonical JSON is stale but the immutable text copy retains it.
    retained={event['id'] for event in events};backend['directory'].pop('eventLog')
    c3,d=setup('Synthetic Staff C');connect(d)
    assert retained<={event['id'] for event in backend['directory']['eventLog']}
    d.locator('#event-log-icon').dblclick();assert 'Shared sticky note permanently deleted' in d.locator('#event-log-text').inner_text()
    d.locator('#event-log-dialog').get_by_role('button',name='Close',exact=True).click()
    d.set_viewport_size({'width':390,'height':844})
    d.locator('#event-log-icon').dblclick()
    assert d.locator('#event-log-dialog').is_visible()
    assert d.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    browser.close()
    print('PASS: New Sticky Note label; clipboard below Trash; read-only Event Log window; record/note/folder/upload/delete logging; metadata-only text; immutable cross-user merge; anyone can delete shared stickies; newest-first chronology; recovery from text copy')
