import os
from playwright.sync_api import sync_playwright

def verify_ordem_corte():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Navigate to index first
        page.goto("http://localhost:4173/Agro-System/")

        # Inject the mock auth state to bypass the login screen
        mock_auth = '{"email":"test@example.com","hash":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}'
        page.evaluate(f"window.localStorage.setItem('@AgroSystem:auth', '{mock_auth}')")

        # Reload to apply the auth state
        page.reload()

        # Wait for the map or main screen to appear indicating successful login
        page.wait_for_selector(".mapboxgl-map, div.sticky.top-0")
        print("Logged in, attempting navigation to Ordem de Corte")

        # Click the menu button. It is the first button inside the sticky TopNavbar
        menu_button = page.locator("div.sticky.top-0 button").first
        menu_button.click()

        # Wait for the sidebar menu to open and click "Ordens de Corte"
        page.wait_for_selector("text=Ordens de Corte")
        page.locator("button:has-text('Ordens de Corte')").click()

        # Wait for the Ordem de Corte module to load
        page.wait_for_selector("text=Gerenciamento de Ordens de Corte")

        # Give it a moment to render completely
        page.wait_for_timeout(2000)

        # Take a screenshot
        os.makedirs("/home/jules/verification", exist_ok=True)
        screenshot_path = "/home/jules/verification/ordem_corte_dark.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_ordem_corte()