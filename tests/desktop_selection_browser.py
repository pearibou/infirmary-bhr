"""Synthetic marquee selection, permission-aware bulk trash, and sticky stacking."""
import json,re
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive,open_bhr
stamp='2026-11-09T12:00:00.000Z'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1280,'height':1000},service_workers='block');prepare_test_page(page)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 seed={'version':1,'people':[],'desktopNotes':[{'id':str(i),'text':'Synthetic sticky '+str(i),'authorName':'Other staff','createdAt':stamp,'updatedAt':stamp,'x':20+i*290,'y':120} for i in range(3)]}
 page.add_init_script("localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(seed))+")")
 files={}
 for key,name,kind,author in [('own','Own note','note','synthetic-staff'),('foreign','Other note','note','another-user'),('empty','Empty folder','folder',''),('full','Full folder','folder','')]:files[key]={'id':key,'name':name,'mimeType':'application/json' if kind=='note' else 'application/vnd.google-apps.folder','modifiedTime':stamp,'parents':['root'],'appProperties':{'bhrDesktop':'1','kind':kind,'authorId':author}}
 def backend(route):
  u=urlparse(route.request.url);params=parse_qs(u.query);q=params.get('q',[''])[0];key=u.path.rsplit('/',1)[-1]
  if u.path.endswith('/files'):
   if route.request.method=='POST':return route.fulfill(json={'id':'eventlog'})
   if 'people_directory.json' in q:return route.fulfill(json={'files':[{'id':'directory'}]})
   if 'BHR_event_log' in q:return route.fulfill(json={'files':[]})
   if "'full' in parents" in q:return route.fulfill(json={'files':[{'id':'unmanaged-child','name':'Content'}]})
   parent=re.search("'([^']+)' in parents",q)
   return route.fulfill(json={'files':[f for f in files.values() if not f.get('trashed') and parent and parent[1] in f['parents']]})
  if key=='directory':return route.fulfill(json=seed if route.request.method=='GET' else {'id':'directory'})
  if key=='root':return route.fulfill(json={'id':'root','name':'Infirmary-BHR','mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}})
  if key in files:
   if route.request.method=='PATCH':files[key].update(route.request.post_data_json)
   return route.fulfill(json=files[key])
  return route.fulfill(json={'files':[]})
 page.route('https://www.googleapis.com/**',backend)
 page.goto('http://localhost:8000');unlock_test_drive(page,open_records=False)
 assert page.locator('#drive-dialog').is_hidden()
 page.evaluate("async()=>{await (await import('./documents.js?v=0.21.0')).refreshFiles()}")
 page.locator('#desktop-icons .drive-file').first.wait_for();assert page.locator('#desktop-icons .drive-file').count()==4
 # Minimized stickies are desktop-level; expanded stickies retain their foreground layer.
 page.locator('.sticky-note').last.click(button='right');page.locator('#sticky-menu-minimize').click()
 assert page.locator('.sticky-minimized').count()==1
 open_bhr(page);page.get_by_role('button',name='Maximize window',exact=True).click()
 rect=page.locator('.sticky-minimized').bounding_box()
 assert not page.evaluate('(r)=>document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest(".sticky-minimized")!==null',rect)
 assert page.locator('.sticky-note').first.evaluate('n=>getComputedStyle(n).zIndex')=='4'
 expanded=page.locator('.sticky-note').first.bounding_box();assert page.evaluate('(r)=>Boolean(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest(".sticky-note"))',expanded)
 page.locator('#close-main').click()
 def marquee(x1,y1,x2,y2):
  page.mouse.move(x1,y1);page.mouse.down();page.mouse.move(x2,y2,steps=12);page.mouse.up()
 # App launchers are excluded even though the rectangle encloses them.
 marquee(1000,55,1275,900)
 assert page.locator('#desktop-icons .desktop-selected').count()==4, page.locator('#desktop-icons .drive-file').evaluate_all('nodes=>nodes.map(n=>({name:n.textContent,rect:n.getBoundingClientRect().toJSON(),selected:n.className,hit:document.elementFromPoint(n.getBoundingClientRect().x+44,n.getBoundingClientRect().y+44)?.outerHTML.slice(0,120)}))')
 page.keyboard.press('Delete');page.locator('#bulk-trash-dialog').wait_for(state='visible');assert page.locator('#bulk-trash-list li').count()==4
 page.locator('#bulk-trash-dialog [data-close]').click();assert not any(f.get('trashed') for f in files.values())
 page.locator('#desktop-icons .drive-file').filter(has_text='Own note').drag_to(page.locator('#desktop-trash'));page.locator('#bulk-trash-confirm').click()
 page.wait_for_function("document.querySelector('#bulk-trash-error').textContent.includes('not deleted')")
 assert files['own'].get('trashed') and files['empty'].get('trashed')
 assert not files['foreign'].get('trashed') and not files['full'].get('trashed')
 assert 'creator' in page.locator('#bulk-trash-list').inner_text() and 'empty folders' in page.locator('#bulk-trash-list').inner_text()
 page.locator('#bulk-trash-dialog [data-close]').click()
 # Shared stickies may be deleted by staff other than their creator.
 marquee(5,145,590,460)
 assert page.locator('.sticky-note.desktop-selected').count()==2
 page.keyboard.press('Delete');page.locator('#bulk-trash-confirm').click();page.wait_for_function("!document.querySelector('#bulk-trash-dialog').open")
 assert page.locator('.sticky-note').count()==0 and page.locator('.sticky-minimized').count()==1
 assert page.locator('#bhr-icon').count()==1 and page.locator('#calendar-maker-icon').count()==1
 page.screenshot(path='/tmp/bhr-desktop-selection.png');assert not errors,errors
 browser.close();print('Desktop marquee, bulk deletion and sticky stacking checks passed')
