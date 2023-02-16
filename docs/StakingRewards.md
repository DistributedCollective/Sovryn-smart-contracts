# Staking Rewards Contract. (StakingRewards.sol)

View Source: [contracts/governance/StakingRewards/StakingRewards.sol](../contracts/governance/StakingRewards/StakingRewards.sol)

**↗ Extends: [StakingRewardsStorage](StakingRewardsStorage.md)**

**StakingRewards**

This is a trial incentive program.
In this, the SOV emitted and becoming liquid from the Adoption Fund could be utilized
to offset the higher APY's offered for Liquidity Mining events.
Vesting contract stakes are excluded from these rewards.
Only wallets which have staked previously liquid SOV are eligible for these rewards.
Tokenholders who stake their SOV receive staking rewards, a pro-rata share
of the revenue that the platform generates from various transaction fees
plus revenues from stakers who have a portion of their SOV slashed for
early unstaking.

**Events**

```js
event RewardWithdrawn(address indexed receiver, uint256  amount);
```

## Functions

- [initialize(address _SOV, IStaking _staking)](#initialize)
- [stop()](#stop)
- [collectReward(uint256 restartTime)](#collectreward)
- [withdrawTokensByOwner(address _receiverAddress)](#withdrawtokensbyowner)
- [setAverageBlockTime(uint256 _averageBlockTime)](#setaverageblocktime)
- [setBlock()](#setblock)
- [setHistoricalBlock(uint256 _time)](#sethistoricalblock)
- [setMaxDuration(uint256 _duration)](#setmaxduration)
- [_computeRewardForDate(address _staker, uint256 _block, uint256 _date)](#_computerewardfordate)
- [_payReward(address _staker, uint256 amount)](#_payreward)
- [_transferSOV(address _receiver, uint256 _amount)](#_transfersov)
- [_getCurrentBlockNumber()](#_getcurrentblocknumber)
- [_setBlock(uint256 _checkpointTime)](#_setblock)
- [getStakerCurrentReward(bool considerMaxDuration, uint256 restartTime)](#getstakercurrentreward)

---    

> ### initialize

Replacement of constructor by initialize function for Upgradable Contracts
This function will be called only once by the owner.

```solidity
function initialize(address _SOV, IStaking _staking) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _SOV | address | SOV token address | 
| _staking | IStaking | StakingProxy address should be passed | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function initialize(address _SOV, IStaking _staking) external onlyOwner {
        require(_SOV != address(0), "Invalid SOV Address.");
        require(Address.isContract(_SOV), "_SOV not a contract");
        SOV = IERC20(_SOV);
        staking = _staking;
        startTime = staking.timestampToLockDate(block.timestamp);
        setMaxDuration(15 * TWO_WEEKS);
        deploymentBlock = _getCurrentBlockNumber();
    }
```
</details>

---    

> ### stop

Stops the current rewards program.

```solidity
function stop() external nonpayable onlyOwner 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function stop() external onlyOwner {
        require(stopBlock == 0, "Already stopped");
        stopBlock = _getCurrentBlockNumber();
    }
```
</details>

---    

> ### collectReward

Collect rewards

```solidity
function collectReward(uint256 restartTime) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| restartTime | uint256 | The time from which the staking rewards calculation shall restart. The issue is that we can only run for a max duration and if someone stakes for the first time after the max duration is over, the reward will always return 0. Thus, we need to restart from the duration that elapsed without generating rewards. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function collectReward(uint256 restartTime) external {
        (uint256 withdrawalTime, uint256 amount) = getStakerCurrentReward(true, restartTime);
        require(withdrawalTime > 0 && amount > 0, "no valid reward");
        withdrawals[msg.sender] = withdrawalTime;
        _payReward(msg.sender, amount);
    }
```
</details>

---    

> ### withdrawTokensByOwner

Withdraws all token from the contract by Multisig.

```solidity
function withdrawTokensByOwner(address _receiverAddress) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _receiverAddress | address | The address where the tokens has to be transferred. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawTokensByOwner(address _receiverAddress) external onlyOwner {
        uint256 value = SOV.balanceOf(address(this));
        _transferSOV(_receiverAddress, value);
    }
```
</details>

---    

> ### setAverageBlockTime

Changes average block time - based on blockchain

```solidity
function setAverageBlockTime(uint256 _averageBlockTime) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _averageBlockTime | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setAverageBlockTime(uint256 _averageBlockTime) external onlyOwner {
        averageBlockTime = _averageBlockTime;
    }
```
</details>

---    

> ### setBlock

This function computes the last staking checkpoint and calculates the corresponding
block number using the average block time which is then added to the mapping `checkpointBlockDetails`.

```solidity
function setBlock() external nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setBlock() external {
        uint256 lastCheckpointTime = staking.timestampToLockDate(block.timestamp);
        _setBlock(lastCheckpointTime);
    }
```
</details>

---    

> ### setHistoricalBlock

This function computes the block number using the average block time for a given historical
checkpoint which is added to the mapping `checkpointBlockDetails`.

```solidity
function setHistoricalBlock(uint256 _time) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _time | uint256 | Exact staking checkpoint time | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setHistoricalBlock(uint256 _time) external {
        _setBlock(_time);
    }
```
</details>

---    

> ### setMaxDuration

Sets the max duration

```solidity
function setMaxDuration(uint256 _duration) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _duration | uint256 | Max duration for which rewards can be collected at a go (in seconds) | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setMaxDuration(uint256 _duration) public onlyOwner {
        maxDuration = _duration;
    }
```
</details>

---    

> ### _computeRewardForDate

Internal function to calculate weighted stake

```solidity
function _computeRewardForDate(address _staker, uint256 _block, uint256 _date) internal view
returns(weightedStake uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _staker | address | Staker address | 
| _block | uint256 | Last finalised block | 
| _date | uint256 | The date to compute prior weighted stakes | 

**Returns**

The weighted stake

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _computeRewardForDate(
        address _staker,
        uint256 _block,
        uint256 _date
    ) internal view returns (uint256 weightedStake) {
        weightedStake = staking.getPriorWeightedStake(_staker, _block, _date);
        if (stopBlock > 0) {
            uint256 previousWeightedStake =
                staking.getPriorWeightedStake(_staker, stopBlock, _date);
            if (previousWeightedStake < weightedStake) {
                weightedStake = previousWeightedStake;
            }
        }
    }
```
</details>

---    

> ### _payReward

Internal function to pay rewards

```solidity
function _payReward(address _staker, uint256 amount) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _staker | address | User address | 
| amount | uint256 | the reward amount | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _payReward(address _staker, uint256 amount) internal {
        require(SOV.balanceOf(address(this)) >= amount, "not enough funds to reward user");
        claimedBalances[_staker] = claimedBalances[_staker].add(amount);
        _transferSOV(_staker, amount);
    }
```
</details>

---    

> ### _transferSOV

transfers SOV tokens to given address

```solidity
function _transferSOV(address _receiver, uint256 _amount) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _receiver | address | the address of the SOV receiver | 
| _amount | uint256 | the amount to be transferred | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _transferSOV(address _receiver, uint256 _amount) internal {
        require(_amount != 0, "amount invalid");
        require(SOV.transfer(_receiver, _amount), "transfer failed");
        emit RewardWithdrawn(_receiver, _amount);
    }
```
</details>

---    

> ### _getCurrentBlockNumber

Determine the current Block Number

```solidity
function _getCurrentBlockNumber() internal view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getCurrentBlockNumber() internal view returns (uint256) {
        return block.number;
    }
```
</details>

---    

> ### _setBlock

Internal function to calculate and set block

```solidity
function _setBlock(uint256 _checkpointTime) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _checkpointTime | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _setBlock(uint256 _checkpointTime) internal {
        uint256 currentTS = block.timestamp;
        uint256 lastFinalisedBlock = _getCurrentBlockNumber() - 1;
        require(checkpointBlockDetails[_checkpointTime] == 0, "block number already set");
        uint256 checkpointBlock =
            lastFinalisedBlock.sub(((currentTS.sub(_checkpointTime)).div(averageBlockTime)));
        checkpointBlockDetails[_checkpointTime] = checkpointBlock;
    }
```
</details>

---    

> ### getStakerCurrentReward

Get staker's current accumulated reward

```solidity
function getStakerCurrentReward(bool considerMaxDuration, uint256 restartTime) public view
returns(lastWithdrawalInterval uint256, amount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| considerMaxDuration | bool | True: Runs for the maximum duration - used in tx not to run out of gas False - to query total rewards | 
| restartTime | uint256 | The time from which the staking rewards calculation shall restart. | 

**Returns**

The timestamp of last withdrawal

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getStakerCurrentReward(bool considerMaxDuration, uint256 restartTime)
        public
        view
        returns (uint256 lastWithdrawalInterval, uint256 amount)
    {
        uint256 weightedStake;
        uint256 lastFinalisedBlock = _getCurrentBlockNumber() - 1;
        uint256 currentTS = block.timestamp;
        uint256 duration;
        address staker = msg.sender;
        uint256 lastWithdrawal = withdrawals[staker];

        uint256 lastStakingInterval = staking.timestampToLockDate(currentTS);
        lastWithdrawalInterval = lastWithdrawal > 0 ? lastWithdrawal : startTime;
        if (lastStakingInterval <= lastWithdrawalInterval) return (0, 0);
        /* Normally the restart time is 0. If this function returns a valid lastWithdrawalInterval
		and zero amount - that means there were no valid rewards for that period. So the new period must start
		from the end of the last interval or till the time no rewards are accumulated i.e. restartTime */
        if (restartTime >= lastWithdrawalInterval) {
            uint256 latestRestartTime = staking.timestampToLockDate(restartTime);
            lastWithdrawalInterval = latestRestartTime;
        }

        if (considerMaxDuration) {
            uint256 addedMaxDuration = lastWithdrawalInterval.add(maxDuration);
            duration = addedMaxDuration < currentTS
                ? staking.timestampToLockDate(addedMaxDuration)
                : lastStakingInterval;
        } else {
            duration = lastStakingInterval;
        }

        for (uint256 i = lastWithdrawalInterval; i < duration; i += TWO_WEEKS) {
            uint256 referenceBlock = checkpointBlockDetails[i];
            if (referenceBlock == 0) {
                referenceBlock = lastFinalisedBlock.sub(
                    ((currentTS.sub(i)).div(averageBlockTime))
                );
            }
            if (referenceBlock < deploymentBlock) referenceBlock = deploymentBlock;
            weightedStake = weightedStake.add(_computeRewardForDate(staker, referenceBlock, i));
        }

        lastWithdrawalInterval = duration;
        amount = weightedStake.mul(BASE_RATE).div(DIVISOR);
    }
```
</details>

## Contracts

* [Address](Address.md)
* [Administered](Administered.md)
* [AdminRole](AdminRole.md)
* [AdvancedToken](AdvancedToken.md)
* [AdvancedTokenStorage](AdvancedTokenStorage.md)
* [Affiliates](Affiliates.md)
* [AffiliatesEvents](AffiliatesEvents.md)
* [ApprovalReceiver](ApprovalReceiver.md)
* [BProPriceFeed](BProPriceFeed.md)
* [Checkpoints](Checkpoints.md)
* [Constants](Constants.md)
* [Context](Context.md)
* [DevelopmentFund](DevelopmentFund.md)
* [DummyContract](DummyContract.md)
* [ECDSA](ECDSA.md)
* [EnumerableAddressSet](EnumerableAddressSet.md)
* [EnumerableBytes32Set](EnumerableBytes32Set.md)
* [EnumerableBytes4Set](EnumerableBytes4Set.md)
* [ERC20](ERC20.md)
* [ERC20Detailed](ERC20Detailed.md)
* [ErrorDecoder](ErrorDecoder.md)
* [Escrow](Escrow.md)
* [EscrowReward](EscrowReward.md)
* [FeedsLike](FeedsLike.md)
* [FeesEvents](FeesEvents.md)
* [FeeSharingLogic](FeeSharingLogic.md)
* [FeeSharingProxy](FeeSharingProxy.md)
* [FeeSharingProxyStorage](FeeSharingProxyStorage.md)
* [FeesHelper](FeesHelper.md)
* [FourYearVesting](FourYearVesting.md)
* [FourYearVestingFactory](FourYearVestingFactory.md)
* [FourYearVestingLogic](FourYearVestingLogic.md)
* [FourYearVestingStorage](FourYearVestingStorage.md)
* [GenericTokenSender](GenericTokenSender.md)
* [GovernorAlpha](GovernorAlpha.md)
* [GovernorVault](GovernorVault.md)
* [IApproveAndCall](IApproveAndCall.md)
* [IChai](IChai.md)
* [IContractRegistry](IContractRegistry.md)
* [IConverterAMM](IConverterAMM.md)
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IFeeSharingProxy](IFeeSharingProxy.md)
* [IFourYearVesting](IFourYearVesting.md)
* [IFourYearVestingFactory](IFourYearVestingFactory.md)
* [ILiquidityMining](ILiquidityMining.md)
* [ILiquidityPoolV1Converter](ILiquidityPoolV1Converter.md)
* [ILoanPool](ILoanPool.md)
* [ILoanToken](ILoanToken.md)
* [ILoanTokenLogicBeacon](ILoanTokenLogicBeacon.md)
* [ILoanTokenLogicModules](ILoanTokenLogicModules.md)
* [ILoanTokenLogicProxy](ILoanTokenLogicProxy.md)
* [ILoanTokenModules](ILoanTokenModules.md)
* [ILoanTokenWRBTC](ILoanTokenWRBTC.md)
* [ILockedSOV](ILockedSOV.md)
* [IMoCState](IMoCState.md)
* [Initializable](Initializable.md)
* [InterestUser](InterestUser.md)
* [IPot](IPot.md)
* [IPriceFeeds](IPriceFeeds.md)
* [IPriceFeedsExt](IPriceFeedsExt.md)
* [IProtocol](IProtocol.md)
* [IRSKOracle](IRSKOracle.md)
* [ISovryn](ISovryn.md)
* [ISovrynSwapNetwork](ISovrynSwapNetwork.md)
* [IStaking](IStaking.md)
* [ISwapsImpl](ISwapsImpl.md)
* [ITeamVesting](ITeamVesting.md)
* [ITimelock](ITimelock.md)
* [IV1PoolOracle](IV1PoolOracle.md)
* [IVesting](IVesting.md)
* [IVestingFactory](IVestingFactory.md)
* [IVestingRegistry](IVestingRegistry.md)
* [IWrbtc](IWrbtc.md)
* [IWrbtcERC20](IWrbtcERC20.md)
* [LenderInterestStruct](LenderInterestStruct.md)
* [LiquidationHelper](LiquidationHelper.md)
* [LiquidityMining](LiquidityMining.md)
* [LiquidityMiningConfigToken](LiquidityMiningConfigToken.md)
* [LiquidityMiningProxy](LiquidityMiningProxy.md)
* [LiquidityMiningStorage](LiquidityMiningStorage.md)
* [LoanClosingsEvents](LoanClosingsEvents.md)
* [LoanClosingsLiquidation](LoanClosingsLiquidation.md)
* [LoanClosingsRollover](LoanClosingsRollover.md)
* [LoanClosingsShared](LoanClosingsShared.md)
* [LoanClosingsWith](LoanClosingsWith.md)
* [LoanInterestStruct](LoanInterestStruct.md)
* [LoanMaintenance](LoanMaintenance.md)
* [LoanMaintenanceEvents](LoanMaintenanceEvents.md)
* [LoanOpenings](LoanOpenings.md)
* [LoanOpeningsEvents](LoanOpeningsEvents.md)
* [LoanParamsStruct](LoanParamsStruct.md)
* [LoanSettings](LoanSettings.md)
* [LoanSettingsEvents](LoanSettingsEvents.md)
* [LoanStruct](LoanStruct.md)
* [LoanToken](LoanToken.md)
* [LoanTokenBase](LoanTokenBase.md)
* [LoanTokenLogicBeacon](LoanTokenLogicBeacon.md)
* [LoanTokenLogicLM](LoanTokenLogicLM.md)
* [LoanTokenLogicProxy](LoanTokenLogicProxy.md)
* [LoanTokenLogicStandard](LoanTokenLogicStandard.md)
* [LoanTokenLogicStorage](LoanTokenLogicStorage.md)
* [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)
* [LoanTokenSettingsLowerAdmin](LoanTokenSettingsLowerAdmin.md)
* [LockedSOV](LockedSOV.md)
* [Medianizer](Medianizer.md)
* [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)
* [ModulesCommonEvents](ModulesCommonEvents.md)
* [MultiSigKeyHolders](MultiSigKeyHolders.md)
* [MultiSigWallet](MultiSigWallet.md)
* [Objects](Objects.md)
* [OrderStruct](OrderStruct.md)
* [OrigingVestingCreator](OrigingVestingCreator.md)
* [OriginInvestorsClaim](OriginInvestorsClaim.md)
* [Ownable](Ownable.md)
* [Pausable](Pausable.md)
* [PausableOz](PausableOz.md)
* [PreviousLoanToken](PreviousLoanToken.md)
* [PreviousLoanTokenSettingsLowerAdmin](PreviousLoanTokenSettingsLowerAdmin.md)
* [PriceFeedRSKOracle](PriceFeedRSKOracle.md)
* [PriceFeeds](PriceFeeds.md)
* [PriceFeedsLocal](PriceFeedsLocal.md)
* [PriceFeedsMoC](PriceFeedsMoC.md)
* [PriceFeedV1PoolOracle](PriceFeedV1PoolOracle.md)
* [ProtocolAffiliatesInterface](ProtocolAffiliatesInterface.md)
* [ProtocolLike](ProtocolLike.md)
* [ProtocolSettings](ProtocolSettings.md)
* [ProtocolSettingsEvents](ProtocolSettingsEvents.md)
* [ProtocolSettingsLike](ProtocolSettingsLike.md)
* [ProtocolSwapExternalInterface](ProtocolSwapExternalInterface.md)
* [ProtocolTokenUser](ProtocolTokenUser.md)
* [Proxy](Proxy.md)
* [ReentrancyGuard](ReentrancyGuard.md)
* [RewardHelper](RewardHelper.md)
* [RSKAddrValidator](RSKAddrValidator.md)
* [SafeERC20](SafeERC20.md)
* [SafeMath](SafeMath.md)
* [SafeMath96](SafeMath96.md)
* [setGet](setGet.md)
* [SignedSafeMath](SignedSafeMath.md)
* [SOV](SOV.md)
* [sovrynProtocol](sovrynProtocol.md)
* [Staking](Staking.md)
* [StakingInterface](StakingInterface.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingStorage](StakingStorage.md)
* [State](State.md)
* [SVR](SVR.md)
* [SwapsEvents](SwapsEvents.md)
* [SwapsExternal](SwapsExternal.md)
* [SwapsImplLocal](SwapsImplLocal.md)
* [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md)
* [SwapsUser](SwapsUser.md)
* [TeamVesting](TeamVesting.md)
* [Timelock](Timelock.md)
* [TimelockHarness](TimelockHarness.md)
* [TimelockInterface](TimelockInterface.md)
* [TokenSender](TokenSender.md)
* [UpgradableProxy](UpgradableProxy.md)
* [USDTPriceFeed](USDTPriceFeed.md)
* [VaultController](VaultController.md)
* [Vesting](Vesting.md)
* [VestingCreator](VestingCreator.md)
* [VestingFactory](VestingFactory.md)
* [VestingLogic](VestingLogic.md)
* [VestingRegistry](VestingRegistry.md)
* [VestingRegistry2](VestingRegistry2.md)
* [VestingRegistry3](VestingRegistry3.md)
* [VestingRegistryLogic](VestingRegistryLogic.md)
* [VestingRegistryProxy](VestingRegistryProxy.md)
* [VestingRegistryStorage](VestingRegistryStorage.md)
* [VestingStorage](VestingStorage.md)
* [WeightedStaking](WeightedStaking.md)
* [WRBTC](WRBTC.md)
