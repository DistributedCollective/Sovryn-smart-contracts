# LoanMaintenanceEvents
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/events/LoanMaintenanceEvents.sol)

**Inherits:**
[ModulesCommonEvents](/contracts/events/ModulesCommonEvents.sol/contract.ModulesCommonEvents.md)

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains the events for loan maintenance operations.


## Events
### DepositCollateral

```solidity
event DepositCollateral(bytes32 indexed loanId, uint256 depositAmount, uint256 rate);
```

