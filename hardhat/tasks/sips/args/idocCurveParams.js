// Single source of truth for the SIP-0092 iDOC demand-curve parameters.
//
// Imported by BOTH the SIP arg builder (sipArgs.js, getArgsSipIDocDemandCurve)
// and the on-chain test (tests-onchain/sipIDocDemandCurve.test.js) so the
// proposed values and the drift-guard baseline cannot diverge between the two.
// Built with the standalone `ethers` package (same node_modules instance both
// consumers use), so the BigNumbers are interchangeable with hre.ethers.
const { BigNumber, utils } = require("ethers");

const pe = (x) => utils.parseEther(x); // whole-percent → WEI_PERCENT_PRECISION (1e20 == 100%)

// Mainnet curve values at the time SIP-0092 was drafted (the documented
// before-state). getArgsSipIDocDemandCurve hard-fails on mainnet if live state
// differs from this, and the test asserts the fork matches it pre-SIP.
const CURRENT_AT_DRAFT = {
    baseRate: pe("6"),
    rateMultiplier: pe("15"),
    lowUtilBaseRate: pe("6"),
    lowUtilRateMultiplier: pe("15"),
    targetLevel: BigNumber.from(0),
    kinkLevel: pe("75"),
    maxScaleRate: pe("150"),
};

// Proposed curve values the SIP sets via setDemandCurve.
const PROPOSED = {
    baseRate: pe("2"),
    rateMultiplier: pe("10"),
    lowUtilBaseRate: pe("2"),
    lowUtilRateMultiplier: pe("10"),
    targetLevel: BigNumber.from(0),
    kinkLevel: pe("90"),
    maxScaleRate: pe("30"),
};

// setDemandCurve(uint256,uint256,uint256,uint256,uint256,uint256,uint256) param
// order. Also the canonical iteration order for param comparisons and for
// abi-encoding the call data.
const CURVE_KEYS = [
    "baseRate",
    "rateMultiplier",
    "lowUtilBaseRate",
    "lowUtilRateMultiplier",
    "targetLevel",
    "kinkLevel",
    "maxScaleRate",
];

const SET_DEMAND_CURVE_SIGNATURE =
    "setDemandCurve(uint256,uint256,uint256,uint256,uint256,uint256,uint256)";

module.exports = { CURRENT_AT_DRAFT, PROPOSED, CURVE_KEYS, SET_DEMAND_CURVE_SIGNATURE };
