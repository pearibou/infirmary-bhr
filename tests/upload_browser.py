from browser_helpers import prepare_test_page,unlock_test_drive,open_drive,fill_death_date
"""Only synthetic bytes: verify direct Drive upload and no record persistence of file contents."""
from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=b.new_page(service_workers='block')
    person={'id':'p','name':'Synthetic Upload Test','info':'','updatedAt':'2026-01-01T00:00:00Z','notes':[],'driveFolders':[{'id':'assigned-folder','name':'Person documents'}]}
    page.add_init_script("localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps({'version':1,'people':[person]}))+");window.google={accounts:{oauth2:{initTokenClient:opts=>({requestAccessToken:()=>opts.callback({access_token:'test',expires_in:3600})})}}};")
    page.route('**/config.js*',lambda route:route.fulfill(content_type='application/javascript',body="window.INFIRMARY_CONFIG={clientId:'test.apps.googleusercontent.com'}"))
    uploads=[]
    def drive(route):
        request=route.request
        if request.method=='POST':
            assert json.loads(request.post_data)['parents']==['assigned-folder']
            route.fulfill(status=200,headers={'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'Location','Location':'https://www.googleapis.com/upload/drive/v3/files?upload_id=test'})
        elif request.method=='PUT':
            uploads.append(request.post_data_buffer)
            route.fulfill(json={'id':'test-upload'})
        else:
            route.fulfill(json={'id':'root','name':'Infirmary-BHR','appProperties':{'bhrWorkspace':'1'},'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}})
    page.route('https://www.googleapis.com/**',drive)
    page.route('https://www.googleapis.com/oauth2/v3/userinfo',lambda route:route.fulfill(json={'sub':'synthetic-staff','name':'Synthetic Staff'}))
    prepare_test_page(page)
    page.goto('http://127.0.0.1:8000')
    unlock_test_drive(page,profile=True)
    open_drive(page)
    page.get_by_role('button',name='Continue with Google').click()
    page.locator('#drive-dialog').get_by_role('button',name='Close',exact=True).click()
    before=page.evaluate("localStorage.getItem('infirmary.directory.v1')")
    page.get_by_role('button',name='Upload file…',exact=True).click()
    assert page.locator('#upload-folder').input_value()=='__resident_default__'
    page.locator('#upload-folder').select_option('assigned-folder')
    page.locator('#upload-file').set_input_files({'name':'synthetic.unrecognized','mimeType':'application/octet-stream','buffer':bytes([0,255,16,42])})
    page.locator('#upload-submit').click()
    page.wait_for_function("document.querySelector('#upload-status').textContent && !document.querySelector('#upload-status').textContent.startsWith('Uploading')")
    assert page.locator('#upload-status').inner_text().startswith('Uploaded'),page.locator('#upload-status').inner_text()
    assert uploads==[bytes([0,255,16,42])]
    after=page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1'))")
    assert after['people']==json.loads(before)['people']
    assert any(event['action']=='file.uploaded' for event in after['eventLog'])
    assert 'blob:' not in json.dumps(after) and 'data:application' not in json.dumps(after)
    assert page.locator('#upload-file').input_value()==''
    b.close()
    print('PASS: arbitrary file bytes sent directly to assigned Google Drive folder; no file content saved in person record; input cleared after upload')
