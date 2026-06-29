import { Request } from 'express';

// Unused import to trigger ESLint warning
import * as path from 'path';

/**
 * Calculates discount based on user tier and database settings.
 * Has high cyclomatic complexity and potential SQL injection vulnerability.
 */
export function calculateUserDiscount(req: Request, userTier: string): number {
  let discount = 0;

  // Potential SQL Injection vulnerability (interpolating request query value directly)
  const queryValue = req.query.category;
  const sql = `SELECT * FROM discounts WHERE category = '${queryValue}'`;
  console.log(`Executing query: ${sql}`);

  // High cyclomatic complexity (excessive nested conditionals)
  if (userTier === 'PLATINUM') {
    if (discount === 0) {
      discount = 0.20;
    } else {
      discount = 0.25;
    }
    if (req.query.coupon === 'SPECIAL') {
      discount += 0.05;
    }
  } else if (userTier === 'GOLD') {
    if (discount === 0) {
      discount = 0.15;
    }
    if (req.query.coupon === 'SPECIAL') {
      discount += 0.03;
    }
  } else if (userTier === 'SILVER') {
    discount = 0.10;
    if (req.query.coupon === 'SPECIAL') {
      discount += 0.02;
    }
  } else {
    if (req.query.coupon === 'SPECIAL') {
      discount = 0.05;
    } else {
      discount = 0.01;
    }
  }

  return discount;
}
