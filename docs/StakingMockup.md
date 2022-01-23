# StakingMockup.sol

View Source: [contracts/mockup/StakingMockup.sol](../contracts/mockup/StakingMockup.sol)

**↗ Extends: [Staking](Staking.md)**

**StakingMockup**

## Contract Members
**Constants & Variables**

```js
uint96 internal priorTotalVotingPower;
uint96 internal priorWeightedStake;

```

## Functions

- [balanceOf_MultipliedByTwo(address account)](#balanceof_multipliedbytwo)
- [MOCK_priorTotalVotingPower(uint96 _priorTotalVotingPower)](#mock_priortotalvotingpower)
- [getPriorTotalVotingPower(uint32 blockNumber, uint256 time)](#getpriortotalvotingpower)
- [MOCK_priorWeightedStake(uint96 _priorWeightedStake)](#mock_priorweightedstake)
- [getPriorWeightedStake(address account, uint256 blockNumber, uint256 date)](#getpriorweightedstake)
- [calculatePriorWeightedStake(address account, uint256 blockNumber, uint256 date)](#calculatepriorweightedstake)
- [setDelegateStake(address delegatee, uint256 lockedTS, uint96 value)](#setdelegatestake)
- [addContractCodeHash(address vesting)](#addcontractcodehash)
- [removeContractCodeHash(address vesting)](#removecontractcodehash)
- [_getCodeHash(address _contract)](#_getcodehash)
- [isVestingContract(address stakerAddress)](#isvestingcontract)

---    

> ### balanceOf_MultipliedByTwo

```solidity
function balanceOf_MultipliedByTwo(address account) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function balanceOf_MultipliedByTwo(address account) external view returns (uint256) {
		return balanceOf(account) * 2;
	}
```
</details>

---    

> ### MOCK_priorTotalVotingPower

```solidity
function MOCK_priorTotalVotingPower(uint96 _priorTotalVotingPower) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _priorTotalVotingPower | uint96 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function MOCK_priorTotalVotingPower(uint96 _priorTotalVotingPower) public {
		priorTotalVotingPower = _priorTotalVotingPower;
	}
```
</details>

---    

> ### getPriorTotalVotingPower

undefined

```solidity
function getPriorTotalVotingPower(uint32 blockNumber, uint256 time) public view
returns(totalVotingPower uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| blockNumber | uint32 |  | 
| time | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getPriorTotalVotingPower(uint32 blockNumber, uint256 time) public view returns (uint96 totalVotingPower) {
		return priorTotalVotingPower != 0 ? priorTotalVotingPower : super.getPriorTotalVotingPower(blockNumber, time);
	}
```
</details>

---    

> ### MOCK_priorWeightedStake

```solidity
function MOCK_priorWeightedStake(uint96 _priorWeightedStake) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _priorWeightedStake | uint96 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function MOCK_priorWeightedStake(uint96 _priorWeightedStake) public {
		priorWeightedStake = _priorWeightedStake;
	}
```
</details>

---    

> ### getPriorWeightedStake

undefined

```solidity
function getPriorWeightedStake(address account, uint256 blockNumber, uint256 date) public view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address |  | 
| blockNumber | uint256 |  | 
| date | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getPriorWeightedStake(
		address account,
		uint256 blockNumber,
		uint256 date
	) public view returns (uint96) {
		return priorWeightedStake != 0 ? priorWeightedStake : super.getPriorWeightedStake(account, blockNumber, date);
	}
```
</details>

---    

> ### calculatePriorWeightedStake

```solidity
function calculatePriorWeightedStake(address account, uint256 blockNumber, uint256 date) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address |  | 
| blockNumber | uint256 |  | 
| date | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function calculatePriorWeightedStake(
		address account,
		uint256 blockNumber,
		uint256 date
	) public {
		super.getPriorWeightedStake(account, blockNumber, date);
	}
```
</details>

---    

> ### setDelegateStake

We need this function to simulate zero delegate checkpoint value.

```solidity
function setDelegateStake(address delegatee, uint256 lockedTS, uint96 value) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| delegatee | address |  | 
| lockedTS | uint256 |  | 
| value | uint96 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setDelegateStake(
		address delegatee,
		uint256 lockedTS,
		uint96 value
	) public {
		uint32 nCheckpoints = numDelegateStakingCheckpoints[delegatee][lockedTS];
		uint96 staked = delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].stake;
		_writeDelegateCheckpoint(delegatee, lockedTS, nCheckpoints, 0);
	}
```
</details>

---    

> ### addContractCodeHash

undefined

Add vesting contract's code hash to a map of code hashes.

```solidity
function addContractCodeHash(address vesting) public nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vesting | address | The address of Vesting contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addContractCodeHash(address vesting) public onlyAuthorized {
		bytes32 codeHash = _getCodeHash(vesting);
		vestingCodeHashes[codeHash] = true;
		emit ContractCodeHashAdded(codeHash);
	}
```
</details>

---    

> ### removeContractCodeHash

undefined

Add vesting contract's code hash to a map of code hashes.

```solidity
function removeContractCodeHash(address vesting) public nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vesting | address | The address of Vesting contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeContractCodeHash(address vesting) public onlyAuthorized {
		bytes32 codeHash = _getCodeHash(vesting);
		vestingCodeHashes[codeHash] = false;
		emit ContractCodeHashRemoved(codeHash);
	}
```
</details>

---    

> ### _getCodeHash

undefined

Return hash of contract code

```solidity
function _getCodeHash(address _contract) internal view
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _contract | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getCodeHash(address _contract) internal view returns (bytes32) {
		bytes32 codeHash;
		assembly {
			codeHash := extcodehash(_contract)
		}
		return codeHash;
	}
```
</details>

---    

> ### isVestingContract

undefined

Return flag whether the given address is a registered vesting contract.

```solidity
function isVestingContract(address stakerAddress) public view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| stakerAddress | address | the address to check | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function isVestingContract(address stakerAddress) public view returns (bool) {
		bytes32 codeHash = _getCodeHash(stakerAddress);
		return vestingCodeHashes[codeHash];
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
* [BlockMockUp](BlockMockUp.md)
* [BProPriceFeed](BProPriceFeed.md)
* [BProPriceFeedMockup](BProPriceFeedMockup.md)
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
* [FeeSharingProxyMockup](FeeSharingProxyMockup.md)
* [FeeSharingProxyStorage](FeeSharingProxyStorage.md)
* [FeesHelper](FeesHelper.md)
* [FlashLoanerTest](FlashLoanerTest.md)
* [GenericTokenSender](GenericTokenSender.md)
* [GovernorAlpha](GovernorAlpha.md)
* [GovernorAlphaMockup](GovernorAlphaMockup.md)
* [GovernorVault](GovernorVault.md)
* [IApproveAndCall](IApproveAndCall.md)
* [IChai](IChai.md)
* [IContractRegistry](IContractRegistry.md)
* [IConverterAMM](IConverterAMM.md)
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IFeeSharingProxy](IFeeSharingProxy.md)
* [ILiquidityMining](ILiquidityMining.md)
* [ILiquidityPoolV1Converter](ILiquidityPoolV1Converter.md)
* [ILoanPool](ILoanPool.md)
* [ILoanToken](ILoanToken.md)
* [ILoanTokenLogicBeacon](ILoanTokenLogicBeacon.md)
* [ILoanTokenLogicModules](ILoanTokenLogicModules.md)
* [ILoanTokenLogicProxy](ILoanTokenLogicProxy.md)
* [ILoanTokenModules](ILoanTokenModules.md)
* [ILoanTokenModulesMock](ILoanTokenModulesMock.md)
* [ILoanTokenWRBTC](ILoanTokenWRBTC.md)
* [ILockedSOV](ILockedSOV.md)
* [IMoCState](IMoCState.md)
* [ImplementationMockup](ImplementationMockup.md)
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
* [ITokenFlashLoanTest](ITokenFlashLoanTest.md)
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
* [LiquidityMiningMockup](LiquidityMiningMockup.md)
* [LiquidityMiningProxy](LiquidityMiningProxy.md)
* [LiquidityMiningStorage](LiquidityMiningStorage.md)
* [LiquidityPoolV1ConverterMockup](LiquidityPoolV1ConverterMockup.md)
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
* [LoanTokenLogicLMMockup](LoanTokenLogicLMMockup.md)
* [LoanTokenLogicLMV1Mockup](LoanTokenLogicLMV1Mockup.md)
* [LoanTokenLogicLMV2Mockup](LoanTokenLogicLMV2Mockup.md)
* [LoanTokenLogicProxy](LoanTokenLogicProxy.md)
* [LoanTokenLogicStandard](LoanTokenLogicStandard.md)
* [LoanTokenLogicStorage](LoanTokenLogicStorage.md)
* [LoanTokenLogicTest](LoanTokenLogicTest.md)
* [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)
* [LoanTokenSettingsLowerAdmin](LoanTokenSettingsLowerAdmin.md)
* [LockedSOV](LockedSOV.md)
* [LockedSOVFailedMockup](LockedSOVFailedMockup.md)
* [LockedSOVMockup](LockedSOVMockup.md)
* [Medianizer](Medianizer.md)
* [MockAffiliates](MockAffiliates.md)
* [MockLoanTokenLogic](MockLoanTokenLogic.md)
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
* [PriceFeedRSKOracleMockup](PriceFeedRSKOracleMockup.md)
* [PriceFeeds](PriceFeeds.md)
* [PriceFeedsLocal](PriceFeedsLocal.md)
* [PriceFeedsMoC](PriceFeedsMoC.md)
* [PriceFeedsMoCMockup](PriceFeedsMoCMockup.md)
* [PriceFeedV1PoolOracle](PriceFeedV1PoolOracle.md)
* [ProtocolAffiliatesInterface](ProtocolAffiliatesInterface.md)
* [ProtocolLike](ProtocolLike.md)
* [ProtocolSettings](ProtocolSettings.md)
* [ProtocolSettingsEvents](ProtocolSettingsEvents.md)
* [ProtocolSettingsLike](ProtocolSettingsLike.md)
* [ProtocolSettingsMockup](ProtocolSettingsMockup.md)
* [ProtocolSwapExternalInterface](ProtocolSwapExternalInterface.md)
* [ProtocolTokenUser](ProtocolTokenUser.md)
* [Proxy](Proxy.md)
* [ProxyMockup](ProxyMockup.md)
* [RBTCWrapperProxyMockup](RBTCWrapperProxyMockup.md)
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
* [StakingMock](StakingMock.md)
* [StakingMockup](StakingMockup.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsMockUp](StakingRewardsMockUp.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingStorage](StakingStorage.md)
* [State](State.md)
* [StorageMockup](StorageMockup.md)
* [SVR](SVR.md)
* [SwapsEvents](SwapsEvents.md)
* [SwapsExternal](SwapsExternal.md)
* [SwapsImplLocal](SwapsImplLocal.md)
* [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md)
* [SwapsUser](SwapsUser.md)
* [TeamVesting](TeamVesting.md)
* [TestCoverage](TestCoverage.md)
* [TestLibraries](TestLibraries.md)
* [TestSovrynSwap](TestSovrynSwap.md)
* [TestToken](TestToken.md)
* [TestWrbtc](TestWrbtc.md)
* [Timelock](Timelock.md)
* [TimelockHarness](TimelockHarness.md)
* [TimelockInterface](TimelockInterface.md)
* [TimelockTest](TimelockTest.md)
* [TokenSender](TokenSender.md)
* [UpgradableProxy](UpgradableProxy.md)
* [USDTPriceFeed](USDTPriceFeed.md)
* [VaultController](VaultController.md)
* [Vesting](Vesting.md)
* [VestingCreator](VestingCreator.md)
* [VestingFactory](VestingFactory.md)
* [VestingLogic](VestingLogic.md)
* [VestingLogicMockup](VestingLogicMockup.md)
* [VestingRegistry](VestingRegistry.md)
* [VestingRegistry2](VestingRegistry2.md)
* [VestingRegistry3](VestingRegistry3.md)
* [VestingRegistryLogic](VestingRegistryLogic.md)
* [VestingRegistryLogicMockup](VestingRegistryLogicMockup.md)
* [VestingRegistryProxy](VestingRegistryProxy.md)
* [VestingRegistryStorage](VestingRegistryStorage.md)
* [VestingStorage](VestingStorage.md)
* [WeightedStaking](WeightedStaking.md)
* [WRBTC](WRBTC.md)
