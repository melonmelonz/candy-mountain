// Screenshot the art preview page with Playwright. Usage: node scripts/shoot.mjs <url> <out.png>
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:5173/preview.html";
const out = process.argv[3] ?? "/tmp/preview.png";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1320, height: 1600 }, deviceScaleFactor: 1 });
page.on("console", (m) => console.log("[page]", m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__ready === true, { timeout: 20000 }).catch(() => console.log("ready flag timeout"));
await page.waitForTimeout(400);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("shot ->", out);
