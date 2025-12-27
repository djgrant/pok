#!/usr/bin/env python3
"""
Screenshot tool for the interactive website.

Usage:
    python screenshot.py [url] [output_path] [--wait SECONDS] [--full-page]

Examples:
    python screenshot.py                                    # Screenshot localhost:5173 to .screenshots/screenshot.png
    python screenshot.py http://localhost:5173 out.png     # Custom URL and output
    python screenshot.py --wait 5                          # Wait 5 seconds before screenshot
    python screenshot.py --full-page                       # Capture full page scroll

This tool is designed to help visualize the website during development.
Screenshots are saved to .screenshots/ directory (gitignored).
"""

import argparse
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

# Default screenshots directory (gitignored)
SCREENSHOTS_DIR = Path(__file__).parent.parent.parent / ".screenshots"


def take_screenshot(
    url: str = "http://localhost:5173",
    output: str | None = None,
    wait_seconds: float = 2,
    full_page: bool = False,
    width: int = 1280,
    height: int = 800,
):
    """Take a screenshot of the given URL."""
    # Default output to .screenshots/screenshot.png
    if output is None:
        SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
        output = str(SCREENSHOTS_DIR / "screenshot.png")
    
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        
        # Create context with viewport size
        context = browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=2,  # Retina-quality screenshots
        )
        
        page = context.new_page()
        
        try:
            # Navigate to the page
            print(f"Navigating to {url}...")
            # Use domcontentloaded instead of networkidle since WebContainers
            # keep connections open that prevent networkidle from resolving
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            
            # Additional wait for dynamic content (WebContainer takes time to boot)
            if wait_seconds > 0:
                print(f"Waiting {wait_seconds}s for dynamic content...")
                page.wait_for_timeout(int(wait_seconds * 1000))
            
            # Take screenshot
            print(f"Taking screenshot -> {output}")
            page.screenshot(path=output, full_page=full_page)
            print("Done!")
            
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
        finally:
            browser.close()


def main():
    parser = argparse.ArgumentParser(
        description="Take screenshots of the interactive website"
    )
    parser.add_argument(
        "url",
        nargs="?",
        default="http://localhost:5173",
        help="URL to screenshot (default: http://localhost:5173)",
    )
    parser.add_argument(
        "output",
        nargs="?",
        default=None,
        help="Output file path (default: .screenshots/screenshot.png)",
    )
    parser.add_argument(
        "--wait",
        type=float,
        default=2,
        help="Seconds to wait after page load (default: 2)",
    )
    parser.add_argument(
        "--full-page",
        action="store_true",
        help="Capture full page (scrollable content)",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=1280,
        help="Viewport width (default: 1280)",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=800,
        help="Viewport height (default: 800)",
    )
    
    args = parser.parse_args()
    
    take_screenshot(
        url=args.url,
        output=args.output,
        wait_seconds=args.wait,
        full_page=args.full_page,
        width=args.width,
        height=args.height,
    )


if __name__ == "__main__":
    main()
