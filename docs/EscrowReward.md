# A reward distribution contract for Sovryn Ethereum Pool Escrow Contract. (EscrowReward.sol)

View Source: [contracts/escrow/EscrowReward.sol](../contracts/escrow/EscrowReward.sol)

**↗ Extends: [Escrow](Escrow.md)**

**EscrowReward**

Multisig can use this contract for depositing of Reward tokens based on the total token deposit.

## Contract Members
**Constants & Variables**

```js
uint256 public totalRewardDeposit;
contract ILockedSOV public lockedSOV;

```

**Events**

```js
event LockedSOVUpdated(address indexed _initiator, address indexed _lockedSOV);
event RewardDepositByMultisig(address indexed _initiator, uint256  _amount);
event RewardTokenWithdraw(address indexed _initiator, uint256  _amount);
```

## Functions

- [constructor(address _lockedSOV, address _SOV, address _multisig, uint256 _releaseTime, uint256 _depositLimit)](#constructor)
- [updateLockedSOV(address _lockedSOV)](#updatelockedsov)
- [depositRewardByMultisig(uint256 _amount)](#depositrewardbymultisig)
- [withdrawTokensAndReward()](#withdrawtokensandreward)
- [getReward(address _addr)](#getreward)

---    

> ### constructor

Setup the required parameters.

```solidity
function (address _lockedSOV, address _SOV, address _multisig, uint256 _releaseTime, uint256 _depositLimit) public nonpayable Escrow 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _lockedSOV | address | The Locked SOV Contract address. | 
| _SOV | address | The SOV token address. | 
| _multisig | address | The owner of the tokens & contract. | 
| _releaseTime | uint256 | The token release time, zero if undecided. | 
| _depositLimit | uint256 | The amount of tokens we will be accepting. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor(
        address _lockedSOV,
        address _SOV,
        address _multisig,
        uint256 _releaseTime,
        uint256 _depositLimit
    ) public Escrow(_SOV, _multisig, _releaseTime, _depositLimit) {
        if (_lockedSOV != address(0)) {
            lockedSOV = ILockedSOV(_lockedSOV);
        }
    }
```
</details>

---    

> ### updateLockedSOV

Set the Locked SOV Contract Address if not already done.

```solidity
function updateLockedSOV(address _lockedSOV) external nonpayable onlyMultisig 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _lockedSOV | address | The Locked SOV Contract address. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function updateLockedSOV(address _lockedSOV) external onlyMultisig {
        require(_lockedSOV != address(0), "Invalid Reward Token Address.");

        lockedSOV = ILockedSOV(_lockedSOV);

        emit LockedSOVUpdated(msg.sender, _lockedSOV);
    }
```
</details>

---    

> ### depositRewardByMultisig

Deposit tokens to this contract by the Multisig.

```solidity
function depositRewardByMultisig(uint256 _amount) external nonpayable onlyMultisig 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _amount | uint256 | the amount of tokens deposited. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function depositRewardByMultisig(uint256 _amount) external onlyMultisig {
        require(
            status != Status.Withdraw,
            "Reward Token deposit is only allowed before User Withdraw starts."
        );
        require(_amount > 0, "Amount needs to be bigger than zero.");

        bool txStatus = SOV.transferFrom(msg.sender, address(this), _amount);
        require(txStatus, "Token transfer was not successful.");

        totalRewardDeposit = totalRewardDeposit.add(_amount);
        txStatus = SOV.approve(address(lockedSOV), totalRewardDeposit);
        require(txStatus, "Token Approval was not successful.");

        emit RewardDepositByMultisig(msg.sender, _amount);
    }
```
</details>

---    

> ### withdrawTokensAndReward

Withdraws token and reward from the contract by User. Reward is gone to lockedSOV contract for future vesting.

```solidity
function withdrawTokensAndReward() external nonpayable checkRelease checkStatus 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawTokensAndReward() external checkRelease checkStatus(Status.Withdraw) {
        // Reward calculation have to be done initially as the User Balance is zeroed out .
        uint256 reward = userBalances[msg.sender].mul(totalRewardDeposit).div(totalDeposit);
        withdrawTokens();

        lockedSOV.depositSOV(msg.sender, reward);

        emit RewardTokenWithdraw(msg.sender, reward);
    }
```
</details>

---    

> ### getReward

Function to read the reward a particular user can get.

```solidity
function getReward(address _addr) external view
returns(reward uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _addr | address | The address of the user whose reward is to be read. | 

**Returns**

reward The reward received by the user.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getReward(address _addr) external view returns (uint256 reward) {
        if (userBalances[_addr].mul(totalRewardDeposit) == 0) {
            return 0;
        }
        return userBalances[_addr].mul(totalRewardDeposit).div(totalDeposit);
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
