# FeedsLike
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/interfaces/FeedsLike.sol)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.


## Functions
### queryRate


```solidity
function queryRate(address sourceTokenAddress, address destTokenAddress)
    external
    view
    returns (uint256 rate, uint256 precision);
```

