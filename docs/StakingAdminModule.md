# Staking Admin Module. (StakingAdminModule.sol)

View Source: [contracts/governance/Staking/modules/StakingAdminModule.sol](../contracts/governance/Staking/modules/StakingAdminModule.sol)

**↗ Extends: [IFunctionsList](IFunctionsList.md), [StakingShared](StakingShared.md)**

## **StakingAdminModule** contract

Implements administrative functionality pause, freeze and setting addresses and parameters
related to staking

**Events**

```js
event AdminAdded(address  admin);
event AdminRemoved(address  admin);
event PauserAddedOrRemoved(address indexed pauser, bool indexed added);
event StakingPaused(bool indexed setPaused);
event StakingFrozen(bool indexed setFrozen);
```

## Functions

- [addAdmin(address _admin)](#addadmin)
- [removeAdmin(address _admin)](#removeadmin)
- [addPauser(address _pauser)](#addpauser)
- [removePauser(address _pauser)](#removepauser)
- [pauseUnpause(bool _pause)](#pauseunpause)
- [freezeUnfreeze(bool _freeze)](#freezeunfreeze)
- [setFeeSharing(address _feeSharing)](#setfeesharing)
- [setWeightScaling(uint96 _weightScaling)](#setweightscaling)
- [setNewStakingContract(address _newStakingContract)](#setnewstakingcontract)
- [migrateToNewStakingContract()](#migratetonewstakingcontract)
- [getFunctionsList()](#getfunctionslist)

---    

> ### addAdmin

Add account to Admins ACL.

```solidity
function addAdmin(address _admin) external nonpayable onlyOwner whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _admin | address | The addresses of the account to grant permissions. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addAdmin(address _admin) external onlyOwner whenNotFrozen {
        require(_admin != address(0), "cannot add the zero address as an admin");
        admins[_admin] = true;
        emit AdminAdded(_admin);
    }
```
</details>

---    

> ### removeAdmin

Remove account from Admins ACL.

```solidity
function removeAdmin(address _admin) external nonpayable onlyOwner whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _admin | address | The addresses of the account to revoke permissions. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeAdmin(address _admin) external onlyOwner whenNotFrozen {
        require(admins[_admin], "address is not an admin");
        admins[_admin] = false;
        emit AdminRemoved(_admin);
    }
```
</details>

---    

> ### addPauser

Add account to pausers ACL.

```solidity
function addPauser(address _pauser) external nonpayable onlyOwner whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _pauser | address | The address to grant pauser permissions. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addPauser(address _pauser) external onlyOwner whenNotFrozen {
        require(_pauser != address(0), "cannot add the zero address as a pauser");
        pausers[_pauser] = true;
        emit PauserAddedOrRemoved(_pauser, true);
    }
```
</details>

---    

> ### removePauser

Remove account from pausers ACL.

```solidity
function removePauser(address _pauser) external nonpayable onlyOwner whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _pauser | address | The address to grant pauser permissions. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removePauser(address _pauser) external onlyOwner whenNotFrozen {
        require(pausers[_pauser], "address is not a pauser");
        delete pausers[_pauser];
        emit PauserAddedOrRemoved(_pauser, false);
    }
```
</details>

---    

> ### pauseUnpause

Pause/unpause contract

```solidity
function pauseUnpause(bool _pause) public nonpayable onlyPauserOrOwner whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _pause | bool | true when pausing, false when unpausing | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function pauseUnpause(bool _pause) public onlyPauserOrOwner whenNotFrozen {
        paused = _pause;
        emit StakingPaused(_pause);
    }
```
</details>

---    

> ### freezeUnfreeze

Freeze contract - disable all functions

```solidity
function freezeUnfreeze(bool _freeze) external nonpayable onlyPauserOrOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _freeze | bool | true when freezing, false when unfreezing | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function freezeUnfreeze(bool _freeze) external onlyPauserOrOwner {
        require(_freeze != frozen, "Cannot freeze/unfreeze to the same state"); // WS25
        if (_freeze) pauseUnpause(true);
        frozen = _freeze;
        emit StakingFrozen(_freeze);
    }
```
</details>

---    

> ### setFeeSharing

Allow the owner to set a fee sharing proxy contract.
We need it for unstaking with slashing.

```solidity
function setFeeSharing(address _feeSharing) external nonpayable onlyOwner whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _feeSharing | address | The address of FeeSharingCollectorProxy contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setFeeSharing(address _feeSharing) external onlyOwner whenNotFrozen {
        require(_feeSharing != address(0), "FeeSharing address shouldn't be 0"); // S17
        feeSharing = IFeeSharingCollector(_feeSharing);
    }
```
</details>

---    

> ### setWeightScaling

Allow the owner to set weight scaling.
We need it for unstaking with slashing.

```solidity
function setWeightScaling(uint96 _weightScaling) external nonpayable onlyOwner whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _weightScaling | uint96 | The weight scaling. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setWeightScaling(uint96 _weightScaling) external onlyOwner whenNotFrozen {
        require(
            MIN_WEIGHT_SCALING <= _weightScaling && _weightScaling <= MAX_WEIGHT_SCALING,
            "scaling doesn't belong to range [1, 9]" // S18
        );
        weightScaling = _weightScaling;
    }
```
</details>

---    

> ### setNewStakingContract

Allow the owner to set a new staking contract.
As a consequence it allows the stakers to migrate their positions
to the new contract.

```solidity
function setNewStakingContract(address _newStakingContract) external nonpayable onlyOwner whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newStakingContract | address | The address of the new staking contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setNewStakingContract(address _newStakingContract) external onlyOwner whenNotFrozen {
        require(_newStakingContract != address(0), "can't reset the new staking contract to 0"); // S16
        newStakingContract = _newStakingContract;
    }
```
</details>

---    

> ### migrateToNewStakingContract

Allow a staker to migrate his positions to the new staking contract.

```solidity
function migrateToNewStakingContract() external nonpayable whenNotFrozen 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function migrateToNewStakingContract() external whenNotFrozen {
        require(newStakingContract != address(0), "there is no new staking contract set"); // S19
        revert("not implemented");
        /// @dev implementation:
        /// @dev Iterate over all possible lock dates from now until now + MAX_DURATION.
        /// @dev Read the stake & delegate of the msg.sender
        /// @dev If stake > 0, stake it at the new contract until the lock date with the current delegate.
    }
```
</details>

---    

> ### getFunctionsList

undefined

```solidity
function getFunctionsList() external pure
returns(bytes4[])
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getFunctionsList() external pure returns (bytes4[] memory) {
        bytes4[] memory functionsList = new bytes4[](13);
        functionsList[0] = this.addAdmin.selector;
        functionsList[1] = this.removeAdmin.selector;
        functionsList[2] = this.addPauser.selector;
        functionsList[3] = this.removePauser.selector;
        functionsList[4] = this.pauseUnpause.selector;
        functionsList[5] = this.freezeUnfreeze.selector;
        functionsList[6] = this.setFeeSharing.selector;
        functionsList[7] = this.setWeightScaling.selector;
        functionsList[8] = this.setNewStakingContract.selector;
        functionsList[9] = this.owner.selector;
        functionsList[10] = this.isOwner.selector;
        functionsList[11] = this.transferOwnership.selector;
        functionsList[12] = this.migrateToNewStakingContract.selector;
        return functionsList;
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
* [CheckpointsShared](CheckpointsShared.md)
* [Constants](Constants.md)
* [Context](Context.md)
* [DevelopmentFund](DevelopmentFund.md)
* [DummyContract](DummyContract.md)
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
* [FeeSharingCollector](FeeSharingCollector.md)
* [FeeSharingCollectorProxy](FeeSharingCollectorProxy.md)
* [FeeSharingCollectorStorage](FeeSharingCollectorStorage.md)
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
* [IERC1820Registry](IERC1820Registry.md)
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IERC777](IERC777.md)
* [IERC777Recipient](IERC777Recipient.md)
* [IERC777Sender](IERC777Sender.md)
* [IFeeSharingCollector](IFeeSharingCollector.md)
* [IFourYearVesting](IFourYearVesting.md)
* [IFourYearVestingFactory](IFourYearVestingFactory.md)
* [IFunctionsList](IFunctionsList.md)
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
* [IModulesProxyRegistry](IModulesProxyRegistry.md)
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
* [LoanClosingsWithoutInvariantCheck](LoanClosingsWithoutInvariantCheck.md)
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
* [MarginTradeStructHelpers](MarginTradeStructHelpers.md)
* [Medianizer](Medianizer.md)
* [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)
* [ModulesCommonEvents](ModulesCommonEvents.md)
* [ModulesProxy](ModulesProxy.md)
* [ModulesProxyRegistry](ModulesProxyRegistry.md)
* [MultiSigKeyHolders](MultiSigKeyHolders.md)
* [MultiSigWallet](MultiSigWallet.md)
* [Mutex](Mutex.md)
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
* [ProxyOwnable](ProxyOwnable.md)
* [ReentrancyGuard](ReentrancyGuard.md)
* [RewardHelper](RewardHelper.md)
* [RSKAddrValidator](RSKAddrValidator.md)
* [SafeERC20](SafeERC20.md)
* [SafeMath](SafeMath.md)
* [SafeMath96](SafeMath96.md)
* [setGet](setGet.md)
* [SharedReentrancyGuard](SharedReentrancyGuard.md)
* [SignedSafeMath](SignedSafeMath.md)
* [SOV](SOV.md)
* [sovrynProtocol](sovrynProtocol.md)
* [StakingAdminModule](StakingAdminModule.md)
* [StakingGovernanceModule](StakingGovernanceModule.md)
* [StakingInterface](StakingInterface.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingShared](StakingShared.md)
* [StakingStakeModule](StakingStakeModule.md)
* [StakingStorageModule](StakingStorageModule.md)
* [StakingStorageShared](StakingStorageShared.md)
* [StakingVestingModule](StakingVestingModule.md)
* [StakingWithdrawModule](StakingWithdrawModule.md)
* [State](State.md)
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
* [Utils](Utils.md)
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
* [WeightedStakingModule](WeightedStakingModule.md)
* [WRBTC](WRBTC.md)
