# AffiliatesEvents
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/events/AffiliatesEvents.sol)

**Inherits:**
[ModulesCommonEvents](/contracts/events/ModulesCommonEvents.sol/contract.ModulesCommonEvents.md)

Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.


## Events
### SetAffiliatesReferrer

```solidity
event SetAffiliatesReferrer(address indexed user, address indexed referrer);
```

### SetAffiliatesReferrerFail

```solidity
event SetAffiliatesReferrerFail(
    address indexed user, address indexed referrer, bool alreadySet, bool userNotFirstTrade
);
```

### SetUserNotFirstTradeFlag

```solidity
event SetUserNotFirstTradeFlag(address indexed user);
```

### PayTradingFeeToAffiliate

```solidity
event PayTradingFeeToAffiliate(
    address indexed referrer,
    address trader,
    address indexed token,
    bool indexed isHeld,
    uint256 tradingFeeTokenAmount,
    uint256 tokenBonusAmount,
    uint256 sovBonusAmount,
    uint256 sovBonusAmountPaid
);
```

### PayTradingFeeToAffiliateFail

```solidity
event PayTradingFeeToAffiliateFail(
    address indexed referrer,
    address trader,
    address indexed token,
    uint256 tradingFeeTokenAmount,
    uint256 tokenBonusAmount,
    uint256 sovBonusAmount,
    uint256 sovBonusAmountTryingToPaid
);
```

### WithdrawAffiliatesReferrerTokenFees

```solidity
event WithdrawAffiliatesReferrerTokenFees(
    address indexed referrer, address indexed receiver, address indexed tokenAddress, uint256 amount
);
```

