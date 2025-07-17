# SwapsImplSovrynSwapLib
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/swaps/connectors/SwapsImplSovrynSwapLib.sol)

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains the implementation of swap process and rate
calculations for Sovryn network.


## Functions
### getContractHexName

bytes32 contractName = hex"42616e636f724e6574776f726b"; /// "SovrynSwapNetwork"
Get the hex name of a contract.


```solidity
function getContractHexName(string memory source) public pure returns (bytes32 result);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`source`|`string`|The name of the contract.|


### getSovrynSwapNetworkContract

Look up the Sovryn swap network contract registered at the given address.


```solidity
function getSovrynSwapNetworkContract(address sovrynSwapRegistryAddress) public view returns (ISovrynSwapNetwork);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sovrynSwapRegistryAddress`|`address`|The address of the registry.|


### swap

State variable sovrynSwapContractRegistryAddress is part of
State.sol and set in ProtocolSettings.sol and this function
needs to work without delegate call as well -> therefore pass it.
Swap the source token for the destination token on the oracle based AMM.
On loan opening: minSourceTokenAmount = maxSourceTokenAmount and requiredDestTokenAmount = 0
-> swap the minSourceTokenAmount
On loan rollover: (swap interest) minSourceTokenAmount = 0, maxSourceTokenAmount = complete collateral and requiredDestTokenAmount > 0
-> amount of required source tokens to swap is estimated (want to fill requiredDestTokenAmount, not more). maxSourceTokenAMount is not exceeded.
On loan closure: minSourceTokenAmount <= maxSourceTokenAmount and requiredDestTokenAmount >= 0
-> same as on rollover. minimum amount is not considered at all.


```solidity
function swap(SwapParams memory params)
    public
    returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`params`|`SwapParams`|SwapParams struct sourceTokenAddress The address of the source tokens. destTokenAddress The address of the destination tokens. receiverAddress The address who will received the swap token results returnToSenderAddress The address to return unspent tokens to (when called by the protocol, it's always the protocol contract). minSourceTokenAmount The minimum amount of source tokens to swapped (only considered if requiredDestTokens == 0). maxSourceTokenAmount The maximum amount of source tokens to swapped. requiredDestTokenAmount The required amount of destination tokens.|


### _allowTransfer

If the required amount of destination tokens is passed, we need to
calculate the estimated amount of source tokens regardless of the
minimum source token amount (name is misleading).
sovrynSwapNetwork.rateByPath does not return a rate, but instead the amount of destination tokens returned.

Check whether the existing allowance suffices to transfer
the needed amount of tokens.
If not, allows the transfer of an arbitrary amount of tokens.

*Note: the kyber connector uses .call() to interact with kyber
to avoid bubbling up. here we allow bubbling up.
If the sender is not the protocol (calling with delegatecall),
return the remainder to the specified address.*

*Note: for the case that the swap is used without the
protocol. Not sure if it should, though. needs to be discussed.
Send unused source token back.*


```solidity
function _allowTransfer(uint256 tokenAmount, address tokenAddress, address sovrynSwapNetwork) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenAmount`|`uint256`|The amount to transfer.|
|`tokenAddress`|`address`|The address of the token to transfer.|
|`sovrynSwapNetwork`|`address`|The address of the sovrynSwap network contract.|


### _estimateSourceTokenAmount

Calculate the number of source tokens to provide in order to
obtain the required destination amount.


```solidity
function _estimateSourceTokenAmount(
    address sourceTokenAddress,
    address destTokenAddress,
    uint256 requiredDestTokenAmount,
    uint256 maxSourceTokenAmount
) internal view returns (uint256 estimatedSourceAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceTokenAddress`|`address`|The address of the source token address.|
|`destTokenAddress`|`address`|The address of the destination token address.|
|`requiredDestTokenAmount`|`uint256`|The number of destination tokens needed.|
|`maxSourceTokenAmount`|`uint256`|The maximum number of source tokens to spend.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`estimatedSourceAmount`|`uint256`|The estimated amount of source tokens needed. Minimum: minSourceTokenAmount, maximum: maxSourceTokenAmount|


### getExpectedRate

Compute the expected rate for the maxSourceTokenAmount -> if spending less, we can't get a worse rate.
Compute the source tokens needed to get the required amount with the worst case rate.
If the actual rate is exactly the same as the worst case rate, we get rounding issues. So, add a small buffer.
buffer = min(estimatedSourceAmount/1000 , sourceBuffer) with sourceBuffer = 10000
Never spend more than the maximum.

Get the expected rate for 1 source token when exchanging the
given amount of source tokens.


```solidity
function getExpectedRate(address sourceTokenAddress, address destTokenAddress, uint256 sourceTokenAmount)
    public
    view
    returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceTokenAddress`|`address`|The address of the source token contract.|
|`destTokenAddress`|`address`|The address of the destination token contract.|
|`sourceTokenAmount`|`uint256`|The amount of source tokens to get the rate for.|


### getExpectedReturn

Is returning the total amount of destination tokens.
Return the rate for 1 token with 18 decimals.

Get the expected return amount when exchanging the given
amount of source tokens.

Right now, this function is being called directly by _swapsExpectedReturn from the protocol
So, this function is not using _getConversionPath function since it will try to read the defaultPath storage which is stored in the protocol's slot, and it will cause an issue for direct call.
Instead, this function is accepting additional parameters called defaultPath which value can be declared by the caller (protocol in this case).


```solidity
function getExpectedReturn(address sourceTokenAddress, address destTokenAddress, uint256 sourceTokenAmount)
    public
    view
    returns (uint256 expectedReturn);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceTokenAddress`|`address`|The address of the source token contract.|
|`destTokenAddress`|`address`|The address of the destination token contract.|
|`sourceTokenAmount`|`uint256`|The amount of source tokens to get the return for.|


### _getConversionPath

Is returning the total amount of destination tokens.


```solidity
function _getConversionPath(address sourceTokenAddress, address destTokenAddress, ISovrynSwapNetwork sovrynSwapNetwork)
    private
    view
    returns (IERC20[] memory path);
```

## Structs
### SwapParams

```solidity
struct SwapParams {
    address sourceTokenAddress;
    address destTokenAddress;
    address receiverAddress;
    address returnToSenderAddress;
    uint256 minSourceTokenAmount;
    uint256 maxSourceTokenAmount;
    uint256 requiredDestTokenAmount;
}
```

