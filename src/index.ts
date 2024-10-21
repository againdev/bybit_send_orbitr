import { Browser } from "puppeteer";
import {
  openBrowser,
  openPage,
  openSendMiniApp,
  openTokenByName,
  reloadFrame,
  work,
} from "./puppeteer_actions";
import { OrderState } from "./types";

async function main(browser: Browser | null = null) {
  try {
    if (!browser) {
      browser = await openBrowser();
    }

    const page = await openPage(browser);
    await openSendMiniApp(page);
    await openTokenByName(page, "USD Coin");

    const circle = async () => {
      await work(page);
      await reloadFrame(page);
      await circle();
    };

    try {
      await circle();
    } catch (error) {
      console.error("Error in circle function:", error);
      await browser.close();
      await main();
    }
  } catch (error) {
    console.error("Error in main function:", error);

    OrderState.myOrder = 0;

    if (browser) {
      await browser.close();
    }

    setTimeout(async () => {
      await main();
    }, 2000);
  }
}

main();
