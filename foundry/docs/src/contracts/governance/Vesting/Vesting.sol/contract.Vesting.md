# Vesting
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/Vesting.sol)

**Inherits:**
[TeamVesting](/contracts/governance/Vesting/TeamVesting.sol/contract.TeamVesting.md)

Team tokens and investor tokens are vested. Therefore, a smart
contract needs to be developed to enforce the vesting schedule.


## Functions
### constructor

Setup the vesting schedule.


```solidity
constructor(
    address _logic,
    address _SOV,
    address _stakingAddress,
    address _tokenOwner,
    uint256 _cliff,
    uint256 _duration,
    address _feeSharingCollectorProxy
) public TeamVesting(_logic, _SOV, _stakingAddress, _tokenOwner, _cliff, _duration, _feeSharingCollectorProxy);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_logic`|`address`|The address of logic contract.|
|`_SOV`|`address`|The SOV token address.|
|`_stakingAddress`|`address`||
|`_tokenOwner`|`address`|The owner of the tokens.|
|`_cliff`|`uint256`|The time interval to the first withdraw in seconds.|
|`_duration`|`uint256`|The total duration in seconds.|
|`_feeSharingCollectorProxy`|`address`||


### governanceWithdrawTokens

*We need to add this implementation to prevent proxy call VestingLogic.governanceWithdrawTokens*


```solidity
function governanceWithdrawTokens(address receiver) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receiver`|`address`|The receiver of the token withdrawal.|


