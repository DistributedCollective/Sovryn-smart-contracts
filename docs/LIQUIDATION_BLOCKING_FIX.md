# Liquidation Blocking Vulnerability Fix

## Problem Description

The Sovryn protocol was vulnerable to liquidation blocking attacks where malicious borrowers could prevent liquidation by deploying contracts that revert in their `receive()` function. This vulnerability occurred because:

1. **Borrower addresses can be contracts**: The loan creation process allows any address (including contracts) to be specified as the borrower
2. **Liquidation calls borrower's receive function**: During liquidation, the system attempts to refund interest to the borrower using `Address.sendValue()`
3. **Malicious contracts can revert**: If the borrower's `receive()` function reverts, the entire liquidation transaction fails
4. **Bad debt accumulation**: Unliquidatable positions lead to bad debt accumulation, especially problematic for high-leverage margin trades (up to 5x)

## Solution Implementation

### 1. Modified `_withdrawAsset` Function

**File**: `contracts/modules/LoanClosingsShared.sol`

The `_withdrawAsset` function now uses a safe withdrawal mechanism for RBTC:

```solidity
function _withdrawAsset(address assetToken, address receiver, uint256 assetAmount) internal {
    if (assetAmount != 0) {
        if (assetToken == address(wrbtcToken)) {
            _safeEtherWithdraw(receiver, assetAmount);  // Safe RBTC withdrawal
        } else {
            vaultWithdraw(assetToken, receiver, assetAmount);  // Normal ERC20 withdrawal
        }
    }
}
```

### 2. Safe Ether Withdrawal

**New Function**: `_safeEtherWithdraw`

```solidity
function _safeEtherWithdraw(address receiver, uint256 amount) internal {
    if (amount != 0) {
        IWrbtcERC20 _wrbtcToken = wrbtcToken;
        uint256 balance = address(this).balance;
        if (amount > balance) {
            _wrbtcToken.withdraw(amount - balance);
        }

        // Try to send RBTC to the receiver
        (bool success, ) = payable(receiver).call.value(amount)("");
        
        if (!success) {
            // If transfer fails, donate to FeeSharingCollector instead
            _donateToFeeSharingCollector(receiver, amount);
        } else {
            emit VaultWithdraw(address(_wrbtcToken), receiver, amount);
        }
    }
}
```

### 3. Donation to FeeSharingCollector

**New Function**: `_donateToFeeSharingCollector`

```solidity
function _donateToFeeSharingCollector(address originalRecipient, uint256 amount) internal {
    require(feesController != address(0), "feesController not set");
    
    // Call transferRBTC on FeeSharingCollector
    (bool success, ) = feesController.call.value(amount)(
        abi.encodeWithSignature("transferRBTC()")
    );
    
    require(success, "FeeSharingCollector transfer failed");
    
    emit DonateToFeeSharingCollector(originalRecipient, amount, "Transfer failed - donated to FeeSharingCollector");
}
```

### 4. New Event

**File**: `contracts/events/LoanClosingsEvents.sol`

```solidity
event DonateToFeeSharingCollector(
    address indexed originalRecipient,
    uint256 amount,
    string reason
);
```

## How the Fix Works

1. **Normal Operation**: For regular borrowers (EOAs or contracts that accept RBTC), the refund works as before
2. **Malicious Contract Detection**: When a transfer to a malicious contract fails (reverts), the system detects the failure
3. **Donation Mechanism**: Instead of reverting the entire liquidation, the refund amount is donated to the FeeSharingCollector
4. **Event Logging**: A `DonateToFeeSharingCollector` event is emitted to track these donations
5. **Liquidation Continues**: The liquidation process completes successfully, preventing bad debt accumulation

## Benefits

1. **Prevents Liquidation Blocking**: Malicious borrowers can no longer prevent liquidation
2. **Maintains Protocol Stability**: Bad debt accumulation is prevented
3. **Fair Distribution**: Failed refunds are donated to FeeSharingCollector, benefiting SOV stakers
4. **Backward Compatibility**: Normal borrowers are unaffected
5. **Transparency**: All donations are logged via events

## Affected Functions

The fix affects all functions that use `_withdrawAsset` for RBTC refunds:

- **Liquidation**: `LoanClosingsLiquidation._liquidate()`
- **Rollover**: `LoanClosingsRollover._rollover()`
- **Close with Swap**: `LoanClosingsShared._closeWithSwap()`
- **Close with Deposit**: `LoanClosingsShared._settleInterestToPrincipal()`

## Testing

The fix includes comprehensive tests in `tests/protocol/LiquidationBlockingFix.test.js` that verify:

1. Liquidation succeeds with malicious borrowers
2. Normal borrowers are unaffected
3. Donation events are properly emitted
4. FeeSharingCollector receives the donations
5. Rollover works with malicious borrowers

## Security Considerations

1. **No Reentrancy**: The fix uses `call.value()` with proper checks to prevent reentrancy
2. **Fail-Safe**: If FeeSharingCollector transfer fails, the transaction reverts (fail-safe)
3. **Gas Limits**: Uses `call.value()` instead of `sendValue()` to avoid gas limit issues
4. **Event Logging**: All donations are logged for transparency and auditing

## Deployment Notes

1. Ensure `feesController` is properly set in the protocol state
2. Verify FeeSharingCollector contract is deployed and functional
3. Test the fix on testnet before mainnet deployment
4. Monitor `DonateToFeeSharingCollector` events after deployment

This fix resolves the liquidation blocking vulnerability while maintaining protocol functionality and providing a fair mechanism for handling failed refunds.
