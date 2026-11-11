"""Default photos/files stay inside BHR; explicit external upload overrides still work."""
import json,urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive,ignore_event_log_projection
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=browser.new_page(viewport={'width':1440,'height':1000},service_workers='block');prepare_test_page(page)
 errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 seed={'version':1,'people':[{'id':'resident-a','name':'Synthetic resident','preferredName':'Synthetic resident','firstName':'John','lastName':'Example','info':'','notes':[],'driveFolders':[{'id':'external','name':'External archive'}],'photo':{'fileId':'old-photo','folderId':'external'},'updatedAt':'2026-01-01T00:00:00Z'}]};directory=[seed];created=[];uploads=[];put_ids=[]
 page.add_init_script("if(!localStorage.getItem('infirmary.directory.v1'))localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(seed))+");")
 def route(route):
  req=route.request;url=urllib.parse.urlparse(req.url);params=urllib.parse.parse_qs(url.query);path=url.path
  if 'alt=media' in req.url and path.endswith('/old-photo'):route.fulfill(content_type='image/png',body=Path('icons/icon-192.png').read_bytes());return
  if path.endswith('/old-photo'):route.fulfill(json={'id':'old-photo','parents':['external'],'mimeType':'image/png'});return
  if path.endswith('/root') or path.endswith('/external') or path.endswith('/resident-folder'):
   route.fulfill(json={'id':path.rsplit('/',1)[-1],'name':'Infirmary-BHR','parents':['root'],'appProperties':{'bhrWorkspace':'1'},'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}});return
  if path.endswith('/files') and req.method=='GET':
   q=params.get('q',[''])[0];route.fulfill(json={'files':created if 'bhrResidentFolder' in q else [{'id':'__test-bootstrap'}] if 'people_directory.json' in q else []});return
  if path.endswith('/files') and req.method=='POST' and 'uploadType' not in params:
   body=req.post_data_json
   if body.get('appProperties',{}).get('bhrResidentFolder')=='1':
    assert body['parents']==['root'] and body['appProperties']['personId']=='resident-a';created.append({'id':'resident-folder',**body});route.fulfill(json=created[-1]);return
   route.fulfill(status=503,json={'error':{'message':'Synthetic unrelated service unavailable'}});return
  if params.get('uploadType')==['resumable']:
   uploads.append(req.post_data_json);route.fulfill(status=200,headers={'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'Location','Location':'https://www.googleapis.com/upload/drive/synthetic-session'},json={});return
  if path.endswith('/synthetic-session') and req.method=='PUT':
   fid='uploaded-'+str(len(uploads));put_ids.append(fid);route.fulfill(json={'id':fid});return
  if path.endswith('/__test-bootstrap'):
   if req.method=='PATCH':directory[0]=req.post_data_json
   route.fulfill(json=directory[0] if req.method=='GET' else {'id':'__test-bootstrap'});return
  if '/uploaded-' in path and params.get('alt')==['media']:route.fulfill(content_type='image/png',body=Path('icons/icon-192.png').read_bytes());return
  route.fulfill(status=404,json={'error':{'message':'Synthetic file unavailable'}})
 page.route('https://www.googleapis.com/**',route);ignore_event_log_projection(page)
 page.goto('http://127.0.0.1:8000')
 try:unlock_test_drive(page)
 except Exception:
  print({'status':page.locator('#drive-status').inner_text(),'errors':errors},flush=True);raise
 assert not created
 page.locator('#detail .record-pencil').click();page.locator('#person-photo').set_input_files({'name':'synthetic-photo.png','mimeType':'image/png','buffer':Path('icons/icon-192.png').read_bytes()});page.locator('#person-submit').click();page.wait_for_function("!document.querySelector('#person-dialog').open")
 assert len(created)==1 and uploads[0]['parents']==['resident-folder']
 person=page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1')).people[0]")
 assert person['photo']=={'fileId':'uploaded-1','folderId':'resident-folder'} and any(f['id']=='external' for f in person['driveFolders'])
 page.locator('#detail').get_by_role('button',name='Upload file…',exact=True).click();assert page.locator('#upload-folder').input_value()=='__resident_default__'
 page.locator('#upload-file').set_input_files({'name':'synthetic.txt','mimeType':'text/plain','buffer':b'Synthetic document'});page.locator('#upload-submit').click();page.wait_for_function("document.querySelector('#upload-status').textContent.startsWith('Uploaded')")
 assert len(created)==1 and uploads[-1]['parents']==['resident-folder']
 page.locator('#upload-file').set_input_files({'name':'explicit.txt','mimeType':'text/plain','buffer':b'Synthetic external override'});page.locator('#upload-folder').select_option('external');page.locator('#upload-submit').click();page.wait_for_function("document.querySelector('#upload-status').textContent.startsWith('Uploaded')")
 assert uploads[-1]['parents']==['external'] and len(uploads)==3 and len(created)==1
 assert not errors,errors;browser.close()
print('PASS: lazy person-marked BHR folder, profile/default uploads inside it, folder reuse, external links preserved and explicit upload overrides honored')
