"""Synthetic desktop-first entry, main-window lifecycle, menu log, and folder detach sync."""
import copy,json
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive,ignore_event_log_projection
seed={'version':1,'people':[{'id':'synthetic-person','name':'Synthetic Brother','info':'','updatedAt':'2026-11-09T12:00:00Z','notes':[],'driveFolders':[{'id':'care-folder','name':'Synthetic care folder'}]}]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000},service_workers='block');prepare_test_page(page)
 page.add_init_script("if(!localStorage.getItem('infirmary.directory.v1'))localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(seed))+");")
 store=[copy.deepcopy(seed)];writes=[];errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def api(route):
  r=route.request;url=r.url
  if r.method not in ['GET','HEAD']:writes.append((r.method,url))
  if '/userinfo' in url:route.fulfill(json={'sub':'synthetic-staff','name':'Synthetic staff'});return
  if '/files/root?' in url:route.fulfill(json={'id':'root','name':'Infirmary-BHR','appProperties':{'bhrWorkspace':'1'},'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}});return
  if '/files?' in url:route.fulfill(json={'files':[{'id':'directory'}] if 'people_directory.json' in url else []});return
  if '/files/directory?' in url:
   if r.method=='PATCH':store[0]=r.post_data_json
   route.fulfill(json=store[0] if r.method=='GET' else {'id':'directory'});return
  route.fulfill(status=404,json={'error':{'message':'Unknown synthetic route'}})
 page.route('https://www.googleapis.com/**',api);ignore_event_log_projection(page);page.goto('http://127.0.0.1:8000');assert not page.locator('#drive-dialog').evaluate("e=>e.classList.contains('drive-connected')");unlock_test_drive(page,open_records=False)
 assert page.locator('#drive-dialog').evaluate("e=>e.classList.contains('drive-connected')")
 assert page.locator('#records-window').is_hidden() and page.locator('#desktop-icons #event-log-icon').count()==0 and page.locator('.desktop-caption').count()==0
 assert page.locator('#bhr-icon img').evaluate('i=>i.complete&&i.naturalWidth>0')
 bhr=page.locator('#bhr-icon').bounding_box();calendar=page.locator('#calendar-maker-icon').bounding_box();trash=page.locator('#desktop-trash').bounding_box();assert abs(bhr['x']-trash['x'])<1 and calendar['x']<bhr['x'] and abs(calendar['y']-bhr['y'])<2
 page.screenshot(path='/tmp/bhr-desktop-first.png')
 page.locator('#bhr-icon').dblclick();assert page.locator('#records-window').is_visible()
 assert page.locator('#close-main').bounding_box()['x']>page.locator('#maximize-main').bounding_box()['x']
 page.locator('.note-form input').fill('Synthetic unsaved quick note');page.locator('#maximize-main').click();page.locator('#close-main').click();assert page.locator('#records-window').is_hidden() and page.locator('#window-dock [data-window=records-window]').count()==0
 page.locator('#bhr-icon').focus();page.keyboard.press('Enter');assert page.locator('#records-window').is_visible() and page.locator('#records-window').evaluate("e=>e.classList.contains('maximized')") and page.locator('.note-form input').input_value()=='Synthetic unsaved quick note'
 page.locator('#maximize-main').click();page.locator('#minimize-main').click();assert page.locator('#window-dock [data-window=records-window]').count()==1
 page.locator('#bhr-icon').dblclick();assert page.locator('#window-dock [data-window=records-window]').count()==0 and page.locator('.window').count()==1
 page.locator('.detach-folder').click();assert 'can break' in page.locator('#detach-folder-dialog').inner_text();page.locator('#detach-folder-dialog [data-close]').click();assert page.locator('.folder-link').count()==1
 page.locator('.detach-folder').click();page.locator('#detach-folder-confirm').click();page.wait_for_function("!document.querySelector('#detach-folder-dialog').open && document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'")
 assert page.locator('.folder-link').count()==0 and store[0]['people'][0]['folderLinkStates'][0]['attached'] is False
 # A stale remote attachment cannot undo an explicit detach.
 store[0]=copy.deepcopy(seed);page.locator('#manual-sync').click();page.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'");assert page.locator('.folder-link').count()==0
 page.get_by_role('button',name='Attach folder…',exact=True).click();page.get_by_label('Google Drive folder link',exact=True).fill('https://drive.google.com/drive/folders/care-folder');page.get_by_label('Folder name (optional)',exact=True).fill('Synthetic reattached folder');page.locator('#folder-dialog').get_by_role('button',name='Attach folder',exact=True).click();assert page.locator('.folder-link').count()==1
 page.locator('#manual-sync').click();page.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'");assert store[0]['people'][0]['folderLinkStates'][0]['attached'] is True
 assert not any('/care-folder' in url for method,url in writes)
 assert any(e['action']=='folder.detached' for e in store[0].get('eventLog',[]))
 page.locator('#close-main').click();page.locator('#app-menu-toggle').click();assert page.locator('#event-log-icon svg').count()==1;page.locator('#event-log-icon').click();assert page.locator('#event-log-dialog').is_visible() and page.locator('#app-menu').is_hidden();page.locator('#event-log-dialog [data-close]').click();assert page.locator('#records-window').is_hidden()
 page.locator('#logout-power').click();page.locator('#confirm-logout').click();page.wait_for_function("document.body.classList.contains('drive-locked')")
 assert not page.locator('#drive-dialog').evaluate("e=>e.classList.contains('drive-connected')")
 page.locator('#google-connect').click();page.locator('#use-drive-root').click();page.wait_for_function("!document.body.classList.contains('drive-locked')");page.locator('#drive-dialog [data-close]').click();assert page.locator('#records-window').is_hidden()
 page.set_viewport_size({'width':390,'height':844});page.locator('#bhr-icon').dblclick();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.locator('#close-main').click();assert page.locator('#records-window').is_hidden()
 assert not errors,errors;b.close()
print('PASS: desktop-first connection/reconnect; BHR icon/grid; close/maximize/minimize/reopen; retained draft; menu Event Log; folder detach cancel/confirm; stale-sync resistance; intentional reattach; no Drive-folder mutation; mobile')
