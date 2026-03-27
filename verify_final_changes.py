import time
import json
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        page.goto("http://localhost:4173/Agro-System/")

        # Inject localStorage correctly
        page.evaluate("""
            window.localStorage.setItem('@AgroSystem:auth', JSON.stringify({
                "e": "teste@usina.com",
                "hash": "8d704af3e0a95d8a24bb44888135e74d2092b882da8d0f278722b935ff4e5e04",
                "companyId": "Usina_Cacu",
                "role": "admin",
                "uid": "mock-uid-123"
            }));

            // Mock navigator.onLine to bypass Firebase authentication and rely on local hash
            Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        """)

        # We don't want to reload the page right after because that would clear our mock property,
        # but if we do reload, we need to apply the mock property again.
        # However, LoginScreen does not auto-login on load! The user MUST press "Entrar".
        # So we just fill out the form.

        try:
            inputs = page.locator('input')
            if inputs.count() >= 2:
                inputs.nth(0).fill('teste@usina.com')
                inputs.nth(1).fill('usina2024')
                page.click('button:has-text("Entrar")')
                time.sleep(2)
        except Exception as e:
            print("Login form fill exception:", e)

        # Restore online so that Firestore can load the UI data
        page.evaluate("""
            Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
        """)

        # Clicar no botão OK do SweetAlert se houver
        try:
            page.click("button.swal2-confirm", timeout=3000)
            time.sleep(1)
        except:
            pass

        # Espera o ícone de Menu
        try:
            page.wait_for_selector(".lucide-menu", timeout=10000)
        except Exception as e:
            page.screenshot(path="/home/jules/verification/0_fail_menu.png")
            print("Failed waiting for menu.")
            raise e

        time.sleep(2)
        page.screenshot(path="/home/jules/verification/1_main_view.png")

        # Clicar no botão que contém o menu
        page.locator(".lucide-menu").click()
        time.sleep(1)

        page.screenshot(path="/home/jules/verification/1.5_menu.png")

        # Clicar em "Configuração da Empresa"
        try:
            page.click("text=Configuração da Empresa", timeout=5000)
        except:
            pass
        time.sleep(2)

        # Tirar print da tela de configuração
        page.screenshot(path="/home/jules/verification/2_config_color.png")

        # Abrir menu lateral novamente para ir para premissas
        try:
            page.locator(".lucide-menu").click()
            time.sleep(1)
        except:
            pass

        # Clicar em "Premissas"
        try:
            page.click("text=Premissas", timeout=5000)
        except:
            pass
        time.sleep(2)

        page.screenshot(path="/home/jules/verification/3_premissas.png")

        print("Screenshots captured successfully.")
        browser.close()

if __name__ == "__main__":
    run()
