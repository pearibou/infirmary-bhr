"""UI-driven test connection. No application bypass flags; all data is synthetic."""
import json
SDK='''
window.google=window.google||{};
if(!window.google.accounts)window.google.accounts={oauth2:{initTokenClient:opts=>({requestAccessToken:()=>opts.callback({access_token:'synthetic',expires_in:3600})})}};
if(!window.google.picker){
 class View{setIncludeFolders(){return this}setSelectFolderEnabled(){return this}setMimeTypes(){return this}}
 class Builder{addView(){return this}setOAuthToken(){return this}setDeveloperKey(){return this}setAppId(){return this}setOrigin(){return this}setTitle(){return this}setCallback(cb){this.cb=cb;return this}build(){return this}setVisible(){this.cb({action:'picked',docs:[{id:'native-folder',name:'Chosen in Google'}]})}}
 window.google.picker={DocsView:View,ViewId:{FOLDERS:'folders'},PickerBuilder:Builder,Action:{PICKED:'picked',CANCEL:'cancel'}};
}
'''
def ignore_event_log_projection(page):
    page.route('https://www.googleapis.com/drive/v3/files?*BHR_event_log.txt*',lambda route:route.fulfill(json={'files':[]}))
    def upload(route):
        if 'BHR_event_log.txt' in (route.request.post_data or ''):route.fulfill(json={'id':'synthetic-event-log'})
        else:route.fallback()
    page.route('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart*',upload)
def prepare_test_page(page):
    ignore_event_log_projection(page)
    page.add_init_script(SDK)
    page.route('https://accounts.google.com/gsi/client',lambda route:route.fulfill(content_type='application/javascript',body=SDK))
def open_drive(page):
    if not page.locator('#drive-dialog').is_visible():page.locator('#drive-open').click()
def unlock_test_drive(page,profile=True):
    if not page.locator('body').evaluate("el=>el.classList.contains('drive-locked')"):return
    snapshot=page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1')||'{\"version\":1,\"people\":[]}')")
    routes=[]
    def add(pattern,handler):routes.append((pattern,handler));page.route(pattern,handler)
    add('https://www.googleapis.com/drive/v3/files/*?fields=*',lambda route:route.fulfill(json={'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}}))
    add('https://www.googleapis.com/drive/v3/files?*',lambda route:route.fulfill(json={'files':[] if 'BHR_event_log.txt' in route.request.url else [{'id':'__test-bootstrap'}]}))
    add('https://www.googleapis.com/drive/v3/files/__test-bootstrap?*',lambda route:route.fulfill(json=snapshot))
    add('https://www.googleapis.com/upload/drive/v3/files/__test-bootstrap?*',lambda route:route.fulfill(json={'id':'__test-bootstrap'}))
    if profile:page.route('https://www.googleapis.com/oauth2/v3/userinfo',lambda route:route.fulfill(json={'sub':'synthetic-staff','name':'Synthetic Staff'}))
    page.wait_for_function("window.google?.accounts?.oauth2 && !document.querySelector('#drive-status').textContent.startsWith('Preparing')")
    page.locator('#google-connect').click()
    page.locator('#use-drive-root').wait_for(state='visible')
    # Stored locations trigger the initial sync directly after authentication.
    if page.locator('#sync-folder-name').inner_text()=='No directory folder selected':page.locator('#use-drive-root').click()
    page.wait_for_function("!document.body.classList.contains('drive-locked')")
    page.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'")
    page.locator('#drive-dialog').get_by_role('button',name='Close',exact=True).click()
    for pattern,handler in routes:page.unroute(pattern,handler)
def fill_death_date(dialog,value):
    year,month,day=value.split('-')
    for label,text in [('Death year',year),('Death month',month),('Death day',day)]:dialog.get_by_label(label,exact=True).fill(text)
