# Base Proxy contract. (Proxy.sol)

View Source: [contracts/proxy/Proxy.sol](../contracts/proxy/Proxy.sol)

**↘ Derived Contracts: [TeamVesting](TeamVesting.md), [UpgradableProxy](UpgradableProxy.md)**

**Proxy**

The proxy performs delegated calls to the contract implementation
it is pointing to. This way upgradable contracts are possible on blockchain.
 * Delegating proxy contracts are widely used for both upgradeability and gas
savings. These proxies rely on a logic contract (also known as implementation
contract or master copy) that is called using delegatecall. This allows
proxies to keep a persistent state (storage and balance) while the code is
delegated to the logic contract.
 * Proxy contract is meant to be inherited and its internal functions
_setImplementation and _setProxyOwner to be called when upgrades become
neccessary.
 * The loan token (iToken) contract as well as the protocol contract act as
proxies, delegating all calls to underlying contracts. Therefore, if you
want to interact with them using web3, you need to use the ABIs from the
contracts containing the actual logic or the interface contract.
  ABI for LoanToken contracts: LoanTokenLogicStandard
  ABI for Protocol contract: ISovryn
 *

## Contract Members
**Constants & Variables**

```js
bytes32 private constant KEY_IMPLEMENTATION;
bytes32 private constant KEY_OWNER;

```

**Events**

```js
event OwnershipTransferred(address indexed _oldOwner, address indexed _newOwner);
event ImplementationChanged(address indexed _oldImplementation, address indexed _newImplementation);
```

## Modifiers

- [onlyProxyOwner](#onlyproxyowner)

### onlyProxyOwner

Throw error if called not by an owner.

```js
modifier onlyProxyOwner() internal
```

## Functions

- [constructor()](#constructor)
- [_setImplementation(address _implementation)](#_setimplementation)
- [getImplementation()](#getimplementation)
- [_setProxyOwner(address _owner)](#_setproxyowner)
- [getProxyOwner()](#getproxyowner)
- [constructor()](#constructor)

---    

> ### constructor

Set sender as an owner.

```solidity
function () public nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor() public {
        _setProxyOwner(msg.sender);
    }
```
</details>

---    

> ### _setImplementation

Set address of the implementation.

```solidity
function _setImplementation(address _implementation) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _implementation | address | Address of the implementation. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _setImplementation(address _implementation) internal {
        require(_implementation != address(0), "Proxy::setImplementation: invalid address");
        emit ImplementationChanged(getImplementation(), _implementation);

        bytes32 key = KEY_IMPLEMENTATION;
        assembly {
            sstore(key, _implementation)
        }
    }
```
</details>

---    

> ### getImplementation

Return address of the implementation.

```solidity
function getImplementation() public view
returns(_implementation address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getImplementation() public view returns (address _implementation) {
        bytes32 key = KEY_IMPLEMENTATION;
        assembly {
            _implementation := sload(key)
        }
    }
```
</details>

---    

> ### _setProxyOwner

Set address of the owner.

```solidity
function _setProxyOwner(address _owner) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _owner | address | Address of the owner. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _setProxyOwner(address _owner) internal {
        require(_owner != address(0), "Proxy::setProxyOwner: invalid address");
        emit OwnershipTransferred(getProxyOwner(), _owner);

        bytes32 key = KEY_OWNER;
        assembly {
            sstore(key, _owner)
        }
    }
```
</details>

---    

> ### getProxyOwner

Return address of the owner.

```solidity
function getProxyOwner() public view
returns(_owner address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getProxyOwner() public view returns (address _owner) {
        bytes32 key = KEY_OWNER;
        assembly {
            _owner := sload(key)
        }
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
        address implementation = getImplementation();
        require(implementation != address(0), "Proxy::(): implementation not found");

        assembly {
            let pointer := mload(0x40)
            calldatacopy(pointer, 0, calldatasize)
            let result := delegatecall(gas, implementation, pointer, calldatasize, 0, 0)
            let size := returndatasize
            returndatacopy(pointer, 0, size)

            switch result
                case 0 {
                    revert(pointer, size)
                }
                default {
                    return(pointer, size)
                }
        }
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
