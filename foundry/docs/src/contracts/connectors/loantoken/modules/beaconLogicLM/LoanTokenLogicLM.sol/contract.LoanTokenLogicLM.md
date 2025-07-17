# LoanTokenLogicLM
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/modules/beaconLogicLM/LoanTokenLogicLM.sol)

**Inherits:**
[LoanTokenLogicSplit](/contracts/connectors/loantoken/LoanTokenLogicSplit.sol/contract.LoanTokenLogicSplit.md)


## Functions
### getListFunctionSignatures

This function is MANDATORY, which will be called by LoanTokenLogicBeacon and be registered.
Every new public function, the signature needs to be included in this function.

*This function will return the list of function signature in this contract that are available for public call
Then this function will be called by LoanTokenLogicBeacon, and the function signatures will be registred in LoanTokenLogicBeacon.*

*To save the gas we can just directly return the list of function signature from this pure function.
The other workaround (fancy way) is we can create a storage for the list of the function signature, and then we can store each function signature to that storage from the constructor.
Then, in this function we just need to return that storage variable.*


```solidity
function getListFunctionSignatures() external pure returns (bytes4[] memory functionSignatures, bytes32 moduleName);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`functionSignatures`|`bytes4[]`|The list of function signatures (bytes4[])|
|`moduleName`|`bytes32`||


### mint

BE CAREFUL,
LoanTokenLogicStandard also has mint & burn function (overloading).
You need to compute the function signature manually --> bytes4(keccak256("mint(address,uint256,bool)"))
LoanTokenLogicStandard
LoanTokenLogicLM
LoanTokenLogicStandard
LoanTokenLogicLM

deposit into the lending pool and optionally participate at the Liquidity Mining Program


```solidity
function mint(address receiver, uint256 depositAmount, bool useLM)
    external
    nonReentrant
    globallyNonReentrant
    returns (uint256 minted);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receiver`|`address`|the receiver of the tokens|
|`depositAmount`|`uint256`|The amount of underlying tokens provided on the loan. (Not the number of loan tokens to mint).|
|`useLM`|`bool`|if true -> deposit the pool tokens into the Liquidity Mining contract|


### burn

withdraws from the lending pool and optionally retrieves the pool tokens from the
Liquidity Mining Contract


```solidity
function burn(address receiver, uint256 burnAmount, bool useLM)
    external
    nonReentrant
    globallyNonReentrant
    returns (uint256 redeemed);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receiver`|`address`|the receiver of the underlying tokens. note: potetial LM rewards are always sent to the msg.sender|
|`burnAmount`|`uint256`|The amount of pool tokens to redeem.|
|`useLM`|`bool`|if true -> deposit the pool tokens into the Liquidity Mining contract|


