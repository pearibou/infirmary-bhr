"""Person forms, folder persistence, and mocked native Google OAuth/Picker flow."""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=b.new_context(service_workers='block')
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('**/config.js*',lambda route:route.fulfill(content_type='application/javascript',body="window.INFIRMARY_CONFIG={clientId:'test.apps.googleusercontent.com',pickerApiKey:'test',projectNumber:'123'}"))
    page.add_init_script('''
    window.oauthCalls=0;
    class View{setIncludeFolders(){return this}setSelectFolderEnabled(){return this}setMimeTypes(){return this}}
    class Builder{addView(){return this}setOAuthToken(){return this}setDeveloperKey(){return this}setAppId(){return this}setOrigin(){return this}setTitle(){return this}setCallback(cb){this.cb=cb;return this}build(){return this}setVisible(){this.cb({action:'picked',docs:[{id:'native-folder',name:'Chosen in Google'}]})}}
    window.google={accounts:{oauth2:{initTokenClient:opts=>({requestAccessToken:()=>{window.oauthCalls++;opts.callback({access_token:'test',expires_in:3600})}})}},picker:{DocsView:View,ViewId:{FOLDERS:'folders'},PickerBuilder:Builder,Action:{PICKED:'picked',CANCEL:'cancel'}}};
    ''')
    page.goto('http://127.0.0.1:8000')
    page.locator('#add-person').click()
    dialog=page.locator('#person-dialog')
    assert dialog.get_by_label('Location',exact=False).count()==0
    dialog.get_by_role('button',name='Add person',exact=True).click()
    assert page.locator('#person-error').inner_text()=='Enter at least one name.'
    dialog.get_by_label('Last name',exact=True).fill('Doe')
    dialog.get_by_label('Month',exact=True).fill('2')
    dialog.get_by_label('Day',exact=True).fill('30')
    dialog.get_by_role('button',name='Add person',exact=True).click()
    assert 'does not exist' in page.locator('#person-error').inner_text()
    dialog.get_by_label('Day',exact=True).fill('')
    dialog.get_by_role('button',name='Add person',exact=True).click()
    assert page.locator('.person-header h2').inner_text()=='Doe'
    for field,value in [('First name','John'),('Preferred name','Brother Joseph')]:
        page.locator('#add-person').click()
        dialog.get_by_label(field,exact=True).fill(value)
        dialog.get_by_role('button',name='Add person',exact=True).click()
        assert page.locator('.person-header h2').inner_text()==value
    page.get_by_role('button',name='Attach folder…').click()
    page.get_by_label('Folder name (optional)').fill('Care documents')
    page.get_by_label('Google Drive folder link',exact=True).fill('https://drive.google.com/drive/folders/care-folder')
    page.locator('#folder-dialog').get_by_role('button',name='Attach folder',exact=True).click()
    assert page.get_by_role('link',name='Care documents').get_attribute('href').endswith('/care-folder')
    page.reload()
    page.get_by_role('button',name='Brother Joseph',exact=True).click()
    assert page.get_by_role('link',name='Care documents').is_visible()
    page.locator('#drive-open').click()
    page.get_by_role('button',name='Continue with Google').click()
    assert page.evaluate('window.oauthCalls')==1
    page.get_by_role('button',name='Use My Drive (root)').click()
    assert page.locator('#sync-folder-name').inner_text()=='My Drive (root)'
    assert page.evaluate("JSON.parse(localStorage.getItem('infirmary.drive')).folder")=='root'
    page.get_by_role('button',name='Choose directory folder…').click()
    assert page.locator('#sync-folder-name').inner_text()=='Chosen in Google'
    page.locator('#drive-dialog').get_by_role('button',name='Close',exact=True).click()
    page.get_by_role('button',name='Attach folder…').click()
    page.get_by_role('button',name='Browse Google Drive…').click()
    assert page.get_by_role('link',name='Chosen in Google').is_visible()
    assert page.locator('.folder-link').count()==2
    page.set_viewport_size({'width':320,'height':844})
    page.locator('#add-person').click()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    print('PASS: name alternatives; blank/partial DOB; invalid date; link persistence; mocked OAuth; native picker selection; per-person picker attachment; mobile form')
    b.close()
