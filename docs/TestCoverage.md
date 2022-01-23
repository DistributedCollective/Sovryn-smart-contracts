# TestCoverage.sol

View Source: [contracts/testhelpers/TestCoverage.sol](../contracts/testhelpers/TestCoverage.sol)

**↗ Extends: [Pausable](Pausable.md), [SafeMath96](SafeMath96.md), [VaultController](VaultController.md), [AdvancedToken](AdvancedToken.md), [LoanTokenLogicStorage](LoanTokenLogicStorage.md)**

**TestCoverage**

## Contract Members
**Constants & Variables**

```js
struct EnumerableBytes32Set.Bytes32Set internal aSet;

```

## Functions

- [dummyPausableFunction()](#dummypausablefunction)
- [togglePause(string funcId, bool isPaused)](#togglepause)
- [testSafeMath96_safe32(uint256 n)](#testsafemath96_safe32)
- [testSafeMath96_safe64(uint256 n)](#testsafemath96_safe64)
- [testSafeMath96_safe96(uint256 n)](#testsafemath96_safe96)
- [testSafeMath96_sub96(uint96 a, uint96 b)](#testsafemath96_sub96)
- [testSafeMath96_mul96(uint96 a, uint96 b)](#testsafemath96_mul96)
- [testSafeMath96_div96(uint96 a, uint96 b)](#testsafemath96_div96)
- [testEnum_AddRemove(bytes32 a, bytes32 b)](#testenum_addremove)
- [testEnum_AddAddress(address a, address b)](#testenum_addaddress)
- [testEnum_AddAddressesAndEnumerate(address a, address b, uint256 start, uint256 count)](#testenum_addaddressesandenumerate)
- [testVaultController_vaultApprove(address token, address to, uint256 value)](#testvaultcontroller_vaultapprove)
- [testMint(address _to, uint256 _tokenAmount, uint256 _assetAmount, uint256 _price)](#testmint)
- [testStringToBytes32(string source)](#teststringtobytes32)

---    

> ### dummyPausableFunction

Pausable is currently an unused contract that still is operative
   because margin trade flashloan functionality has been commented out.
   In case it were restored, contract would become used again, so for a
   complete test coverage it is required to test it.

```solidity
function dummyPausableFunction() external nonpayable pausable 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function dummyPausableFunction() external pausable(msg.sig) {
		/// @dev do nothing, just to check if modifier is working
	}
```
</details>

---    

> ### togglePause

This function should be located on Pausable contract in the case
   it has to be used again by flashloan restoration.

```solidity
function togglePause(string funcId, bool isPaused) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| funcId | string |  | 
| isPaused | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function togglePause(
		string memory funcId, // example: "mint(uint256,uint256)"
		bool isPaused
	) public {
		/// keccak256("Pausable_FunctionPause")
		bytes32 slot =
			keccak256(
				abi.encodePacked(
					bytes4(keccak256(abi.encodePacked(funcId))),
					uint256(0xa7143c84d793a15503da6f19bf9119a2dac94448ca45d77c8bf08f57b2e91047)
				)
			);

		// solhint-disable-next-line no-inline-assembly
		assembly {
			sstore(slot, isPaused)
		}
	}
```
</details>

---    

> ### testSafeMath96_safe32

Testing internal functions of governance/Staking/SafeMath96.sol

```solidity
function testSafeMath96_safe32(uint256 n) public pure
returns(uint32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| n | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function testSafeMath96_safe32(uint256 n) public pure returns (uint32) {
		// Public wrapper for SafeMath96 internal function
		return safe32(n, "overflow");
	}
```
</details>

---    

> ### testSafeMath96_safe64

```solidity
function testSafeMath96_safe64(uint256 n) public pure
returns(uint64)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| n | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function testSafeMath96_safe64(uint256 n) public pure returns (uint64) {
		// Public wrapper for SafeMath96 internal function
		return safe64(n, "overflow");
	}
```
</details>

---    

> ### testSafeMath96_safe96

```solidity
function testSafeMath96_safe96(uint256 n) public pure
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| n | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function testSafeMath96_safe96(uint256 n) public pure returns (uint96) {
		// Public wrapper for SafeMath96 internal function
		return safe96(n, "overflow");
	}
```
</details>

---    

> ### testSafeMath96_sub96

```solidity
function testSafeMath96_sub96(uint96 a, uint96 b) public pure
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| a | uint96 |  | 
| b | uint96 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function testSafeMath96_sub96(uint96 a, uint96 b) public pure returns (uint96) {
		// Public wrapper for SafeMath96 internal function
		return sub96(a, b, "underflow");
	}
```
</details>

---    

> ### testSafeMath96_mul96

```solidity
function testSafeMath96_mul96(uint96 a, uint96 b) public pure
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| a | uint96 |  | 
| b | uint96 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function testSafeMath96_mul96(uint96 a, uint96 b) public pure returns (uint96) {
		// Public wrapper for SafeMath96 internal function
		return mul96(a, b, "overflow");
	}
```
</details>

---    

> ### testSafeMath96_div96

```solidity
function testSafeMath96_div96(uint96 a, uint96 b) public pure
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| a | uint96 |  | 
| b | uint96 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function testSafeMath96_div96(uint96 a, uint96 b) public pure returns (uint96) {
		// Public wrapper for SafeMath96 internal function
		return div96(a, b, "division by 0");
	}
```
</details>

---    

> ### testEnum_AddRemove

```solidity
function testEnum_AddRemove(bytes32 a, bytes32 b) public nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| a | bytes32 |  | 
| b | bytes32 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function testEnum_AddRemove(bytes32 a, bytes32 b) public returns (bool) {
		aSet.addBytes32(a);
		return aSet.removeBytes32(b);
	}
```
</details>

---    

> ### testEnum_AddAddress

```solidity
function testEnum_AddAddress(address a, address b) public nonpayable
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| a | address |  | 
| b | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function testEnum_AddAddress(address a, address b) public returns (bool) {
		aSet.addAddress(a);
		return aSet.containsAddress(b);
	}
```
</details>

---    

> ### testEnum_AddAddressesAndEnumerate

```solidity
function testEnum_AddAddressesAndEnumerate(address a, address b, uint256 start, uint256 count) public nonpayable
returns(bytes32[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| a | address |  | 
| b | address |  | 
| start | uint256 |  | 
| count | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function testEnum_AddAddressesAndEnumerate(
		address a,
		address b,
		uint256 start,
		uint256 count
	) public returns (bytes32[] memory) {
		aSet.addAddress(a);
		aSet.addAddress(b);
		return aSet.enumerate(start, count);
	}
```
</details>

---    

> ### testVaultController_vaultApprove

Wrapper to test internal function never called along current codebase

```solidity
function testVaultController_vaultApprove(address token, address to, uint256 value) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address |  | 
| to | address |  | 
| value | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function testVaultController_vaultApprove(
		address token,
		address to,
		uint256 value
	) public {
		vaultApprove(token, to, value);
	}
```
</details>

---    

> ### testMint

mint wrapper w/o previous checks

```solidity
function testMint(address _to, uint256 _tokenAmount, uint256 _assetAmount, uint256 _price) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _to | address |  | 
| _tokenAmount | uint256 |  | 
| _assetAmount | uint256 |  | 
| _price | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function testMint(
		address _to,
		uint256 _tokenAmount,
		uint256 _assetAmount,
		uint256 _price
	) public {
		_mint(_to, _tokenAmount, _assetAmount, _price);
	}
```
</details>

---    

> ### testStringToBytes32

wrapper for a function unreachable to tests

```solidity
function testStringToBytes32(string source) public pure
returns(result bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| source | string |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function testStringToBytes32(string memory source) public pure returns (bytes32 result) {
		return stringToBytes32(source);
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
