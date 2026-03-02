# ILoanTokenModules
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/interfaces/ILoanTokenModules.sol)


## Functions
### setAdmin


```solidity
function setAdmin(address _admin) external;
```

### setPauser


```solidity
function setPauser(address _pauser) external;
```

### setupLoanParams


```solidity
function setupLoanParams(LoanParams[] calldata loanParamsList, bool areTorqueLoans) external;
```

### disableLoanParams


```solidity
function disableLoanParams(address[] calldata collateralTokens, bool[] calldata isTorqueLoans) external;
```

### setDemandCurve


```solidity
function setDemandCurve(
    uint256 _baseRate,
    uint256 _rateMultiplier,
    uint256 _lowUtilBaseRate,
    uint256 _lowUtilRateMultiplier,
    uint256 _targetLevel,
    uint256 _kinkLevel,
    uint256 _maxScaleRate
) external;
```

### toggleFunctionPause


```solidity
function toggleFunctionPause(string calldata funcId, bool isPaused) external;
```

### setTransactionLimits


```solidity
function setTransactionLimits(address[] calldata addresses, uint256[] calldata limits) external;
```

### changeLoanTokenNameAndSymbol


```solidity
function changeLoanTokenNameAndSymbol(string calldata _name, string calldata _symbol) external;
```

### marginTrade

END LOAN TOKEN SETTINGS LOWER ADMIN
START LOAN TOKEN LOGIC STANDARD


```solidity
function marginTrade(
    bytes32 loanId,
    uint256 leverageAmount,
    uint256 loanTokenSent,
    uint256 collateralTokenSent,
    address collateralTokenAddress,
    address trader,
    uint256 minEntryPrice,
    bytes calldata loanDataBytes
) external payable returns (uint256, uint256);
```

### marginTradeAffiliate


```solidity
function marginTradeAffiliate(
    bytes32 loanId,
    uint256 leverageAmount,
    uint256 loanTokenSent,
    uint256 collateralTokenSent,
    address collateralTokenAddress,
    address trader,
    uint256 minEntryPrice,
    address affiliateReferrer,
    bytes calldata loanDataBytes
) external payable returns (uint256, uint256);
```

### borrowInterestRate


```solidity
function borrowInterestRate() external view returns (uint256);
```

### mint


```solidity
function mint(address receiver, uint256 depositAmount) external returns (uint256 mintAmount);
```

### burn


```solidity
function burn(address receiver, uint256 burnAmount) external returns (uint256 loanAmountPaid);
```

### checkPause


```solidity
function checkPause(string calldata funcId) external view returns (bool isPaused);
```

### nextBorrowInterestRate


```solidity
function nextBorrowInterestRate(uint256 borrowAmount) external view returns (uint256);
```

### totalAssetBorrow


```solidity
function totalAssetBorrow() external view returns (uint256);
```

### totalAssetSupply


```solidity
function totalAssetSupply() external view returns (uint256);
```

### borrow


```solidity
function borrow(
    bytes32 loanId,
    uint256 withdrawAmount,
    uint256 initialLoanDuration,
    uint256 collateralTokenSent,
    address collateralTokenAddress,
    address borrower,
    address receiver,
    bytes calldata
) external payable returns (uint256, uint256);
```

### transfer


```solidity
function transfer(address _to, uint256 _value) external returns (bool);
```

### transferFrom


```solidity
function transferFrom(address _from, address _to, uint256 _value) external returns (bool);
```

### setLiquidityMiningAddress


```solidity
function setLiquidityMiningAddress(address LMAddress) external;
```

### getLiquidityMiningAddress


```solidity
function getLiquidityMiningAddress() external view returns (address);
```

### setStakingContractAddress


```solidity
function setStakingContractAddress(address _stakingContractAddress) external;
```

### getStakingContractAddress


```solidity
function getStakingContractAddress() external view returns (address);
```

### getEstimatedMarginDetails


```solidity
function getEstimatedMarginDetails(
    uint256 leverageAmount,
    uint256 loanTokenSent,
    uint256 collateralTokenSent,
    address collateralTokenAddress
) external view returns (uint256 principal, uint256 collateral, uint256 interestRate);
```

### getDepositAmountForBorrow


```solidity
function getDepositAmountForBorrow(uint256 borrowAmount, uint256 initialLoanDuration, address collateralTokenAddress)
    external
    view
    returns (uint256 depositAmount);
```

### getBorrowAmountForDeposit


```solidity
function getBorrowAmountForDeposit(uint256 depositAmount, uint256 initialLoanDuration, address collateralTokenAddress)
    external
    view
    returns (uint256 borrowAmount);
```

### checkPriceDivergence


```solidity
function checkPriceDivergence(uint256 loanTokenSent, address collateralTokenAddress, uint256 minEntryPrice)
    external
    view;
```

### getMaxEscrowAmount


```solidity
function getMaxEscrowAmount(uint256 leverageAmount) external view returns (uint256 maxEscrowAmount);
```

### checkpointPrice


```solidity
function checkpointPrice(address _user) external view returns (uint256 price);
```

### assetBalanceOf


