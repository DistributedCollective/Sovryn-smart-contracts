# TeamVesting
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/TeamVesting.sol)

**Inherits:**
[VestingStorage](/contracts/governance/Vesting/VestingStorage.sol/contract.VestingStorage.md), [Proxy](/contracts/proxy/Proxy.sol/contract.Proxy.md)

A regular vesting contract, but the owner (governance) is able to
withdraw earlier without a slashing.

*Vesting contracts shouldn't be upgradable,
use Proxy instead of UpgradableProxy.*


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
    address _feeSharingCollector
) public;
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
|`_feeSharingCollector`|`address`||


