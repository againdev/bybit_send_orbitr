export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const round = (num: number, decemal: number = 10000): number =>
  Math.round(num * decemal) / decemal;
