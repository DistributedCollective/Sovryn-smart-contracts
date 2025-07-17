# MultiSigKeyHolders
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/multisig/MultiSigKeyHolders.sol)

**Inherits:**
[Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)


## State Variables
### MAX_OWNER_COUNT

```solidity
uint256 public constant MAX_OWNER_COUNT = 50;
```


### ERROR_INVALID_ADDRESS

```solidity
string private constant ERROR_INVALID_ADDRESS = "Invalid address";
```


### ERROR_INVALID_REQUIRED

```solidity
string private constant ERROR_INVALID_REQUIRED = "Invalid required";
```


### isEthereumAddressAdded
Flag and index for Ethereum address.


```solidity
mapping(address => Data) private isEthereumAddressAdded;
```


### ethereumAddresses
List of Ethereum addresses.


```solidity
address[] private ethereumAddresses;
```


### ethereumRequired
Required number of signatures for the Ethereum multisig.


```solidity
uint256 public ethereumRequired = 2;
```


### isBitcoinAddressAdded
Flag and index for Bitcoin address.


```solidity
mapping(string => Data) private isBitcoinAddressAdded;
```


### bitcoinAddresses
List of Bitcoin addresses.


```solidity
string[] private bitcoinAddresses;
```


### bitcoinRequired
Required number of signatures for the Bitcoin multisig.


```solidity
uint256 public bitcoinRequired = 2;
```


## Functions
### validRequirement


```solidity
modifier validRequirement(uint256 ownerCount, uint256 _required);
```

### addEthereumAddress

Add rBTC address to the key holders.


```solidity
function addEthereumAddress(address _address) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_address`|`address`|The address to be added.|


### addEthereumAddresses

Add rBTC addresses to the key holders.


```solidity
function addEthereumAddresses(address[] memory _address) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_address`|`address[]`|The addresses to be added.|


### _addEthereumAddress

Internal function to add rBTC address to the key holders.


```solidity
function _addEthereumAddress(address _address) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_address`|`address`|The address to be added.|


### removeEthereumAddress

Remove rBTC address to the key holders.


```solidity
function removeEthereumAddress(address _address) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_address`|`address`|The address to be removed.|


### removeEthereumAddresses

Remove rBTC addresses to the key holders.


```solidity
function removeEthereumAddresses(address[] memory _address) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_address`|`address[]`|The addresses to be removed.|


### _removeEthereumAddress

Internal function to remove rBTC address to the key holders.


```solidity
function _removeEthereumAddress(address _address) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_address`|`address`|The address to be removed.|


### isEthereumAddressOwner

Get whether rBTC address is a key holder.


```solidity
function isEthereumAddressOwner(address _address) public view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_address`|`address`|The rBTC address to be checked.|


### getEthereumAddresses

Get array of rBTC key holders.


```solidity
function getEthereumAddresses() public view returns (address[] memory);
```

### changeEthereumRequirement

Set flag ethereumRequired to true/false.


```solidity
function changeEthereumRequirement(uint256 _required)
    public
    onlyOwner
    validRequirement(ethereumAddresses.length, _required);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_required`|`uint256`|The new value of the ethereumRequired flag.|


### addBitcoinAddress

Add bitcoin address to the key holders.


```solidity
function addBitcoinAddress(string memory _address) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_address`|`string`|The address to be added.|


### addBitcoinAddresses

Add bitcoin addresses to the key holders.


```solidity
function addBitcoinAddresses(string[] memory _address) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_address`|`string[]`|The addresses to be added.|


### _addBitcoinAddress

Internal function to add bitcoin address to the key holders.


```solidity
function _addBitcoinAddress(string memory _address) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_address`|`string`|The address to be added.|


### removeBitcoinAddress

Remove bitcoin address to the key holders.


```solidity
function removeBitcoinAddress(string memory _address) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_address`|`string`|The address to be removed.|


### removeBitcoinAddresses

Remove bitcoin addresses to the key holders.


```solidity
function removeBitcoinAddresses(string[] memory _address) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_address`|`string[]`|The addresses to be removed.|


### _removeBitcoinAddress

Internal function to remove bitcoin address to the key holders.


```solidity
function _removeBitcoinAddress(string memory _address) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_address`|`string`|The address to be removed.|


### isBitcoinAddressOwner

Get whether bitcoin address is a key holder.


```solidity
function isBitcoinAddressOwner(string memory _address) public view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_address`|`string`|The bitcoin address to be checked.|


### getBitcoinAddresses

Get array of bitcoin key holders.


```solidity
function getBitcoinAddresses() public view returns (string[] memory);
```

### changeBitcoinRequirement

Set flag bitcoinRequired to true/false.


```solidity
function changeBitcoinRequirement(uint256 _required)
    public
    onlyOwner
    validRequirement(bitcoinAddresses.length, _required);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_required`|`uint256`|The new value of the bitcoinRequired flag.|


### addEthereumAndBitcoinAddresses

Add rBTC and bitcoin addresses to the key holders.


```solidity
function addEthereumAndBitcoinAddresses(address[] memory _ethereumAddress, string[] memory _bitcoinAddress)
    public
    onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_ethereumAddress`|`address[]`|the rBTC addresses to be added.|
|`_bitcoinAddress`|`string[]`|the bitcoin addresses to be added.|


### removeEthereumAndBitcoinAddresses

Remove rBTC and bitcoin addresses to the key holders.


```solidity
function removeEthereumAndBitcoinAddresses(address[] memory _ethereumAddress, string[] memory _bitcoinAddress)
    public
    onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_ethereumAddress`|`address[]`|The rBTC addresses to be removed.|
|`_bitcoinAddress`|`string[]`|The bitcoin addresses to be removed.|


## Events
### EthereumAddressAdded

```solidity
event EthereumAddressAdded(address indexed account);
```

### EthereumAddressRemoved

```solidity
event EthereumAddressRemoved(address indexed account);
```

### EthereumRequirementChanged

```solidity
event EthereumRequirementChanged(uint256 required);
```

### BitcoinAddressAdded

```solidity
event BitcoinAddressAdded(string account);
```

### BitcoinAddressRemoved

```solidity
event BitcoinAddressRemoved(string account);
```

### BitcoinRequirementChanged

```solidity
event BitcoinRequirementChanged(uint256 required);
```

## Structs
### Data
Helps removing items from array.


```solidity
struct Data {
    bool added;
    uint248 index;
}
```

