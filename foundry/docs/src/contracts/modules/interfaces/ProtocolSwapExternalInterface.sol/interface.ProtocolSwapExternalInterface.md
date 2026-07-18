# ProtocolSwapExternalInterface
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/modules/interfaces/ProtocolSwapExternalInterface.sol)

Copyright 2020, Denis Savelev. All Rights Reserved.
Licensed under the Apache License, Version 2.0.


## Functions
### swapExternal


```solidity
function swapExternal(
    address sourceToken,
    address destToken,
    address receiver,
    address returnToSender,
    uint256 sourceTokenAmount,
    uint256 requiredDestTokenAmount,
    uint256 minReturn,
    bytes calldata swapData
) external returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed);
```

