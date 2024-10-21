import path from "path";
import puppeteer, { Browser, ElementHandle, Frame, Page } from "puppeteer";
import dotenv from "dotenv";
import { delay } from "./utils";
import { getBalance } from "./fetch";

dotenv.config();

export const openBrowser = async (): Promise<Browser> => {
  return await puppeteer.launch({
    headless: false,
    args: [`--user-data-dir=${path.resolve("./user_data")}`],
  });
};

export const openPage = async (browser: Browser): Promise<Page> => {
  const page = await browser.newPage();

  await page.setViewport({
    width: 1280,
    height: 800,
  });
  await page.goto(process.env.BOT_LINK as string);

  const url = process.env.BOT_LINK;
  if (!url) {
    throw new Error("BOT_LINK is not defined");
  }

  await page.goto(url, { waitUntil: "domcontentloaded" });

  return page;
};

export const openSendMiniApp = async (page: Page): Promise<void> => {
  await page.waitForSelector(".is-web-view.reply-markup-button.rp", {
    visible: true,
    timeout: 120000,
  });
  await delay(1000);
  await page.click(".is-web-view.reply-markup-button.rp");

  try {
    await page.waitForSelector(".popup-button.btn.primary.rp", {
      visible: true,
      timeout: 5000,
    });
    console.log("Кнопка (Launch) найдена, кликаем...");
    await page.click(".popup-button.btn.primary.rp");
  } catch (error) {
    console.error(
      "Ошибка: Кнопка (Launch) не найдена или произошла ошибка ожидания"
    );
  }

  await page.waitForSelector(".movable-element.animated-item", {
    visible: true,
  });
  const elementText = await page.evaluate(() => {
    const element = document.querySelector(".movable-element.animated-item");
    return element ? element.textContent : null;
  });

  if (elementText && elementText.includes("Crypto Bot")) {
    console.log("Miniapp loaded: Crypto Bot");
  } else {
    console.log("Ошибка: Miniapp не загружен или текст не соответствует.");
  }
};

export const openTokenByName = async (
  page: Page,
  tokenName: string
): Promise<void> => {
  await page.waitForSelector("iframe");

  const frameHandle = await page.$("iframe");
  const frame = await frameHandle?.contentFrame();

  if (!frame) {
    console.log("Не удалось получить содержимое iframe.");
    return;
  }

  const result = await frame.evaluate((tokenName) => {
    const listElement = document.querySelector("ul._list_1ni5n_1");

    if (!listElement) {
      return { success: false, message: "Список ul не найден." };
    }

    const tokenElement = Array.from(listElement.querySelectorAll("li *")).find(
      (el) => el.textContent?.includes(tokenName)
    );

    if (tokenElement) {
      const parentLi = tokenElement.closest("li");
      if (parentLi) {
        const linkElement = parentLi.querySelector("a");
        if (linkElement) {
          linkElement.click();
          return {
            success: true,
            message: "Клик по элементу успешно выполнен.",
          };
        } else {
          return { success: false, message: "Тег <a> не найден." };
        }
      }
    }

    return { success: false, message: "Элемент с текстом не найден." };
  }, tokenName);

  console.log(result.message);

  if (result.success) {
    await frame.waitForSelector('[data-test-id="exchange-button"]', {
      visible: true,
    });

    await delay(1000);
    const exchangeButton = await frame.$('[data-test-id="exchange-button"]');
    if (exchangeButton) {
      await exchangeButton.click();
      console.log("Клик по кнопке обмена выполнен.");
    } else {
      console.log("Кнопка обмена не найдена.");
      return;
    }

    const linkElementHandle = await frame.evaluateHandle(() => {
      const links = Array.from(document.querySelectorAll("a"));
      return links.find((link) => link.textContent?.includes("Биржа")) || null;
    });

    await delay(3000);
    if (linkElementHandle) {
      const elementHandle =
        linkElementHandle.asElement() as ElementHandle<Element>;
      if (elementHandle) {
        await elementHandle.click();
        console.log("Клик по ссылке 'Биржа' выполнен.");
      } else {
        console.log("Ссылка 'Биржа' не найдена или не является элементом.");
      }
    } else {
      console.log("Ссылка 'Биржа' не найдена.");
    }
  }
};

let myOrder: number = 0;

export const work = async (
  page: Page,
  maxOrderAmount: number = 0.991,
  defaultOrderAmount: number = 0.98
): Promise<void> => {
  console.log("Waiting for iframe...");
  await page.waitForSelector("iframe");

  const frameHandle = await page.$("iframe");
  const frame = await frameHandle?.contentFrame();

  if (!frame) {
    console.log("Не удалось получить содержимое iframe.");
    return;
  }

  console.log("Iframe loaded successfully.");

  const maxBuyOrder = await checkMaxBuyOrder(frame);
  console.log("Max buy order:", maxBuyOrder);
  const balance = await getBalance("USDT");
  console.log("Balance: ", balance);

  if (maxBuyOrder < maxOrderAmount) {
    if (maxBuyOrder > myOrder) {
      await cancelAllOrders(page, frame);
      await delay(1000);
      await setBuyPriceAndUsdtAmount(frame, maxBuyOrder + 0.0001, balance);
      myOrder = maxBuyOrder + 0.0001;
      await confirmOrder(page);
    }
  } else {
    if (myOrder !== maxBuyOrder) {
      await cancelAllOrders(page, frame);
      await delay(1000);
      await setBuyPriceAndUsdtAmount(frame, defaultOrderAmount, balance);
      myOrder = defaultOrderAmount;
      await confirmOrder(page);
    }
  }
};

