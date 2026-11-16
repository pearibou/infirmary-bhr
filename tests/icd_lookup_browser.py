"""Public reference browsing and workspace reservation; all records are synthetic."""
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},service_workers='block');prepare_test_page(page)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('https://www.googleapis.com/drive/v3/files?*',lambda route:route.fulfill(json={'files':[]}))
    page.goto('http://127.0.0.1:8000');unlock_test_drive(page,open_records=False)
    assert page.locator('#icd-lookup-icon').bounding_box()['y']>page.locator('#calendar-maker-icon').bounding_box()['y']
    assert not any('icd10cm-tabular' in e['name'] for e in page.evaluate('performance.getEntriesByType("resource").map(e=>({name:e.name}))'))
    page.locator('#icd-lookup-icon').dblclick()
    page.wait_for_function("document.querySelector('#icd-status').textContent.startsWith('Public reference')")
    dialog=page.locator('#icd-lookup-dialog');assert not dialog.evaluate('el=>el.matches(":modal")')
    query=page.locator('#icd-query');query.fill('I11');query.press('Enter')
    page.locator('#icd-list .icd-result').first.click()
    assert page.locator('#icd-detail .icd-reportable').inner_text()=='Choose a more specific code'
    page.locator('#icd-detail .icd-result').filter(has_text='I11.0').click()
    assert page.locator('#icd-detail h2').bounding_box()['y']>=page.locator('#icd-detail nav').bounding_box()['y']+page.locator('#icd-detail nav').bounding_box()['height']+7
    assert page.locator('#icd-detail .icd-reportable').inner_text()=='Reportable'
    assert page.locator('#icd-detail').get_by_role('button',name='Copy code #',exact=True).is_visible()
    assert page.locator('#icd-detail').get_by_role('button',name='Copy diagnosis',exact=True).is_visible()
    assert page.get_by_role('button',name='Bookmarked/recent',exact=True).is_visible()
    assert 'Use additional code' in page.locator('#icd-detail').inner_text()
    page.locator('#icd-detail').get_by_role('button',name='☆ Bookmark',exact=True).click()
    page.evaluate("window.copied='';Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copied=text}},configurable:true})")
    page.locator('#icd-detail').get_by_role('button',name='Copy both',exact=True).click();assert page.evaluate('window.copied').startswith('I11.0 — ')
    page.locator('#icd-detail').get_by_role('button',name='Clear active diagnosis',exact=True).click()
    assert 'Select a result or category' in page.locator('#icd-detail').inner_text()
    assert query.input_value()=='I11' and page.locator('#icd-list .icd-result').count()>0
    page.locator('#icd-list .icd-result').first.click()
    page.locator('[data-tab=browse]').click();assert page.locator('#icd-list .icd-result').count()==22
    page.locator('#icd-list .icd-result').first.click();assert page.locator('#icd-detail .icd-result').count()>0
    page.locator('[data-tab=saved]').click();assert 'I11.0' in page.locator('#icd-list').inner_text() and 'I11' in page.locator('#icd-list').inner_text()
    page.locator('[data-side=right]').click()
    page.locator('#icd-list .icd-result').first.click()
    page.locator('#icd-detail').get_by_role('button',name='Clear active diagnosis',exact=True).click()
    assert page.locator('#icd-navigation').is_visible() and 'I11.0' in page.locator('#icd-list').inner_text()
    assert page.locator('body').evaluate("el=>el.classList.contains('icd-reference-reserved')")
    page.locator('#bhr-icon').dblclick()
    page.locator('#maximize-main').click()
    bounds=dialog.bounding_box();assert page.locator('#records-window').bounding_box()['width']<=bounds['x']+1
    handle=page.locator('#icd-resizer');handle.focus();page.keyboard.press('ArrowLeft');assert handle.get_attribute('aria-valuenow')=='370'
    page.locator('[data-side=left]').click();assert dialog.bounding_box()['x']==0
    assert page.locator('#records-window').bounding_box()['x']>=370
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_function("!document.body.classList.contains('icd-reference-reserved')")
    assert dialog.evaluate('el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1}')
    page.set_viewport_size({'width':1440,'height':1000});page.wait_for_function("document.querySelector('#icd-lookup-dialog').dataset.snap==='left'")
    page.locator('#icd-lookup-dialog .window-control').click();page.wait_for_function("!document.body.classList.contains('icd-reference-reserved')")
    page.locator('#window-dock [data-window=icd-lookup-dialog]').click();assert page.locator('body').evaluate("el=>el.classList.contains('icd-reference-reserved')")
    page.locator('[data-close=icd-lookup-dialog]').click();page.wait_for_function("!document.body.classList.contains('icd-reference-reserved')")
    page.locator('#close-main').click();page.locator('#icd-lookup-icon').dblclick();assert dialog.get_attribute('data-snap')=='left'
    page.screenshot(path='/tmp/icd-lookup-panel.png')
    page.evaluate("import('./icd-lookup.js?v=1').then(m=>m.icdLookupSession(false))")
    page.wait_for_function("!document.querySelector('#icd-lookup-dialog').open")
    assert page.locator('#icd-query').input_value()=='' and page.locator('#icd-detail').inner_text()==''
    assert not errors,errors
    # The large reference is absent from install downloads, then cached after use.
    context=browser.new_context(service_workers='allow');offline=context.new_page();prepare_test_page(offline)
    offline.goto('http://127.0.0.1:8000')
    offline.evaluate('navigator.serviceWorker.ready')
    offline.wait_for_function('navigator.serviceWorker.controller!==null')
    assert not offline.evaluate("caches.match('./data/icd10cm-tabular-2027.json').then(Boolean)")
    assert offline.evaluate("fetch('./data/icd10cm-tabular-2027.json').then(r=>r.json()).then(d=>d.reportableCount)")==74879
    offline.wait_for_function("caches.match('./data/icd10cm-tabular-2027.json').then(Boolean)")
    context.set_offline(True)
    assert offline.evaluate("fetch('./data/icd10cm-tabular-2027.json',{cache:'no-store'}).then(r=>r.json()).then(d=>d.nodes.length)")==98722
    browser.close();print('ICD lookup browser and offline-cache checks passed')
