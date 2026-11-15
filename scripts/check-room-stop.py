"""Headless Stop regression. Requires the separately installed Playwright runtime; never calls AI."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('url')
parser.add_argument('receipt', type=Path)
args = parser.parse_args()
results = []
with sync_playwright() as playwright:
    for width, height, motion in [(1280, 800, 'no-preference'), (375, 667, 'reduce'), (320, 640, 'no-preference')]:
        browser = playwright.chromium.launch(headless=True, channel='chromium', args=['--use-angle=metal'])
        row = {'width': width, 'height': height, 'motion': motion}
        errors, inference = [], []
        try:
            context = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion=motion)
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            def block_inference(route):
                inference.append(route.request.url)
                route.abort()
            page.route('**/api/interpret', block_inference)
            page.route('**/api/command', block_inference)
            page.goto(args.url, wait_until='networkidle')
            page.wait_for_function("document.body.dataset.ready === 'ready'")
            page.locator('#assistant-keyboard').click()
            page.locator('#assistant-text').fill('show me what you can do')
            page.locator('#assistant-text').press('Enter')
            page.wait_for_function("document.querySelector('#assistant-panel').dataset.state === 'thinking'")
            assert page.locator('#assistant-stop').is_visible(), 'Pending request did not expose Stop'
            row['before'] = page.locator('#assistant-panel').get_attribute('data-state')
            page.locator('#assistant-stop').click()
            page.wait_for_timeout(1200)
            row['after'] = {
                'state': page.locator('#assistant-panel').get_attribute('data-state'),
                'label': page.locator('#assistant-state').inner_text(),
                'stopHidden': page.locator('#assistant-stop').is_hidden(),
                'roll': page.locator('.nox-ball').evaluate('(el) => getComputedStyle(el).animationName'),
                'clock': page.locator('#clock').inner_text(),
            }
            assert row['after']['state'] == 'idle', row['after']
            assert row['after']['label'] == 'Click to speak', row['after']
            assert row['after']['stopHidden'] and row['after']['roll'] == 'none', row['after']
            page.wait_for_timeout(600)
            assert page.locator('#clock').inner_text() == row['after']['clock'], 'Stopped clock advanced'
            page.locator('#assistant-text').fill('make a ramp with a ball')
            page.locator('#assistant-text').press('Enter')
            page.wait_for_function("document.querySelector('#mode').textContent === 'Running' && parseFloat(document.querySelector('#clock').textContent) > .25", timeout=12000)
            row['nextRequestRuns'] = True
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
            assert not errors, errors
            assert not inference, inference
            row['status'] = 'PASS'
        except Exception as error:
            row['status'] = 'FAIL'
            row['failure'] = str(error)[:1200]
            row['observed'] = page.evaluate("Object.fromEntries(['mode','clock','error','assistant-caption','assistant-state'].map(id => [id, document.getElementById(id)?.textContent]))")
        finally:
            row['pageErrors'], row['inferenceRequests'] = errors, inference
            browser.close()
            row['browserClosed'] = True
        results.append(row)
        print(json.dumps(row), flush=True)
receipt = {'url': args.url, 'mediaCapture': False, 'vendorCalls': 0, 'results': results}
args.receipt.parent.mkdir(parents=True, exist_ok=True)
args.receipt.write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt, indent=2))
raise SystemExit(0 if all(row['status'] == 'PASS' for row in results) else 1)
