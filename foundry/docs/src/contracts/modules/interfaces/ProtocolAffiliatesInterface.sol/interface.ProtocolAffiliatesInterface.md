# ProtocolAffiliatesInterface
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/modules/interfaces/ProtocolAffiliatesInterface.sol)

Copyright 2020, Denis Savelev. All Rights Reserved.
Licensed under the Apache License, Version 2.0.


## Functions
### setAffiliatesReferrer


```solidity
function setAffiliatesReferrer(address user, address referrer) external;
```

### setUserNotFirstTradeFlag


```solidity
function setUserNotFirstTradeFlag(address user_) external;
```

### getUserNotFirstTradeFlag


```solidity
function getUserNotFirstTradeFlag(address user_) external returns (bool);
```

### payTradingFeeToAffiliatesReferrer


```solidity
function payTradingFeeToAffiliatesReferrer(address affiliate, address trader, address token, uint256 amount)
    external
    returns (uint256 affiliatesBonusSOVAmount, uint256 affiliatesBonusTokenAmount);
```

