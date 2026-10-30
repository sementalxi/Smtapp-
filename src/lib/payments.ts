/** Which payment provider is set up. Square wins if both are configured. */
export function paymentProvider(): "square" | "stripe" | null {
  if (process.env.SQUARE_ACCESS_TOKEN?.trim()) return "square";
  if (process.env.STRIPE_SECRET_KEY?.trim()) return "stripe";
  return null;
}
