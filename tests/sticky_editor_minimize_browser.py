"""Sticky edit/create drafts survive minimization; all records are synthetic."""
import json
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive,open_drive
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1280,'height':900},service_workers='block');prepare_test_page(page)
 errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 note={'id':'synthetic-sticky','text':'Synthetic original','createdAt':'2026-01-01T00:00:00.000Z','updatedAt':'2026-01-01T00:00:00.000Z','authorName':'Synthetic original author','x':600,'y':200,'drawing':[{'color':'#222222','size':5,'points':[[.1,.1],[.4,.4]]}]}
 seed={'version':1,'people':[],'desktopNotes':[note]};directory=[seed]
 page.add_init_script("if(!localStorage.getItem('infirmary.directory.v1'))localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(seed))+");")
 page.route('https://www.googleapis.com/drive/v3/files/root?*',lambda route:route.fulfill(json={'id':'root','name':'Infirmary-BHR','appProperties':{'bhrWorkspace':'1'},'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}}))
 page.route('https://www.googleapis.com/drive/v3/files?*',lambda route:route.fulfill(json={'files':[{'id':'__test-bootstrap'}] if 'people_directory.json' in route.request.url else []}))
 page.route('https://www.googleapis.com/drive/v3/files/__test-bootstrap?*',lambda route:route.fulfill(json=directory[0]))
 def write(route):directory[0]=route.request.post_data_json;route.fulfill(json={'id':'__test-bootstrap'})
 page.route('https://www.googleapis.com/upload/drive/v3/files/__test-bootstrap?*',write)
 page.goto('http://127.0.0.1:8000');unlock_test_drive(page,open_records=False)
 page.locator('.sticky-edit').click();page.locator('#sticky-text').fill('Synthetic edited draft')
 page.locator('#sticky-draw-toggle').click();page.locator('#sticky-ink').select_option('#2454a4');page.locator('#sticky-brush').select_option('10')
 canvas=page.locator('#sticky-canvas');r=canvas.bounding_box();page.mouse.move(r['x']+30,r['y']+20);page.mouse.down();page.mouse.move(r['x']+120,r['y']+40,steps=5);page.mouse.up()
 image=canvas.evaluate('c=>c.toDataURL()')
 def retained():
  assert page.locator('#sticky-text').input_value()=='Synthetic edited draft'
  assert page.locator('#sticky-editor-title').inner_text()=='Edit Sticky Note' and page.locator('#sticky-submit').inner_text()=='Save note'
  assert page.locator('#sticky-draw-toggle').get_attribute('aria-pressed')=='true'
  assert page.locator('#sticky-ink').input_value()=='#2454a4' and page.locator('#sticky-brush').input_value()=='10'
  assert canvas.evaluate('c=>c.toDataURL()')==image
 for _ in range(2):
  page.locator('#sticky-dialog .window-control').click();dock=page.locator('#window-dock [data-window=sticky-dialog]');assert 'Edit Sticky Note' in dock.inner_text();dock.click();retained()
 # Restore before the queued close event runs, too.
 page.evaluate("()=>{document.querySelector('#sticky-dialog .window-control').click();document.querySelector('#window-dock [data-window=sticky-dialog]').click();}")
 page.wait_for_timeout(50);retained()
 page.locator('#sticky-dialog .window-control').click();page.locator('.sticky-edit').click();retained();assert page.locator('#window-dock [data-window=sticky-dialog]').count()==0
 page.locator('#sticky-submit').click();page.wait_for_function("!document.querySelector('#sticky-dialog').open")
 saved=page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1')).desktopNotes")
 assert len(saved)==1 and saved[0]['id']==note['id'] and saved[0]['text']=='Synthetic edited draft' and len(saved[0]['drawing'])==2
 assert saved[0]['authorName']==note['authorName'] and saved[0]['editedBy']=='Synthetic Staff'
 # Cancel really ends editing. A subsequent new task must be a blank creation.
 page.locator('.sticky-edit').click();page.locator('#sticky-text').fill('Synthetic cancelled draft');page.locator('#sticky-dialog [data-close]').click()
 top=page.locator('.menubar').bounding_box()['height'];page.mouse.click(10,top+10,button='right');page.locator('#new-desktop-note').click()
 assert page.locator('#sticky-editor-title').inner_text()=='New Sticky Note' and page.locator('#sticky-text').input_value()==''
 page.locator('#sticky-text').fill('Synthetic new draft');page.locator('#sticky-dialog .window-control').click();page.locator('#window-dock [data-window=sticky-dialog]').click()
 assert page.locator('#sticky-text').input_value()=='Synthetic new draft' and page.locator('#sticky-submit').inner_text()=='Leave note'
 page.locator('#sticky-dialog [data-close]').click();assert len(page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1')).desktopNotes"))==1
 open_drive(page);page.locator('#disconnect').click();assert page.locator('#sticky-text').input_value()==''
 assert not errors,errors
 browser.close()
print('PASS: repeated/rapid sticky minimize restores edit mode, text, drawing and tools; updates original only; new drafts preserved; cancel and disconnect clear correctly')
