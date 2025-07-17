# AdvancedToken
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/AdvancedToken.sol)

**Inherits:**
[AdvancedTokenStorage](/contracts/connectors/loantoken/AdvancedTokenStorage.sol/contract.AdvancedTokenStorage.md)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized margin
trading and lending https://bzx.network similar to the dYdX protocol.
AdvancedToken implements standard ERC-20 approval, mint and burn token functionality.
Logic (AdvancedToken) is kept aside from storage (AdvancedTokenStorage).
For example, LoanTokenLogicDai contract uses AdvancedToken::_mint() to mint
its Loan Dai iTokens.


## Functions
### approve

Set an amount as the allowance of `spender` over the caller's tokens.
Returns a boolean value indicating whether the operation succeeded.
IMPORTANT: Beware that changing an allowance with this method brings the risk
that someone may use both the old and the new allowance by unfortunate
transaction ordering. One possible solution to mitigate this race
condition is to first reduce the spender's allowance to 0 and set the
desired value afterwards:
https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
Emits an {Approval} event.


```solidity
function approve(address _spender, uint256 _value) public returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_spender`|`address`|The account address that will be able to spend the tokens.|
|`_value`|`uint256`|The amount of tokens allowed to spend.|


### _mint

The iToken minting process. Meant to issue Loan iTokens.
Lenders are able to open an iToken position, by minting them.
This function is called by LoanTokenLogicStandard::_mintToken


```solidity
function _mint(address _to, uint256 _tokenAmount, uint256 _assetAmount, uint256 _price) internal returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_to`|`address`|The recipient of the minted tTokens.|
|`_tokenAmount`|`uint256`|The amount of iTokens to be minted.|
|`_assetAmount`|`uint256`|The amount of lended tokens (asset to lend).|
|`_price`|`uint256`|The price of the lended tokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The updated balance of the recipient.|


### _burn

The iToken burning process. Meant to destroy Loan iTokens.
Lenders are able to close an iToken position, by burning them.
This function is called by LoanTokenLogicStandard::_burnToken


```solidity
function _burn(address _who, uint256 _tokenAmount, uint256 _assetAmount, uint256 _price) internal returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_who`|`address`|The owner of the iTokens to burn.|
|`_tokenAmount`|`uint256`|The amount of iTokens to burn.|
|`_assetAmount`|`uint256`|The amount of lended tokens.|
|`_price`|`uint256`|The price of the lended tokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The updated balance of the iTokens owner.|


