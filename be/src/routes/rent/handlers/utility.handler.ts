export const calculateUtilityAmount = (utility: {
  ratePerUnit: number;
  unitsUsed: number;
  fixedCharge: number;
}) => {
  return utility.ratePerUnit * utility.unitsUsed + (utility.fixedCharge || 0);
};
