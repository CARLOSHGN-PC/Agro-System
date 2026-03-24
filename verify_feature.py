from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        try:
            # 1. Navigate to the app
            page.goto("http://localhost:4173/Agro-System/")

            # Wait for the app to load
            time.sleep(2)

            # 2. Login Offline Bypass
            page.evaluate('''() => {
                return crypto.subtle.digest('SHA-256', new TextEncoder().encode('123456'))
                    .then(hashBuffer => {
                        const hashArray = Array.from(new Uint8Array(hashBuffer));
                        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                        localStorage.setItem('@AgroSystem:auth', JSON.stringify({e: 'test@test.com', hash: hashHex}));
                    });
            }''')

            context.set_offline(True)
            time.sleep(1)

            # Fill credentials
            inputs = page.locator("input")
            inputs.nth(0).fill("test@test.com")
            inputs.nth(1).fill("123456")

            # Click Login
            page.get_by_role("button", name="Entrar agora").click()
            time.sleep(2)

            context.set_offline(False)
            time.sleep(1)

            # Dismiss any SweetAlert2 dialogs that appear (like offline/online warnings or errors)
            if page.locator(".swal2-confirm").is_visible():
                page.locator(".swal2-confirm").click()
                time.sleep(1)

            # Take a screenshot to see if we bypassed login
            page.screenshot(path="dashboard_screen.png")
            print("Took screenshot of dashboard")

            # 3. Open Sidebar Menu
            # The menu button is usually the first button or a specific toggle
            page.locator("button").first.click()
            time.sleep(1)

            page.screenshot(path="sidebar_screen.png")
            print("Took screenshot of sidebar")

            # 4. Click on 'Cadastro Profissional'
            cadastro_btn = page.locator("button", has_text="Cadastro Profissional").first
            cadastro_btn.click()
            time.sleep(1)

            # 5. Screenshot the new module page
            page.screenshot(path="cadastro_profissional_page.png")
            print("Took screenshot of Cadastro Profissional page")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="error_screen.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()