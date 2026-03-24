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

            # 2. Hardcode the offline auth token for "test@test.com" and "123456"
            # SHA-256 of '123456' is 8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92
            page.evaluate("""() => {
                localStorage.setItem('@AgroSystem:auth', JSON.stringify({
                    e: 'test@test.com',
                    hash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'
                }));
            }""")

            context.set_offline(True)
            time.sleep(1)

            # Fill credentials (make sure to clear existing content if any)
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
            page.locator("button").first.click()
            time.sleep(1)

            page.screenshot(path="sidebar_screen.png")
            print("Took screenshot of sidebar")

            # 4. Click on 'Relatórios'
            page.locator("button", has_text="Relatórios").first.click()
            time.sleep(1)

            # 5. Screenshot the new module page
            page.screenshot(path="relatorio_estimativa_page.png")
            print("Took screenshot of Relatório de Estimativa page")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="error_screen.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()