# ProtocolSettingsEvents
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/events/ProtocolSettingsEvents.sol)

**Inherits:**
[ModulesCommonEvents](/contracts/events/ModulesCommonEvents.sol/contract.ModulesCommonEvents.md)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains the events for protocol settings operations.


## Events
### SetPriceFeedContract

```solidity
event SetPriceFeedContract(address indexed sender, address oldValue, address newValue);
```

### SetSwapsImplContract

```solidity
event SetSwapsImplContract(address indexed sender, address oldValue, address newValue);
```

### SetLoanPool

```solidity
event SetLoanPool(address indexed sender, address indexed loanPool, address indexed underlying);
```

### SetSupportedTokens

```solidity
event SetSupportedTokens(address indexed sender, address indexed token, bool isActive);
```

### SetLendingFeePercent

```solidity
event SetLendingFeePercent(address indexed sender, uint256 oldValue, uint256 newValue);
```

### SetTradingFeePercent

```solidity
event SetTradingFeePercent(address indexed sender, uint256 oldValue, uint256 newValue);
```

### SetBorrowingFeePercent

```solidity
event SetBorrowingFeePercent(address indexed sender, uint256 oldValue, uint256 newValue);
```

### SetSwapExternalFeePercent

```solidity
event SetSwapExternalFeePercent(address indexed sender, uint256 oldValue, uint256 newValue);
```

### SetAffiliateFeePercent

```solidity
event SetAffiliateFeePercent(address indexed sender, uint256 oldValue, uint256 newValue);
```

### SetAffiliateTradingTokenFeePercent

```solidity
event SetAffiliateTradingTokenFeePercent(address indexed sender, uint256 oldValue, uint256 newValue);
```

### SetLiquidationIncentivePercent

```solidity
event SetLiquidationIncentivePercent(address indexed sender, uint256 oldValue, uint256 newValue);
```

### SetMaxSwapSize

```solidity
event SetMaxSwapSize(address indexed sender, uint256 oldValue, uint256 newValue);
```

### SetFeesController

```solidity
event SetFeesController(address indexed sender, address indexed oldController, address indexed newController);
```

### SetWrbtcToken

```solidity
event SetWrbtcToken(address indexed sender, address indexed oldWethToken, address indexed newWethToken);
```

### SetSovrynSwapContractRegistryAddress

```solidity
event SetSovrynSwapContractRegistryAddress(
    address indexed sender,
    address indexed oldSovrynSwapContractRegistryAddress,
    address indexed newSovrynSwapContractRegistryAddress
);
```

### SetProtocolTokenAddress

```solidity
event SetProtocolTokenAddress(
    address indexed sender, address indexed oldProtocolToken, address indexed newProtocolToken
);
```

### WithdrawFees

```solidity
event WithdrawFees(
    address indexed sender,
    address indexed token,
    address indexed receiver,
    uint256 lendingAmount,
    uint256 tradingAmount,
    uint256 borrowingAmount,
    uint256 wRBTCConverted
);
```

### WithdrawLendingFees

```solidity
event WithdrawLendingFees(address indexed sender, address indexed token, address indexed receiver, uint256 amount);
```

### WithdrawTradingFees

```solidity
event WithdrawTradingFees(address indexed sender, address indexed token, address indexed receiver, uint256 amount);
```

### WithdrawBorrowingFees

```solidity
event WithdrawBorrowingFees(address indexed sender, address indexed token, address indexed receiver, uint256 amount);
```

### SetRolloverBaseReward

```solidity
event SetRolloverBaseReward(address indexed sender, uint256 oldValue, uint256 newValue);
```

### SetRebatePercent

```solidity
event SetRebatePercent(address indexed sender, uint256 oldRebatePercent, uint256 newRebatePercent);
```

### SetSpecialRebates

```solidity
event SetSpecialRebates(
    address indexed sender,
    address indexed sourceToken,
    address indexed destToken,
    uint256 oldSpecialRebatesPercent,
    uint256 newSpecialRebatesPercent
);
```

### SetProtocolAddress

```solidity
event SetProtocolAddress(address indexed sender, address indexed oldProtocol, address indexed newProtocol);
```

### SetMinReferralsToPayoutAffiliates

```solidity
event SetMinReferralsToPayoutAffiliates(address indexed sender, uint256 oldMinReferrals, uint256 newMinReferrals);
```

### SetSOVTokenAddress

```solidity
event SetSOVTokenAddress(address indexed sender, address indexed oldTokenAddress, address indexed newTokenAddress);
```

### SetLockedSOVAddress

```solidity
event SetLockedSOVAddress(address indexed sender, address indexed oldAddress, address indexed newAddress);
```

### TogglePaused

```solidity
event TogglePaused(address indexed sender, bool indexed oldFlag, bool indexed newFlag);
```

### SetTradingRebateRewardsBasisPoint

```solidity
event SetTradingRebateRewardsBasisPoint(address indexed sender, uint256 oldBasisPoint, uint256 newBasisPoint);
```

### SetRolloverFlexFeePercent

```solidity
event SetRolloverFlexFeePercent(
    address indexed sender, uint256 oldRolloverFlexFeePercent, uint256 newRolloverFlexFeePercent
);
```

### SetDefaultPathConversion

```solidity
event SetDefaultPathConversion(
    address indexed sender, address indexed sourceTokenAddress, address indexed destTokenAddress, IERC20[] defaultPath
);
```

### RemoveDefaultPathConversion

```solidity
event RemoveDefaultPathConversion(
    address indexed sender, address indexed sourceTokenAddress, address indexed destTokenAddress, IERC20[] defaultPath
);
```

### SetAdmin

```solidity
event SetAdmin(address indexed sender, address indexed oldAdmin, address indexed newAdmin);
```

### SetPauser

```solidity
event SetPauser(address indexed sender, address indexed oldPauser, address indexed newPauser);
```

