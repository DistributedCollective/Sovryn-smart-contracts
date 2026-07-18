# LoanTokenLogicProxy
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/LoanTokenLogicProxy.sol)

**Inherits:**
[AdvancedTokenStorage](/contracts/connectors/loantoken/AdvancedTokenStorage.sol/contract.AdvancedTokenStorage.md)

This contract contains the proxy functionality and it will query the logic target from LoanTokenLogicBeacon
This contract will also has the pause/unpause functionality. The purpose of this pausability is so that we can pause/unpause from the loan token level.


## State Variables
### sovrynContractAddress
PLEASE DO NOT ADD ANY VARIABLES HERE UNLESS FOR SPESIFIC SLOT
------------- MUST BE THE SAME AS IN LoanToken CONTRACT -------------------


```solidity
address public sovrynContractAddress;
```


### wrbtcTokenAddress

```solidity
address public wrbtcTokenAddress;
```


### target_

```solidity
address public target_;
```


### admin

```solidity
address public admin;
```


### LOAN_TOKEN_LOGIC_BEACON_ADDRESS_SLOT
------------- END MUST BE THE SAME AS IN LoanToken CONTRACT -------------------

PLEASE DO NOT ADD ANY VARIABLES HERE UNLESS FOR SPESIFIC SLOT (CONSTANT / IMMUTABLE)


```solidity
bytes32 internal constant LOAN_TOKEN_LOGIC_BEACON_ADDRESS_SLOT = keccak256("LOAN_TOKEN_LOGIC_BEACON_ADDRESS_SLOT");
```


## Functions
### onlyAdmin


```solidity
modifier onlyAdmin();
```

### function

Fallback function performs a logic implementation address query to LoanTokenLogicBeacon and then do delegate call to that query result address.
Returns whatever the implementation call returns.


```solidity
function() external payable;
```

### _beaconAddress

*Returns the current Loan Token logic Beacon.*


```solidity
function _beaconAddress() internal view returns (address beaconAddress);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`beaconAddress`|`address`|Address of the current LoanTokenLogicBeacon.|


### beaconAddress


```solidity
function beaconAddress() external view returns (address);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The address of the current LoanTokenLogicBeacon.|


### _setBeaconAddress

*Set/update the new beacon address.*


```solidity
function _setBeaconAddress(address _newBeaconAddress) private;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newBeaconAddress`|`address`|Address of the new LoanTokenLogicBeacon.|


### setBeaconAddress

*External function to set the new LoanTokenLogicBeacon Address*


```solidity
function setBeaconAddress(address _newBeaconAddress) external onlyAdmin;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newBeaconAddress`|`address`|Address of the new LoanTokenLogicBeacon|


### getTarget

*External function to return the LoanTokenLogicProxy of loan token (target of LoanToken contract).
Ideally this getter should be added in the LoanToken contract
but since LoanToken contract can't be changed, adding the getter in this contract will do
because it will use the context of LoanToken contract.*


```solidity
function getTarget() external view returns (address);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|target address of LoanToken contract|


