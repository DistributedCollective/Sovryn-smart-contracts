# IApproveAndCall
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/token/IApproveAndCall.sol)

*Interfaces are used to cast a contract address into a callable instance.*


## Functions
### receiveApproval

Receives approval from SOV token.


```solidity
function receiveApproval(address _sender, uint256 _amount, address _token, bytes calldata _data) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_sender`|`address`|The sender of SOV.approveAndCall function.|
|`_amount`|`uint256`|The amount was approved.|
|`_token`|`address`|The address of token.|
|`_data`|`bytes`|The data will be used for low level call.|