const checkMaxBuyOrder = async (frame: Frame): Promise<number> => {
  console.log("Waiting for elements with data-key='0'...");
  try {
    await frame.waitForSelector('[data-key="0"]', { timeout: 5000 });
    console.log("Elements found.");
  } catch (error) {
    console.log(
      "Elements with data-key='0' not found within the timeout.",
      error
    );
    return 0;
  }

  const result = await frame.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('[data-key="0"]'));
    console.log("Elements found:", elements);

    if (elements.length < 2) {
      return { success: false, message: "Less than two elements found." };
    }

    const secondElement = elements[1];

    const span = secondElement.querySelector("span");
    if (!span) {
      return { success: false, message: "Span not found." };
    }

    console.log("Span found:", span);
    const priceText = span.textContent?.trim() || "";
    return { success: true, priceText };
  });

  if (!result.success) {
    console.log(result.message);
    return 0;
  }

  const price = parseFloat(result.priceText ?? "0");
  return isNaN(price) ? 0 : price;
};

const setBuyPriceAndUsdtAmount = async (
  frame: Frame,
  buyPrice: number,
  usdtAmount: number
): Promise<void> => {
  const buyPriceInputSelector = '[data-test-id="exchange-price-input-input"]';
  const usdtAmountInputSelector = '[data-test-id="amount-input-input"]';

  try {
    const buyPriceInputElement = await frame.waitForSelector(
      buyPriceInputSelector,
      {
        visible: true,
      }
    );

    if (!buyPriceInputElement) {
      console.error("Buy price input element not found.");
      return;
    }

    await buyPriceInputElement.click({ clickCount: 3 });
    await buyPriceInputElement.press("Backspace");
    await buyPriceInputElement.type(buyPrice.toString());

    console.log(`Successfully set buy price to ${buyPrice}`);

    const usdtAmountInputElement = await frame.waitForSelector(
      usdtAmountInputSelector,
      {
        visible: true,
      }
    );

    if (!usdtAmountInputElement) {
      console.error("USDT amount input element not found.");
      return;
    }

    await usdtAmountInputElement.click({ clickCount: 3 });
    await usdtAmountInputElement.press("Backspace");
    await usdtAmountInputElement.type(usdtAmount.toString());
    await usdtAmountInputElement.press("Enter");

    console.log(`Successfully set USDT amount to ${usdtAmount}`);
  } catch (error) {
    console.error("Error setting values:", error);
  }
};

const confirmOrder = async (page: Page): Promise<void> => {
  const footerSelector = ".web-app-footer.is-visible";
  const buttonSelector = "button";

  await page.waitForSelector(footerSelector, {
    visible: true,
  });

  try {
    const confirmResult = await page.evaluate(
      (footerSelector, buttonSelector) => {
        const footerElement = document.querySelector(footerSelector);

        if (!footerElement) {
          return { success: false, message: "Footer element not found" };
        }

        const button = footerElement.querySelector(buttonSelector);
        if (!button) {
          return {
            success: false,
            message: "No button found inside the footer",
          };
        }

        (button as HTMLElement).click();
        return { success: true, message: "Order confirmed successfully" };
      },
      footerSelector,
      buttonSelector
    );

    if (confirmResult.success) {
      console.log(confirmResult.message);
    } else {
      console.error(confirmResult.message);
    }
  } catch (error) {
    console.error("Error confirming order:", error);
  }
};

const cancelAllOrders = async (page: Page, frame: Frame): Promise<void> => {
  const spanText = "Отменить все";

  try {
    const cancelResult = await frame.evaluate((spanText) => {
      const spanElement = Array.from(document.querySelectorAll("span")).find(
        (span) => span.textContent?.trim() === spanText
      );

      if (!spanElement) {
        return {
          success: false,
          message: `Span with text "${spanText}" not found`,
        };
      }

      const buttonParent = spanElement.closest("button");

      if (!buttonParent) {
        return { success: false, message: "Parent button not found" };
      }

      (buttonParent as HTMLElement).click();
      return { success: true, message: "Cancelled all orders successfully" };
    }, spanText);

    if (cancelResult.success) {
      console.log(cancelResult.message);
    } else {
      console.error(cancelResult.message);
      return;
    }
  } catch (error) {
    console.error("Error cancelling all orders:", error);
    return;
  }

  const footerSelector = ".web-app-footer.is-visible";
  const buttonSelector = "button";

  try {
    await page.waitForSelector(footerSelector, {
      visible: true,
      timeout: 5000,
    });

    const confirmResult = await page.evaluate(
      (footerSelector, buttonSelector) => {
        const footerElement = document.querySelector(footerSelector);

        if (!footerElement) {
          return { success: false, message: "Footer element not found" };
        }

        const button = footerElement.querySelector(buttonSelector);
        if (!button) {
          return {
            success: false,
            message: "No button found inside the footer",
          };
        }

        (button as HTMLElement).click();
        return { success: true, message: "All orders cancelled successfully" };
      },
      footerSelector,
      buttonSelector
    );

    if (confirmResult.success) {
      console.log(confirmResult.message);
    } else {
      console.error(confirmResult.message);
    }
  } catch (error) {
    console.error("Error confirming cancel order:", error);
  }
};
