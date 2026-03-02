# ISovrynSwapNetwork
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/swaps/connectors/interfaces/ISovrynSwapNetwork.sol)


## Functions
### convertByPath


```solidity
function convertByPath(
    IERC20[] calldata _path,
    uint256 _amount,
    uint256 _minReturn,
    address _beneficiary,
    address _affiliateAccount,
    uint256 _affiliateFee
) external payable returns (uint256);
```

### rateByPath


```solidity
function rateByPath(IERC20[] calldata _path, uint256 _amount) external view returns (uint256);
```

### conversionPath


```solidity
function conversionPath(IERC20 _sourceToken, IERC20 _targetToken) external view returns (IERC20[] memory);
```

