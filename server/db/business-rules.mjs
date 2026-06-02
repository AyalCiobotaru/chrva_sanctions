export const SANCTION_FEE_PER_TEAM = requireNonNegativeMoney('CHRVA_SANCTION_FEE_PER_TEAM');
export const SANCTION_NET_INCOME_LIMIT = requireNonNegativeMoney('CHRVA_SANCTION_NET_INCOME_LIMIT');
export const DEFAULT_SANCTION_START_TIME = '8:30 AM';
export const RENEWAL_PUSH_WEEK_SEASONS = [2016, 2022];

function requireNonNegativeMoney(name) {
  const value = process.env[name];
  const amount = Number(value);

  if (value == null || value === '' || !Number.isFinite(amount) || amount < 0) {
    throw new Error(`${name} must be configured as a non-negative number.`);
  }

  return amount;
}
