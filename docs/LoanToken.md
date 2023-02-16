# Loan Token contract. (LoanToken.sol)

View Source: [contracts/connectors/loantoken/LoanToken.sol](../contracts/connectors/loantoken/LoanToken.sol)

**↗ Extends: [AdvancedTokenStorage](AdvancedTokenStorage.md)**

**LoanToken**

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
 * A loan token (iToken) is created as a proxy to an upgradable token contract.
 * Examples of loan tokens on Sovryn are iRBTC, iDOC, iUSDT, iBPro,
iSOV (near future).
 * Lenders receive iTokens that collect interest from the lending pool
which they can redeem by withdrawing them. The i in iToken stands for interest.
 * Do not confuse iTokens with underlying tokens. iDOC is an iToken (loan token)
whilest DOC is the underlying token (currency).
 *

## Contract Members
**Constants & Variables**

```js
//public members
address public sovrynContractAddress;
address public wrbtcTokenAddress;
address public admin;

//internal members
address internal target_;

```

## Functions

- [constructor(address _newOwner, address _newTarget, address _sovrynContractAddress, address _wrbtcTokenAddress)](#constructor)
- [constructor()](#constructor)
- [setTarget(address _newTarget)](#settarget)
- [_setTarget(address _newTarget)](#_settarget)
- [_setSovrynContractAddress(address _sovrynContractAddress)](#_setsovryncontractaddress)
- [_setWrbtcTokenAddress(address _wrbtcTokenAddress)](#_setwrbtctokenaddress)
- [initialize(address _loanTokenAddress, string _name, string _symbol)](#initialize)

---    

> ### constructor

Deploy loan token proxy.
  Sets ERC20 parameters of the token.
     *

```solidity
function (address _newOwner, address _newTarget, address _sovrynContractAddress, address _wrbtcTokenAddress) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newOwner | address | The address of the new owner. | 
| _newTarget | address | The address of the new target contract instance. | 
| _sovrynContractAddress | address | The address of the new sovrynContract instance. | 
| _wrbtcTokenAddress | address | The address of the new wrBTC instance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor(
        address _newOwner,
        address _newTarget,
        address _sovrynContractAddress,
        address _wrbtcTokenAddress
    ) public {
        transferOwnership(_newOwner);
        _setTarget(_newTarget);
        _setSovrynContractAddress(_sovrynContractAddress);
        _setWrbtcTokenAddress(_wrbtcTokenAddress);
    }
```
</details>

---    

> ### constructor

Fallback function performs a delegate call
to the actual implementation address is pointing this proxy.
Returns whatever the implementation call returns.

```solidity
function () external payable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function() external payable {
        if (gasleft() <= 2300) {
            return;
        }

        address target = target_;
        bytes memory data = msg.data;
        assembly {
            let result := delegatecall(gas, target, add(data, 0x20), mload(data), 0, 0)
            let size := returndatasize
            let ptr := mload(0x40)
            returndatacopy(ptr, 0, size)
            switch result
                case 0 {
                    revert(ptr, size)
                }
                default {
                    return(ptr, size)
                }
        }
    }
```
</details>

---    

> ### setTarget

Public owner setter for target address.

```solidity
function setTarget(address _newTarget) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newTarget | address | The address of the new target contract instance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setTarget(address _newTarget) public onlyOwner {
        _setTarget(_newTarget);
    }
```
</details>

---    

> ### _setTarget

Internal setter for target address.

```solidity
function _setTarget(address _newTarget) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newTarget | address | The address of the new target contract instance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _setTarget(address _newTarget) internal {
        require(Address.isContract(_newTarget), "target not a contract");
        target_ = _newTarget;
    }
```
</details>

---    

> ### _setSovrynContractAddress

Internal setter for sovrynContract address.

```solidity
function _setSovrynContractAddress(address _sovrynContractAddress) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sovrynContractAddress | address | The address of the new sovrynContract instance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _setSovrynContractAddress(address _sovrynContractAddress) internal {
        require(Address.isContract(_sovrynContractAddress), "sovryn not a contract");
        sovrynContractAddress = _sovrynContractAddress;
    }
```
</details>

---    

> ### _setWrbtcTokenAddress

Internal setter for wrBTC address.

```solidity
function _setWrbtcTokenAddress(address _wrbtcTokenAddress) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _wrbtcTokenAddress | address | The address of the new wrBTC instance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _setWrbtcTokenAddress(address _wrbtcTokenAddress) internal {
        require(Address.isContract(_wrbtcTokenAddress), "wrbtc not a contract");
        wrbtcTokenAddress = _wrbtcTokenAddress;
    }
```
</details>

---    

> ### initialize

Public owner cloner for pointed loan token.
  Sets ERC20 parameters of the token.
     *

```solidity
function initialize(address _loanTokenAddress, string _name, string _symbol) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _loanTokenAddress | address | The address of the pointed loan token instance. | 
| _name | string | The ERC20 token name. | 
| _symbol | string | The ERC20 token symbol. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function initialize(
        address _loanTokenAddress,
        string memory _name,
        string memory _symbol
    ) public onlyOwner {
        loanTokenAddress = _loanTokenAddress;

        name = _name;
        symbol = _symbol;
        decimals = IERC20(loanTokenAddress).decimals();

        initialPrice = 10**18; /// starting price of 1
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
