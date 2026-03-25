import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        print("Navigating to local dev server...")
        await page.goto("http://localhost:4173/Agro-System/")

        print("Waiting for login inputs...")
        await page.wait_for_selector('input')

        inputs = await page.locator('input').all()
        print(f"Found {len(inputs)} inputs")

        if len(inputs) >= 2:
            print("Filling credentials...")
            await inputs[0].fill('carloshenriquefnp@gmail.com')
            await inputs[1].fill('Carlos@2022.')

            print("Clicking login button...")
            await page.get_by_text('Entrar agora').click()

        print("Waiting for map to load...")
        try:
            # Wait for something that is visibly rendered on the top navbar after login
            await page.wait_for_selector('text="AgroSystem"', timeout=15000)
            print("Map loaded.")
        except Exception as e:
            print("Timeout waiting for map, taking error screenshot.")
            await page.screenshot(path="error_state_final.png")
            raise e

        print("Checking for SweetAlert2 modals to dismiss...")
        try:
            # Try to click the OK button on the SweetAlert modal if it exists
            swal_ok = page.locator('.swal2-confirm')
            if await swal_ok.is_visible(timeout=5000):
                print("SweetAlert found. Dismissing...")
                await swal_ok.click()
                await page.wait_for_timeout(1000) # Wait for modal to disappear
        except Exception as e:
            print("No SweetAlert modal found or error dismissing it.")

        print("Taking screenshot of main screen...")
        await page.screenshot(path="main_screen.png")

        print("Selecting 'Ordem de Corte' from the native select dropdown...")
        try:
            # Click the select to open options
            await page.locator('select').first.select_option(label='Ordem de Corte')
            print("Selected Ordem de Corte.")
        except Exception as e:
            print("Failed to select Ordem de Corte.")
            print(e)

        await page.wait_for_timeout(2000) # Wait for map/features to update

        print("Taking screenshot of Ordem de Corte module...")
        await page.screenshot(path="ordem_corte_module.png")

        await browser.close()
        print("Verification complete!")

if __name__ == "__main__":
    asyncio.run(run())
