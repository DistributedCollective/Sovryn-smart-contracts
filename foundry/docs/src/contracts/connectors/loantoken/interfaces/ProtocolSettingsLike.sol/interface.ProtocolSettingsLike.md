# ProtocolSettingsLike
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/interfaces/ProtocolSettingsLike.sol)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.


## Functions
### setupLoanParams


```solidity
function setupLoanParams(LoanParamsStruct.LoanParams[] calldata loanParamsList)
    external
    returns (bytes32[] memory loanParamsIdList);
```

### disableLoanParams


```solidity
function disableLoanParams(bytes32[] calldata loanParamsIdList) external;
```

### minInitialMargin


```solidity
function minInitialMargin(bytes32 loanParamsId) external view returns (uint256);
```