```solidity
function assetBalanceOf(address _owner) external view returns (uint256);
```

### profitOf


```solidity
function profitOf(address user) external view returns (int256);
```

### tokenPrice


```solidity
function tokenPrice() external view returns (uint256 price);
```

### avgBorrowInterestRate


```solidity
function avgBorrowInterestRate() external view returns (uint256);
```

### supplyInterestRate


```solidity
function supplyInterestRate() external view returns (uint256);
```

### nextSupplyInterestRate


```solidity
function nextSupplyInterestRate(uint256 supplyAmount) external view returns (uint256);
```

### totalSupplyInterestRate


```solidity
function totalSupplyInterestRate(uint256 assetSupply) external view returns (uint256);
```

### loanTokenAddress


```solidity
function loanTokenAddress() external view returns (address);
```

### getMarginBorrowAmountAndRate


```solidity
function getMarginBorrowAmountAndRate(uint256 leverageAmount, uint256 depositAmount)
    external
    view
    returns (uint256, uint256);
```

### withdrawRBTCTo


```solidity
function withdrawRBTCTo(address payable _receiverAddress, uint256 _amount) external;
```

### initialPrice

START LOAN TOKEN BASE


```solidity
function initialPrice() external view returns (uint256);
```

### mint

START LOAN TOKEN LOGIC LM


```solidity
function mint(address receiver, uint256 depositAmount, bool useLM) external returns (uint256 minted);
```

### burn


```solidity
function burn(address receiver, uint256 burnAmount, bool useLM) external returns (uint256 redeemed);
```

### mintWithBTC

START LOAN TOKEN LOGIC WRBTC


```solidity
function mintWithBTC(address receiver, bool useLM) external payable returns (uint256 mintAmount);
```

### burnToBTC


```solidity
function burnToBTC(address receiver, uint256 burnAmount, bool useLM) external returns (uint256 loanAmountPaid);
```

### marketLiquidity


```solidity
function marketLiquidity() external view returns (uint256);
```

### calculateSupplyInterestRate


```solidity
function calculateSupplyInterestRate(uint256 assetBorrow, uint256 assetSupply) external view returns (uint256);
```

### pauser

START LOAN TOKEN LOGIC STORAGE


```solidity
function pauser() external view returns (address);
```

### liquidityMiningAddress


```solidity
function liquidityMiningAddress() external view returns (address);
```

### name


```solidity
function name() external view returns (string memory);
```

### symbol


```solidity
function symbol() external view returns (string memory);
```

### approve

START ADVANCED TOKEN


```solidity
function approve(address _spender, uint256 _value) external returns (bool);
```

### allowance

START ADVANCED TOKEN STORAGE


```solidity
function allowance(address _owner, address _spender) external view returns (uint256);
```

### balanceOf


```solidity
function balanceOf(address _owner) external view returns (uint256);
```

### totalSupply


```solidity
function totalSupply() external view returns (uint256);
```

### loanParamsIds


```solidity
function loanParamsIds(uint256) external view returns (bytes32);
```

## Events
### Transfer
EVENT
topic: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef


```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

### Approval
topic: 0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925


```solidity
event Approval(address indexed owner, address indexed spender, uint256 value);
```

### AllowanceUpdate
topic: 0x628e75c63c1873bcd3885f7aee9f58ee36f60dc789b2a6b3a978c4189bc548ba


```solidity
event AllowanceUpdate(address indexed owner, address indexed spender, uint256 valueBefore, uint256 valueAfter);
```

### Mint
topic: 0xb4c03061fb5b7fed76389d5af8f2e0ddb09f8c70d1333abbb62582835e10accb


```solidity
event Mint(address indexed minter, uint256 tokenAmount, uint256 assetAmount, uint256 price);
```

### Burn
topic: 0x743033787f4738ff4d6a7225ce2bd0977ee5f86b91a902a58f5e4d0b297b4644


```solidity
event Burn(address indexed burner, uint256 tokenAmount, uint256 assetAmount, uint256 price);
```

### FlashBorrow
topic: 0xc688ff9bd4a1c369dd44c5cf64efa9db6652fb6b280aa765cd43f17d256b816e


```solidity
event FlashBorrow(address borrower, address target, address loanToken, uint256 loanAmount);
```

### SetTransactionLimits
topic: 0x9bbd2de400810774339120e2f8a2b517ed748595e944529bba8ebabf314d0591


```solidity
event SetTransactionLimits(address[] addresses, uint256[] limits);
```

### WithdrawRBTCTo

```solidity
event WithdrawRBTCTo(address indexed to, uint256 amount);
```

### ToggledFunctionPaused

```solidity
event ToggledFunctionPaused(string functionId, bool prevFlag, bool newFlag);
```

## Structs
### LoanParams
INTERFACE
START LOAN TOKEN SETTINGS LOWER ADMIN


```solidity
struct LoanParams {
    bytes32 id;
    bool active;
    address owner;
    address loanToken;
    address collateralToken;
    uint256 minInitialMargin;
    uint256 maintenanceMargin;
    uint256 maxLoanTerm;
}
```

