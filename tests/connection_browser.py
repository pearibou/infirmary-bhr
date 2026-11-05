"""Connection states should never imply loading when setup is absent."""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for configured in (False,True):
        context=b.new_context(service_workers='block')
        page=context.new_page()
        if configured:
            page.route('**/config.js*',lambda route:route.fulfill(content_type='application/javascript',body="window.INFIRMARY_CONFIG={clientId:'test.apps.googleusercontent.com'}"))
            page.route('https://accounts.google.com/**',lambda route:route.abort())
        else:
            page.route('**/config.js*',lambda route:route.fulfill(content_type='application/javascript',body='window.INFIRMARY_CONFIG={}'))
        page.goto('http://127.0.0.1:8000')
        page.locator('#drive-open').click()
        connect=page.locator('#google-connect')
        assert connect.is_enabled()
        assert page.locator('#drive-settings').count()==0
        assert connect.evaluate('(el)=>getComputedStyle(el).cursor')=='pointer'
        if configured:
            page.wait_for_function("document.querySelector('#drive-status').textContent.includes('retry')")
            connect.click()
            page.wait_for_function("document.querySelector('#drive-status').textContent.includes('retry')")
            assert connect.is_enabled()
        else:
            connect.click()
            assert 'administrator' in page.locator('#drive-status').inner_text()
            assert connect.get_attribute('aria-busy')=='false'
        context.close()
    b.close()
    print('PASS: missing setup is explicit; no technical settings; normal cursor; failed Google SDK load remains retryable')
