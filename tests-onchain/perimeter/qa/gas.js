/**
 * Gas add-back: the one adjustment every balance-delta check in the QA
 * rehearsal engine needs whenever the account it measures might also be the
 * one that paid to send the transaction being checked.
 *
 * `after - before` alone reads too low, by exactly what the payer spent on
 * gas, whenever the account being measured IS the payer — a receiver who is
 * also the withdrawing signer, a fee destination that is also the actor, an
 * executor releasing its own payout, an operator refunding into the same
 * test key that submitted the multisig transaction. Left unadjusted, a real
 * leak no bigger than the transaction's own gas cost reads as zero or
 * negative and slips past the check it should have failed. This was fixed
 * piecemeal at three separate call sites before being pulled out here —
 * fold every new one through `creditedDelta` instead of re-deriving the
 * same `gasUsed * effectiveGasPrice` arithmetic again.
 *
 * Only ever apply this to a NATIVE balance reading. Gas is never paid in an
 * ERC20, so crediting it back to a token balance would be wrong — every
 * caller is responsible for gating that itself (most already have to, to
 * pick which `balanceReader` to use in the first place).
 */
const { ethers } = require("hardhat");

/** One transaction's gas cost, attributed to whoever paid it. Read straight
 *  off a receipt at hand; also the shape carried through a postcondition
 *  persisted to the state file, for a transaction whose receipt an earlier,
 *  separate `perimeter:qa` invocation already let go of. */
const chargeOf = (receipt) => ({
    payer: ethers.utils.getAddress(receipt.from),
    wei: receipt.gasUsed.mul(receipt.effectiveGasPrice).toString(),
});

/** `delta`, credited back every charge in `charges` that `address` itself
 *  paid — the balance `address` is measured at otherwise reads too low by
 *  exactly what it spent sending those transactions in between the two
 *  reads. A charge paid by anyone else leaves `delta` untouched. */
const creditedDelta = (delta, address, charges) => {
    const want = ethers.utils.getAddress(address);
    return (charges || [])
        .filter((c) => c && ethers.utils.getAddress(c.payer) === want)
        .reduce((sum, c) => sum.add(ethers.BigNumber.from(c.wei)), delta);
};

module.exports = { chargeOf, creditedDelta };
