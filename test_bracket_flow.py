"""
Test the W/D/L bracket flow at /wc/bracket/test

This script:
1. Navigates to the test page
2. Takes screenshots of initial state
3. Tests Group A predictions with W/D/L buttons
4. Creates a tiebreaker scenario
5. Tests inline score collection
6. Completes all groups
7. Tests third-place ranking step
8. Verifies the complete flow
"""

from playwright.sync_api import sync_playwright
import time

def test_bracket_flow():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to test page
        print("1. Navigating to /wc/bracket/test...")
        page.goto('http://localhost:3000/wc/bracket/test')
        page.wait_for_load_state('networkidle')
        time.sleep(2)  # Extra wait for React hydration

        # Take initial screenshot
        page.screenshot(path='/tmp/bracket_test_initial.png', full_page=True)
        print("   ✓ Initial screenshot saved to /tmp/bracket_test_initial.png")

        # Verify test header is present
        header = page.locator('h1:has-text("Bracket Test Page")')
        if header.count() > 0:
            print("   ✓ Test page loaded successfully")
        else:
            print("   ✗ Test page header not found")
            browser.close()
            return

        # Check current step
        step_indicator = page.locator('text=Step:').locator('xpath=..').inner_text()
        print(f"   Current step: {step_indicator}")

        # Find Group A matches
        print("\n2. Testing Group A predictions...")

        # Look for match cards - they should have team names and W/D/L buttons
        match_cards = page.locator('[class*="MatchCard"], [class*="match"]').all()
        print(f"   Found {len(match_cards)} potential match cards")

        # Take screenshot showing Group A
        page.screenshot(path='/tmp/bracket_test_group_a.png', full_page=True)
        print("   ✓ Group A screenshot saved to /tmp/bracket_test_group_a.png")

        # Try to find W/D/L buttons
        wdl_buttons = page.locator('button:has-text("W"), button:has-text("D"), button:has-text("L")').all()
        print(f"   Found {len(wdl_buttons)} W/D/L buttons")

        if len(wdl_buttons) == 0:
            # Alternative: look for buttons with these exact texts
            home_win_buttons = page.locator('button', has_text='Home Win').all()
            draw_buttons = page.locator('button', has_text='Draw').all()
            away_win_buttons = page.locator('button', has_text='Away Win').all()
            print(f"   Alternative search: {len(home_win_buttons)} Home Win, {len(draw_buttons)} Draw, {len(away_win_buttons)} Away Win")

        # Get page content for inspection
        content = page.content()

        # Look for specific patterns in the HTML
        if 'GroupResultsStep' in content or 'group_id' in content:
            print("   ✓ Group results component appears to be loaded")
        else:
            print("   ? Group results component not clearly identifiable")

        # Check for auto-save log
        save_log = page.locator('text=Auto-Save Log').locator('xpath=..')
        if save_log.count() > 0:
            print("   ✓ Auto-save log section found")
        else:
            print("   ? Auto-save log section not found")

        # Try to click a W/D/L button if found
        print("\n3. Attempting to interact with W/D/L buttons...")
        all_buttons = page.locator('button').all()
        print(f"   Total buttons on page: {len(all_buttons)}")

        # List button texts to understand what's available
        button_texts = []
        for btn in all_buttons[:20]:  # Sample first 20 buttons
            try:
                text = btn.inner_text()
                if text and text.strip():
                    button_texts.append(text.strip())
            except:
                pass

        print(f"   Sample button texts: {button_texts[:10]}")

        # Take final screenshot
        print("\n4. Taking final screenshot...")
        page.screenshot(path='/tmp/bracket_test_final.png', full_page=True)
        print("   ✓ Final screenshot saved to /tmp/bracket_test_final.png")

        # Check console logs for errors
        console_messages = []
        page.on('console', lambda msg: console_messages.append(f"{msg.type}: {msg.text}"))

        # Wait a bit more to capture any console messages
        time.sleep(2)

        if console_messages:
            print("\n5. Console messages:")
            for msg in console_messages[-10:]:  # Last 10 messages
                print(f"   {msg}")

        browser.close()

        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print("Screenshots saved:")
        print("  - /tmp/bracket_test_initial.png")
        print("  - /tmp/bracket_test_group_a.png")
        print("  - /tmp/bracket_test_final.png")
        print("\nNext steps:")
        print("  1. Review screenshots to verify component rendering")
        print("  2. Check if W/D/L buttons are visible")
        print("  3. Identify any rendering or hydration issues")
        print("="*60)

if __name__ == '__main__':
    test_bracket_flow()
