import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

S = Path("/tmp/browser/cp/screens"); S.mkdir(parents=True, exist_ok=True)
BUTTONS = [
    ("Developer Dashboard", "/dashboard/developer"),
    ("Author Dashboard", "/dashboard/author"),
    ("Vendor Dashboard", "/dashboard/vendor"),
    ("Reseller Dashboard", "/dashboard/reseller"),
    ("Affiliate Dashboard", "/dashboard/affiliate"),
    ("Franchise Dashboard", "/dashboard/franchise"),
    ("Influencer Dashboard", "/dashboard/influencer"),
    ("Admin Dashboard", "/dashboard/admin"),
]

async def main():
    results = []
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width":1280,"height":1800})
        page = await ctx.new_page()
        errs = []
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errs.append(str(e)))
        for label, expected in BUTTONS:
            errs.clear()
            await page.goto("http://localhost:8080/control-panel", wait_until="domcontentloaded")
            await page.wait_for_timeout(2500)
            await page.get_by_role("button", name=label, exact=True).first.click()
            for _ in range(60):
                if expected in page.url: break
                await page.wait_for_timeout(250)
            assert expected in page.url, f"{label} -> {page.url}"
            await page.wait_for_timeout(1500)
            body = (await page.inner_text("body")).strip()
            widgets = await page.evaluate("""() => ({
              sidebar: !!document.querySelector('aside, nav'),
              buttons: document.querySelectorAll('button').length,
              headings: document.querySelectorAll('h1,h2,h3').length,
              svg: document.querySelectorAll('svg').length,
              nodes: document.body.querySelectorAll('*').length,
            })""")
            await page.reload(wait_until="domcontentloaded")
            await page.wait_for_timeout(1200)
            after_reload = page.url
            await page.go_back()
            await page.wait_for_timeout(800)
            ok = (len(body) > 400 and widgets["sidebar"] and widgets["buttons"] > 5
                  and widgets["nodes"] > 200 and expected in after_reload and not errs)
            await page.screenshot(path=str(S / (expected.strip('/').replace('/','_') + ".png")))
            results.append({"label": label, "url": expected, "reload_url_ok": expected in after_reload,
                            "back_url": page.url, "chars": len(body), **widgets,
                            "errors": errs[:3], "PASS": ok})
        await b.close()
    print(json.dumps(results, indent=1))
    print("FAILED:", [r["label"] for r in results if not r["PASS"]])

asyncio.run(main())
