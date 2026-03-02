# LoanSettingsEvents
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/events/LoanSettingsEvents.sol)

**Inherits:**
[ModulesCommonEvents](/contracts/events/ModulesCommonEvents.sol/contract.ModulesCommonEvents.md)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains the events for loan settings operations.


## Events
### LoanParamsSetup

```solidity
event LoanParamsSetup(
    bytes32 indexed id,
    address owner,
    address indexed loanToken,
    address indexed collateralToken,
    uint256 minInitialMargin,
    uint256 maintenanceMargin,
    uint256 maxLoanTerm
);
```

### LoanParamsIdSetup

```solidity
event LoanParamsIdSetup(bytes32 indexed id, address indexed owner);
```

### LoanParamsDisabled

```solidity
event LoanParamsDisabled(
    bytes32 indexed id,
    address owner,
    address indexed loanToken,
    address indexed collateralToken,
    uint256 minInitialMargin,
    uint256 maintenanceMargin,
    uint256 maxLoanTerm
);
```

### LoanParamsIdDisabled

```solidity
event LoanParamsIdDisabled(bytes32 indexed id, address indexed owner);
```

