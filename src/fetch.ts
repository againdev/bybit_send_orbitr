import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const sendApiKey = process.env.SEND_API_KEY;

export const getBalance = async (currencyCode: string): Promise<number> => {
  const sendCookieSecretKey = process.env.SEND_COOKIE_SECRET_KEY;

  if (!sendCookieSecretKey) {
    console.error("SEND_COOKIE_SECRET_KEY is not defined.");
    return 0;
  }

  try {
    const response = await axios.get(
      "https://api.send.tg/internal/v1/wallet/balance",
      {
        headers: {
          accept: "application/json, text/plain, */*",
          "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
          Cookie: `access_token=${sendCookieSecretKey}`,
        },
        withCredentials: true,
      }
    );

    const data = response.data;
    const currencyBalance = data.balances.find(
      (balance: { asset: string; available: string }) =>
        balance.asset === currencyCode
    );

    return currencyBalance
      ? parseFloat(currencyBalance.available) / Math.pow(10, 18)
      : 0;
  } catch (error) {
    console.error("Error fetching balance:", error);
    return 0;
  }
};
