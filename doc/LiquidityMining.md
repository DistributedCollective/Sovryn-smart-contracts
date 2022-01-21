# LiquidityMining.sol

View Source: [contracts/farm/LiquidityMining.sol](../contracts/farm/LiquidityMining.sol)

**↗ Extends: [ILiquidityMining](ILiquidityMining.md), [LiquidityMiningStorage](LiquidityMiningStorage.md)**
**↘ Derived Contracts: [LiquidityMiningMockup](LiquidityMiningMockup.md)**

**LiquidityMining**

## Contract Members

**Constants & Variables**

```js
uint256 public constant PRECISION;
uint256 public constant BONUS_BLOCK_MULTIPLIER;
uint256 public constant SECONDS_PER_BLOCK;

```

**Events**

```js
event SOVTransferred(address indexed receiver, uint256  amount);
event PoolTokenAdded(address indexed user, address indexed poolToken, uint256  allocationPoint);
event PoolTokenUpdated(address indexed user, address indexed poolToken, uint256  newAllocationPoint, uint256  oldAllocationPoint);
event Deposit(address indexed user, address indexed poolToken, uint256  amount);
event RewardClaimed(address indexed user, address indexed poolToken, uint256  amount);
event Withdraw(address indexed user, address indexed poolToken, uint256  amount);
event EmergencyWithdraw(address indexed user, address indexed poolToken, uint256  amount, uint256  accumulatedReward);
```

## Functions

