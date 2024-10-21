import {
  openBrowser,
  openPage,
  openSendMiniApp,
  openTokenByName,
  work,
} from "./puppeteer_actions";

(async function () {
  const browser = await openBrowser();
  const page = await openPage(browser);

  await openSendMiniApp(page);
  await openTokenByName(page, "USD Coin");
  setInterval(async () => await work(page), 15000);
})();
