"""Header regression: normal and failed app startup, desktop through mobile."""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for blocked in (False,True):
        context=browser.new_context(service_workers='block')
        page=context.new_page()
        if blocked:
            page.route('**/app.js*',lambda route:route.abort())
        page.goto('http://127.0.0.1:8000')
        assert page.locator('.menubar > strong').inner_text()=='Mepkin Abbey Infirmary'
        page.wait_for_function("/^[A-Za-z]+, \\d{2} [A-Za-z]+ \\d{4} \\d{2}:\\d{2}:\\d{2} (AM|PM)$/.test(document.querySelector('#clock').textContent)")
        assert page.locator('.clock-time').evaluate('(el)=>getComputedStyle(el).fontWeight')=='700'
        first=page.locator('#clock').inner_text()
        page.wait_for_function('(old)=>document.querySelector("#clock").textContent!==old',arg=first)
        for width in (1280,900,820,768,701,700,390,375,320):
            page.set_viewport_size({'width':width,'height':844})
            clock=page.locator('#clock')
            assert clock.is_visible(),(blocked,width)
            box=clock.bounding_box()
            assert box['x']>=0 and box['x']+box['width']<=width,(blocked,width,box)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(blocked,width)
        context.close()
    browser.close()
    print('PASS: ticking clock with normal/blocked app startup; visible within header at nine desktop/tablet/mobile widths')