- [initialize(IERC20 \_SOV, uint256 \_rewardTokensPerBlock, uint256 \_startDelayBlocks, uint256 \_numberOfBonusBlocks, address \_wrapper, ILockedSOV \_lockedSOV, uint256 \_unlockedImmediatelyPercent)](#initialize)
- [setLockedSOV(ILockedSOV \_lockedSOV)](#setlockedsov)
- [setUnlockedImmediatelyPercent(uint256 \_unlockedImmediatelyPercent)](#setunlockedimmediatelypercent)
- [setWrapper(address \_wrapper)](#setwrapper)
- [stopMining()](#stopmining)
- [transferSOV(address \_receiver, uint256 \_amount)](#transfersov)
- [getMissedBalance()](#getmissedbalance)
- [add(address \_poolToken, uint96 \_allocationPoint, bool \_withUpdate)](#add)
- [update(address \_poolToken, uint96 \_allocationPoint, bool \_updateAllFlag)](#update)
- [\_updateToken(address \_poolToken, uint96 \_allocationPoint)](#_updatetoken)
- [updateTokens(address[] \_poolTokens, uint96[] \_allocationPoints, bool \_updateAllFlag)](#updatetokens)
- [\_getPassedBlocksWithBonusMultiplier(uint256 \_from, uint256 \_to)](#_getpassedblockswithbonusmultiplier)
- [\_getUserAccumulatedReward(uint256 \_poolId, address \_user)](#_getuseraccumulatedreward)
- [getUserAccumulatedReward(address \_poolToken, address \_user)](#getuseraccumulatedreward)
- [getEstimatedReward(address \_poolToken, uint256 \_amount, uint256 \_duration)](#getestimatedreward)
- [updateAllPools()](#updateallpools)
- [updatePool(address \_poolToken)](#updatepool)
- [\_updatePool(uint256 \_poolId)](#_updatepool)
- [\_getPoolAccumulatedReward(struct LiquidityMiningStorage.PoolInfo \_pool)](#_getpoolaccumulatedreward)
- [\_getPoolAccumulatedReward(struct LiquidityMiningStorage.PoolInfo \_pool, uint256 \_additionalAmount, uint256 \_startBlock, uint256 \_endBlock)](#_getpoolaccumulatedreward)
- [deposit(address \_poolToken, uint256 \_amount, address \_user)](#deposit)
- [onTokensDeposited(address \_user, uint256 \_amount)](#ontokensdeposited)
- [\_deposit(address \_poolToken, uint256 \_amount, address \_user, bool alreadyTransferred)](#_deposit)
- [claimReward(address \_poolToken, address \_user)](#claimreward)
- [\_claimReward(uint256 \_poolId, address \_userAddress, bool \_isStakingTokens)](#_claimreward)
- [claimRewardFromAllPools(address \_user)](#claimrewardfromallpools)
- [withdraw(address \_poolToken, uint256 \_amount, address \_user)](#withdraw)
- [\_getUserAddress(address \_user)](#_getuseraddress)
- [\_updateReward(struct LiquidityMiningStorage.PoolInfo pool, struct LiquidityMiningStorage.UserInfo user)](#_updatereward)
- [\_updateRewardDebt(struct LiquidityMiningStorage.PoolInfo pool, struct LiquidityMiningStorage.UserInfo user)](#_updaterewarddebt)
- [\_transferReward(address \_poolToken, struct LiquidityMiningStorage.UserInfo \_user, address \_userAddress, bool \_isStakingTokens, bool \_isCheckingBalance)](#_transferreward)
- [emergencyWithdraw(address \_poolToken)](#emergencywithdraw)
- [getPoolId(address \_poolToken)](#getpoolid)
- [\_getPoolId(address \_poolToken)](#_getpoolid)
- [getPoolLength()](#getpoollength)
- [getPoolInfoList()](#getpoolinfolist)
- [getPoolInfo(address \_poolToken)](#getpoolinfo)
- [getUserBalanceList(address \_user)](#getuserbalancelist)
- [getUserInfo(address \_poolToken, address \_user)](#getuserinfo)
- [getUserInfoList(address \_user)](#getuserinfolist)
- [getUserAccumulatedRewardList(address \_user)](#getuseraccumulatedrewardlist)
- [getUserPoolTokenBalance(address \_poolToken, address \_user)](#getuserpooltokenbalance)

### initialize

Initialize mining. \*

```js
function initialize(IERC20 _SOV, uint256 _rewardTokensPerBlock, uint256 _startDelayBlocks, uint256 _numberOfBonusBlocks, address _wrapper, ILockedSOV _lockedSOV, uint256 _unlockedImmediatelyPercent) external nonpayable onlyAuthorized
```

**Arguments**

| Name                                                | Type       | Description                                           |
| --------------------------------------------------- | ---------- | ----------------------------------------------------- |
| \_SOV                                               | IERC20     | The SOV token.                                        |
| \_rewardTokensPerBlock                              | uint256    | The number of reward tokens per block.                |
| \_startDelayBlocks                                  | uint256    | The number of blocks should be passed to start        |
| mining.                                             |
| \_numberOfBonusBlocks                               | uint256    | The number of blocks when each block will             |
| be calculated as N blocks (BONUS_BLOCK_MULTIPLIER). |
| \_wrapper                                           | address    |                                                       |
| \_lockedSOV                                         | ILockedSOV | The contract instance address of the lockedSOV vault. |

SOV rewards are not paid directly to liquidity providers. Instead they
are deposited into a lockedSOV vault contract. |
| \_unlockedImmediatelyPercent | uint256 | The % which determines how much will be unlocked immediately. |

### setLockedSOV

Sets lockedSOV contract.

```js
function setLockedSOV(ILockedSOV _lockedSOV) external nonpayable onlyAuthorized
```

**Arguments**

| Name        | Type       | Description                                           |
| ----------- | ---------- | ----------------------------------------------------- |
| \_lockedSOV | ILockedSOV | The contract instance address of the lockedSOV vault. |

### setUnlockedImmediatelyPercent

Sets unlocked immediately percent.

```js
function setUnlockedImmediatelyPercent(uint256 _unlockedImmediatelyPercent) external nonpayable onlyAuthorized
```

**Arguments**

| Name                         | Type    | Description                                                   |
| ---------------------------- | ------- | ------------------------------------------------------------- |
| \_unlockedImmediatelyPercent | uint256 | The % which determines how much will be unlocked immediately. |

### setWrapper

sets wrapper proxy contract

```js
function setWrapper(address _wrapper) external nonpayable onlyAuthorized
```

**Arguments**

| Name      | Type    | Description |
| --------- | ------- | ----------- |
| \_wrapper | address |             |

### stopMining

stops mining by setting end block

```js
function stopMining() external nonpayable onlyAuthorized
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### transferSOV

Transfers SOV tokens to given address.
Owner use this function to withdraw SOV from LM contract
into another account.

```js
function transferSOV(address _receiver, uint256 _amount) external nonpayable onlyAuthorized
```

**Arguments**

| Name       | Type    | Description                      |
| ---------- | ------- | -------------------------------- |
| \_receiver | address | The address of the SOV receiver. |
| \_amount   | uint256 | The amount to be transferred.    |

### getMissedBalance

Get the missed SOV balance of LM contract. \*

```js
function getMissedBalance() external view
returns(uint256)
```

**Returns**

The amount of SOV tokens according to totalUsersBalance
in excess of actual SOV balance of the LM contract.

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### add

adds a new lp to the pool. Can only be called by the owner or an admin

```js
function add(address _poolToken, uint96 _allocationPoint, bool _withUpdate) external nonpayable onlyAuthorized
```

**Arguments**

| Name              | Type    | Description                                      |
| ----------------- | ------- | ------------------------------------------------ |
| \_poolToken       | address | the address of pool token                        |
| \_allocationPoint | uint96  | the allocation point (weight) for the given pool |
| \_withUpdate      | bool    | the flag whether we need to update all pools     |

### update

updates the given pool's reward tokens allocation point

```js
function update(address _poolToken, uint96 _allocationPoint, bool _updateAllFlag) external nonpayable onlyAuthorized
```

**Arguments**

| Name              | Type    | Description                                      |
| ----------------- | ------- | ------------------------------------------------ |
| \_poolToken       | address | the address of pool token                        |
| \_allocationPoint | uint96  | the allocation point (weight) for the given pool |
| \_updateAllFlag   | bool    | the flag whether we need to update all pools     |

### \_updateToken

```js
function _updateToken(address _poolToken, uint96 _allocationPoint) internal nonpayable
```

**Arguments**

| Name              | Type    | Description |
| ----------------- | ------- | ----------- |
| \_poolToken       | address |             |
| \_allocationPoint | uint96  |             |

### updateTokens

updates the given pools' reward tokens allocation points

```js
function updateTokens(address[] _poolTokens, uint96[] _allocationPoints, bool _updateAllFlag) external nonpayable onlyAuthorized
```

**Arguments**

| Name               | Type      | Description                                             |
| ------------------ | --------- | ------------------------------------------------------- |
| \_poolTokens       | address[] | array of addresses of pool tokens                       |
| \_allocationPoints | uint96[]  | array of allocation points (weight) for the given pools |
| \_updateAllFlag    | bool      | the flag whether we need to update all pools            |

### \_getPassedBlocksWithBonusMultiplier

returns reward multiplier over the given \_from to \_to block

```js
function _getPassedBlocksWithBonusMultiplier(uint256 _from, uint256 _to) internal view
returns(uint256)
```

**Arguments**

| Name   | Type    | Description                       |
| ------ | ------- | --------------------------------- |
| \_from | uint256 | the first block for a calculation |
| \_to   | uint256 | the last block for a calculation  |

### \_getUserAccumulatedReward

```js
function _getUserAccumulatedReward(uint256 _poolId, address _user) internal view
returns(uint256)
```

**Arguments**

| Name     | Type    | Description |
| -------- | ------- | ----------- |
| \_poolId | uint256 |             |
| \_user   | address |             |

### getUserAccumulatedReward

returns accumulated reward

```js
function getUserAccumulatedReward(address _poolToken, address _user) external view
returns(uint256)
```

**Arguments**

| Name        | Type    | Description               |
| ----------- | ------- | ------------------------- |
| \_poolToken | address | the address of pool token |
| \_user      | address | the user address          |

### getEstimatedReward

returns estimated reward

```js
function getEstimatedReward(address _poolToken, uint256 _amount, uint256 _duration) external view
returns(uint256)
```

**Arguments**

| Name        | Type    | Description                                    |
| ----------- | ------- | ---------------------------------------------- |
| \_poolToken | address | the address of pool token                      |
| \_amount    | uint256 | the amount of tokens to be deposited           |
| \_duration  | uint256 | the duration of liquidity providing in seconds |

### updateAllPools

Updates reward variables for all pools.

```js
function updateAllPools() public nonpayable
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### updatePool

Updates reward variables of the given pool to be up-to-date

```js
function updatePool(address _poolToken) public nonpayable
```

**Arguments**

| Name        | Type    | Description               |
| ----------- | ------- | ------------------------- |
| \_poolToken | address | the address of pool token |

### \_updatePool

```js
function _updatePool(uint256 _poolId) internal nonpayable
```

**Arguments**

| Name     | Type    | Description |
| -------- | ------- | ----------- |
| \_poolId | uint256 |             |

### \_getPoolAccumulatedReward

```js
function _getPoolAccumulatedReward(struct LiquidityMiningStorage.PoolInfo _pool) internal view
returns(uint256, uint256)
```

**Arguments**

| Name   | Type                                   | Description |
| ------ | -------------------------------------- | ----------- |
| \_pool | struct LiquidityMiningStorage.PoolInfo |             |

### \_getPoolAccumulatedReward

```js
function _getPoolAccumulatedReward(struct LiquidityMiningStorage.PoolInfo _pool, uint256 _additionalAmount, uint256 _startBlock, uint256 _endBlock) internal view
returns(uint256, uint256)
```

**Arguments**

| Name               | Type                                   | Description |
| ------------------ | -------------------------------------- | ----------- |
| \_pool             | struct LiquidityMiningStorage.PoolInfo |             |
| \_additionalAmount | uint256                                |             |
| \_startBlock       | uint256                                |             |
| \_endBlock         | uint256                                |             |

### deposit

deposits pool tokens

```js
function deposit(address _poolToken, uint256 _amount, address _user) external nonpayable
```

**Arguments**

| Name        | Type    | Description                                                          |
| ----------- | ------- | -------------------------------------------------------------------- |
| \_poolToken | address | the address of pool token                                            |
| \_amount    | uint256 | the amount of pool tokens                                            |
| \_user      | address | the address of user, tokens will be deposited to it or to msg.sender |

### onTokensDeposited

⤾ overrides [ILiquidityMining.onTokensDeposited](ILiquidityMining.md#ontokensdeposited)

if the lending pools directly mint/transfer tokens to this address, process it like a user deposit

```js
function onTokensDeposited(address _user, uint256 _amount) external nonpayable
```

**Arguments**

| Name     | Type    | Description       |
| -------- | ------- | ----------------- |
| \_user   | address | the user address  |
| \_amount | uint256 | the minted amount |

### \_deposit

internal function for depositing pool tokens

```js
function _deposit(address _poolToken, uint256 _amount, address _user, bool alreadyTransferred) internal nonpayable
```

**Arguments**

| Name               | Type    | Description                                           |
| ------------------ | ------- | ----------------------------------------------------- |
| \_poolToken        | address | the address of pool token                             |
| \_amount           | uint256 | the amount of pool tokens                             |
| \_user             | address | the address of user, tokens will be deposited to it   |
| alreadyTransferred | bool    | true if the pool tokens have already been transferred |

### claimReward

transfers reward tokens

```js
function claimReward(address _poolToken, address _user) external nonpayable
```

**Arguments**

| Name        | Type    | Description                                                                       |
| ----------- | ------- | --------------------------------------------------------------------------------- |
| \_poolToken | address | the address of pool token                                                         |
| \_user      | address | the address of user to claim reward from (can be passed only by wrapper contract) |

### \_claimReward

```js
function _claimReward(uint256 _poolId, address _userAddress, bool _isStakingTokens) internal nonpayable
```

**Arguments**

| Name              | Type    | Description |
| ----------------- | ------- | ----------- |
| \_poolId          | uint256 |             |
| \_userAddress     | address |             |
| \_isStakingTokens | bool    |             |

### claimRewardFromAllPools

transfers reward tokens from all pools

```js
function claimRewardFromAllPools(address _user) external nonpayable
```

**Arguments**

| Name   | Type    | Description                                                                       |
| ------ | ------- | --------------------------------------------------------------------------------- |
| \_user | address | the address of user to claim reward from (can be passed only by wrapper contract) |

### withdraw

⤾ overrides [ILiquidityMining.withdraw](ILiquidityMining.md#withdraw)

withdraws pool tokens and transfers reward tokens

```js
function withdraw(address _poolToken, uint256 _amount, address _user) external nonpayable
```

**Arguments**

| Name        | Type    | Description                                                                                    |
| ----------- | ------- | ---------------------------------------------------------------------------------------------- |
| \_poolToken | address | the address of pool token                                                                      |
| \_amount    | uint256 | the amount of pool tokens                                                                      |
| \_user      | address | the user address will be used to process a withdrawal (can be passed only by wrapper contract) |

### \_getUserAddress

```js
function _getUserAddress(address _user) internal view
returns(address)
```

**Arguments**

| Name   | Type    | Description |
| ------ | ------- | ----------- |
| \_user | address |             |

### \_updateReward

```js
function _updateReward(struct LiquidityMiningStorage.PoolInfo pool, struct LiquidityMiningStorage.UserInfo user) internal nonpayable
```

**Arguments**

| Name | Type                                   | Description |
| ---- | -------------------------------------- | ----------- |
| pool | struct LiquidityMiningStorage.PoolInfo |             |
| user | struct LiquidityMiningStorage.UserInfo |             |

### \_updateRewardDebt

```js
function _updateRewardDebt(struct LiquidityMiningStorage.PoolInfo pool, struct LiquidityMiningStorage.UserInfo user) internal nonpayable
```

**Arguments**

| Name | Type                                   | Description |
| ---- | -------------------------------------- | ----------- |
| pool | struct LiquidityMiningStorage.PoolInfo |             |
| user | struct LiquidityMiningStorage.UserInfo |             |

### \_transferReward

Send reward in SOV to the lockedSOV vault.

```js
function _transferReward(address _poolToken, struct LiquidityMiningStorage.UserInfo _user, address _userAddress, bool _isStakingTokens, bool _isCheckingBalance) internal nonpayable
```

**Arguments**

| Name                | Type                                   | Description                                                                                 |
| ------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------- |
| \_poolToken         | address                                |                                                                                             |
| \_user              | struct LiquidityMiningStorage.UserInfo | The user info, to get its reward share.                                                     |
| \_userAddress       | address                                | The address of the user, to send SOV in its behalf.                                         |
| \_isStakingTokens   | bool                                   | The flag whether we need to stake tokens                                                    |
| \_isCheckingBalance | bool                                   | The flag whether we need to throw error or don't process reward if SOV balance isn't enough |

### emergencyWithdraw

withdraws pool tokens without transferring reward tokens

```js
function emergencyWithdraw(address _poolToken) external nonpayable
```

**Arguments**

| Name        | Type    | Description               |
| ----------- | ------- | ------------------------- |
| \_poolToken | address | the address of pool token |

### getPoolId

returns pool id

```js
function getPoolId(address _poolToken) external view
returns(uint256)
```

**Arguments**

| Name        | Type    | Description               |
| ----------- | ------- | ------------------------- |
| \_poolToken | address | the address of pool token |

### \_getPoolId

```js
function _getPoolId(address _poolToken) internal view
returns(uint256)
```

**Arguments**

| Name        | Type    | Description |
| ----------- | ------- | ----------- |
| \_poolToken | address |             |

### getPoolLength

returns count of pool tokens

```js
function getPoolLength() external view
returns(uint256)
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### getPoolInfoList

returns list of pool token's info

```js
function getPoolInfoList() external view
returns(struct LiquidityMiningStorage.PoolInfo[])
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### getPoolInfo

returns pool info for the given token

```js
function getPoolInfo(address _poolToken) external view
returns(struct LiquidityMiningStorage.PoolInfo)
```

**Arguments**

| Name        | Type    | Description               |
| ----------- | ------- | ------------------------- |
| \_poolToken | address | the address of pool token |

### getUserBalanceList

returns list of [amount, accumulatedReward] for the given user for each pool token

```js
function getUserBalanceList(address _user) external view
returns(uint256[2][])
```

**Arguments**

| Name   | Type    | Description             |
| ------ | ------- | ----------------------- |
| \_user | address | the address of the user |

### getUserInfo

returns UserInfo for the given pool and user

```js
function getUserInfo(address _poolToken, address _user) public view
returns(struct LiquidityMiningStorage.UserInfo)
```

**Arguments**

| Name        | Type    | Description               |
| ----------- | ------- | ------------------------- |
| \_poolToken | address | the address of pool token |
| \_user      | address | the address of the user   |

### getUserInfoList

returns list of UserInfo for the given user for each pool token

```js
function getUserInfoList(address _user) external view
returns(struct LiquidityMiningStorage.UserInfo[])
```

**Arguments**

| Name   | Type    | Description             |
| ------ | ------- | ----------------------- |
| \_user | address | the address of the user |

### getUserAccumulatedRewardList

returns accumulated reward for the given user for each pool token

```js
function getUserAccumulatedRewardList(address _user) external view
returns(uint256[])
```

**Arguments**

| Name   | Type    | Description             |
| ------ | ------- | ----------------------- |
| \_user | address | the address of the user |

### getUserPoolTokenBalance

⤾ overrides [ILiquidityMining.getUserPoolTokenBalance](ILiquidityMining.md#getuserpooltokenbalance)

returns the pool token balance a user has on the contract

```js
function getUserPoolTokenBalance(address _poolToken, address _user) external view
returns(uint256)
```

**Arguments**

| Name        | Type    | Description               |
| ----------- | ------- | ------------------------- |
| \_poolToken | address | the address of pool token |
| \_user      | address | the address of the user   |

## Contracts

- [Address](Address.md)
- [Administered](Administered.md)
- [AdminRole](AdminRole.md)
- [AdvancedToken](AdvancedToken.md)
- [AdvancedTokenStorage](AdvancedTokenStorage.md)
- [Affiliates](Affiliates.md)
- [AffiliatesEvents](AffiliatesEvents.md)
- [ApprovalReceiver](ApprovalReceiver.md)
- [BlockMockUp](BlockMockUp.md)
- [BProPriceFeed](BProPriceFeed.md)
- [BProPriceFeedMockup](BProPriceFeedMockup.md)
- [Checkpoints](Checkpoints.md)
- [Context](Context.md)
- [DevelopmentFund](DevelopmentFund.md)
- [DummyContract](DummyContract.md)
- [ECDSA](ECDSA.md)
- [EnumerableAddressSet](EnumerableAddressSet.md)
- [EnumerableBytes32Set](EnumerableBytes32Set.md)
- [EnumerableBytes4Set](EnumerableBytes4Set.md)
- [ERC20](ERC20.md)
- [ERC20Detailed](ERC20Detailed.md)
- [ErrorDecoder](ErrorDecoder.md)
- [Escrow](Escrow.md)
- [EscrowReward](EscrowReward.md)
- [FeedsLike](FeedsLike.md)
- [FeesEvents](FeesEvents.md)
- [FeeSharingLogic](FeeSharingLogic.md)
- [FeeSharingProxy](FeeSharingProxy.md)
- [FeeSharingProxyMockup](FeeSharingProxyMockup.md)
- [FeeSharingProxyStorage](FeeSharingProxyStorage.md)
- [FeesHelper](FeesHelper.md)
- [FlashLoanerTest](FlashLoanerTest.md)
- [GenericTokenSender](GenericTokenSender.md)
- [GovernorAlpha](GovernorAlpha.md)
- [GovernorAlphaMockup](GovernorAlphaMockup.md)
- [GovernorVault](GovernorVault.md)
- [IApproveAndCall](IApproveAndCall.md)
- [IChai](IChai.md)
- [IContractRegistry](IContractRegistry.md)
- [IConverterAMM](IConverterAMM.md)
- [IERC20\_](IERC20_.md)
- [IERC20](IERC20.md)
- [IFeeSharingProxy](IFeeSharingProxy.md)
- [ILiquidityMining](ILiquidityMining.md)
- [ILiquidityPoolV1Converter](ILiquidityPoolV1Converter.md)
- [ILoanPool](ILoanPool.md)
- [ILoanToken](ILoanToken.md)
- [ILoanTokenLogicBeacon](ILoanTokenLogicBeacon.md)
- [ILoanTokenLogicModules](ILoanTokenLogicModules.md)
- [ILoanTokenLogicProxy](ILoanTokenLogicProxy.md)
- [ILoanTokenModules](ILoanTokenModules.md)
- [ILoanTokenModulesMock](ILoanTokenModulesMock.md)
- [ILoanTokenWRBTC](ILoanTokenWRBTC.md)
- [ILockedSOV](ILockedSOV.md)
- [IMoCState](IMoCState.md)
- [ImplementationMockup](ImplementationMockup.md)
- [Initializable](Initializable.md)
- [InterestUser](InterestUser.md)
- [IPot](IPot.md)
- [IPriceFeeds](IPriceFeeds.md)
- [IPriceFeedsExt](IPriceFeedsExt.md)
- [IProtocol](IProtocol.md)
- [IRSKOracle](IRSKOracle.md)
- [ISovryn](ISovryn.md)
- [ISovrynSwapNetwork](ISovrynSwapNetwork.md)
- [IStaking](IStaking.md)
- [ISwapsImpl](ISwapsImpl.md)
- [ITeamVesting](ITeamVesting.md)
- [ITimelock](ITimelock.md)
- [ITokenFlashLoanTest](ITokenFlashLoanTest.md)
- [IV1PoolOracle](IV1PoolOracle.md)
- [IVesting](IVesting.md)
- [IVestingFactory](IVestingFactory.md)
- [IVestingRegistry](IVestingRegistry.md)
- [IWrbtc](IWrbtc.md)
- [IWrbtcERC20](IWrbtcERC20.md)
- [LenderInterestStruct](LenderInterestStruct.md)
- [LiquidationHelper](LiquidationHelper.md)
- [LiquidityMining](LiquidityMining.md)
- [LiquidityMiningConfigToken](LiquidityMiningConfigToken.md)
- [LiquidityMiningMockup](LiquidityMiningMockup.md)
- [LiquidityMiningProxy](LiquidityMiningProxy.md)
- [LiquidityMiningStorage](LiquidityMiningStorage.md)
- [LiquidityPoolV1ConverterMockup](LiquidityPoolV1ConverterMockup.md)
- [LoanClosingsEvents](LoanClosingsEvents.md)
- [LoanClosingsLiquidation](LoanClosingsLiquidation.md)
- [LoanClosingsRollover](LoanClosingsRollover.md)
- [LoanClosingsShared](LoanClosingsShared.md)
- [LoanClosingsWith](LoanClosingsWith.md)
- [LoanInterestStruct](LoanInterestStruct.md)
- [LoanMaintenance](LoanMaintenance.md)
- [LoanMaintenanceEvents](LoanMaintenanceEvents.md)
- [LoanOpenings](LoanOpenings.md)
- [LoanOpeningsEvents](LoanOpeningsEvents.md)
- [LoanParamsStruct](LoanParamsStruct.md)
- [LoanSettings](LoanSettings.md)
- [LoanSettingsEvents](LoanSettingsEvents.md)
- [LoanStruct](LoanStruct.md)
- [LoanToken](LoanToken.md)
- [LoanTokenBase](LoanTokenBase.md)
- [LoanTokenLogicBeacon](LoanTokenLogicBeacon.md)
- [LoanTokenLogicLM](LoanTokenLogicLM.md)
- [LoanTokenLogicLMMockup](LoanTokenLogicLMMockup.md)
- [LoanTokenLogicLMV1Mockup](LoanTokenLogicLMV1Mockup.md)
- [LoanTokenLogicLMV2Mockup](LoanTokenLogicLMV2Mockup.md)
- [LoanTokenLogicProxy](LoanTokenLogicProxy.md)
- [LoanTokenLogicStandard](LoanTokenLogicStandard.md)
- [LoanTokenLogicStorage](LoanTokenLogicStorage.md)
- [LoanTokenLogicTest](LoanTokenLogicTest.md)
- [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)
- [LoanTokenSettingsLowerAdmin](LoanTokenSettingsLowerAdmin.md)
- [LockedSOV](LockedSOV.md)
- [LockedSOVFailedMockup](LockedSOVFailedMockup.md)
- [LockedSOVMockup](LockedSOVMockup.md)
- [Medianizer](Medianizer.md)
- [MockAffiliates](MockAffiliates.md)
- [MockLoanTokenLogic](MockLoanTokenLogic.md)
- [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)
- [ModulesCommonEvents](ModulesCommonEvents.md)
- [MultiSigKeyHolders](MultiSigKeyHolders.md)
- [MultiSigWallet](MultiSigWallet.md)
- [Objects](Objects.md)
- [OrderStruct](OrderStruct.md)
- [OrigingVestingCreator](OrigingVestingCreator.md)
- [OriginInvestorsClaim](OriginInvestorsClaim.md)
- [Ownable](Ownable.md)
- [Pausable](Pausable.md)
- [PausableOz](PausableOz.md)
- [PreviousLoanToken](PreviousLoanToken.md)
- [PreviousLoanTokenSettingsLowerAdmin](PreviousLoanTokenSettingsLowerAdmin.md)
- [PriceFeedRSKOracle](PriceFeedRSKOracle.md)
- [PriceFeedRSKOracleMockup](PriceFeedRSKOracleMockup.md)
- [PriceFeeds](PriceFeeds.md)
- [PriceFeedsConstants](PriceFeedsConstants.md)
- [PriceFeedsMoC](PriceFeedsMoC.md)
- [PriceFeedsMoCMockup](PriceFeedsMoCMockup.md)
- [PriceFeedV1PoolOracle](PriceFeedV1PoolOracle.md)
- [ProtocolAffiliatesInterface](ProtocolAffiliatesInterface.md)
- [ProtocolLike](ProtocolLike.md)
- [ProtocolSettings](ProtocolSettings.md)
- [ProtocolSettingsEvents](ProtocolSettingsEvents.md)
- [ProtocolSettingsLike](ProtocolSettingsLike.md)
- [ProtocolSettingsMockup](ProtocolSettingsMockup.md)
- [ProtocolSwapExternalInterface](ProtocolSwapExternalInterface.md)
- [ProtocolTokenUser](ProtocolTokenUser.md)
- [Proxy](Proxy.md)
- [ProxyMockup](ProxyMockup.md)
- [RBTCWrapperProxyMockup](RBTCWrapperProxyMockup.md)
- [ReentrancyGuard](ReentrancyGuard.md)
- [RewardHelper](RewardHelper.md)
- [RSKAddrValidator](RSKAddrValidator.md)
- [SafeERC20](SafeERC20.md)
- [SafeMath](SafeMath.md)
- [SafeMath96](SafeMath96.md)
- [setGet](setGet.md)
- [SignedSafeMath](SignedSafeMath.md)
- [SOV](SOV.md)
- [sovrynProtocol](sovrynProtocol.md)
- [Staking](Staking.md)
- [StakingInterface](StakingInterface.md)
- [StakingMock](StakingMock.md)
- [StakingMockup](StakingMockup.md)
- [StakingProxy](StakingProxy.md)
- [StakingRewards](StakingRewards.md)
- [StakingRewardsMockUp](StakingRewardsMockUp.md)
- [StakingRewardsProxy](StakingRewardsProxy.md)
- [StakingRewardsStorage](StakingRewardsStorage.md)
- [StakingStorage](StakingStorage.md)
- [State](State.md)
- [StorageMockup](StorageMockup.md)
- [SVR](SVR.md)
- [SwapsEvents](SwapsEvents.md)
- [SwapsExternal](SwapsExternal.md)
- [SwapsImplLocal](SwapsImplLocal.md)
- [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md)
- [SwapsUser](SwapsUser.md)
- [TeamVesting](TeamVesting.md)
- [TestCoverage](TestCoverage.md)
- [TestLibraries](TestLibraries.md)
- [TestSovrynSwap](TestSovrynSwap.md)
- [TestToken](TestToken.md)
- [TestWrbtc](TestWrbtc.md)
- [Timelock](Timelock.md)
- [TimelockHarness](TimelockHarness.md)
- [TimelockInterface](TimelockInterface.md)
- [TimelockTest](TimelockTest.md)
- [TokenSender](TokenSender.md)
- [UpgradableProxy](UpgradableProxy.md)
- [USDTPriceFeed](USDTPriceFeed.md)
- [VaultController](VaultController.md)
- [Vesting](Vesting.md)
- [VestingCreator](VestingCreator.md)
- [VestingFactory](VestingFactory.md)
- [VestingLogic](VestingLogic.md)
- [VestingLogicMockup](VestingLogicMockup.md)
- [VestingRegistry](VestingRegistry.md)
- [VestingRegistry2](VestingRegistry2.md)
- [VestingRegistry3](VestingRegistry3.md)
- [VestingRegistryLogic](VestingRegistryLogic.md)
- [VestingRegistryLogicMockup](VestingRegistryLogicMockup.md)
- [VestingRegistryProxy](VestingRegistryProxy.md)
- [VestingRegistryStorage](VestingRegistryStorage.md)
- [VestingStorage](VestingStorage.md)
- [WeightedStaking](WeightedStaking.md)
- [WRBTC](WRBTC.md)
