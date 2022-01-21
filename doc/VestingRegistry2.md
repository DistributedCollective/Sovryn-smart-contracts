# VestingRegistry 2 contract. (VestingRegistry2.sol)

View Source: [contracts/governance/Vesting/VestingRegistry2.sol](../contracts/governance/Vesting/VestingRegistry2.sol)

**↗ Extends: [Ownable](Ownable.md)**

**VestingRegistry2**

One time contract needed to distribute tokens to origin sales investors.

**Enums**

### VestingType

```js
enum VestingType {
 TeamVesting,
 Vesting
}
```

## Contract Members

**Constants & Variables**

```js
uint256 public constant FOUR_WEEKS;
uint256 public constant CSOV_VESTING_CLIFF;
uint256 public constant CSOV_VESTING_DURATION;
contract IVestingFactory public vestingFactory;
address public SOV;
address[] public CSOVtokens;
uint256 public priceSats;
address public staking;
address public feeSharingProxy;
address public vestingOwner;
mapping(address => mapping(uint256 => address)) public vestingContracts;
mapping(address => bool) public processedList;
mapping(address => bool) public blacklist;
mapping(address => uint256) public lockedAmount;
mapping(address => bool) public admins;

```

**Events**

```js
event CSOVTokensExchanged(address indexed caller, uint256  amount);
event SOVTransferred(address indexed receiver, uint256  amount);
event VestingCreated(address indexed tokenOwner, address  vesting, uint256  cliff, uint256  duration, uint256  amount);
event TeamVestingCreated(address indexed tokenOwner, address  vesting, uint256  cliff, uint256  duration, uint256  amount);
event TokensStaked(address indexed vesting, uint256  amount);
event AdminAdded(address  admin);
event AdminRemoved(address  admin);
```

## Modifiers

- [onlyAuthorized](#onlyauthorized)
- [isNotProcessed](#isnotprocessed)
- [isNotBlacklisted](#isnotblacklisted)

### onlyAuthorized

Throws if called by any account other than the owner or admin.

```js
modifier onlyAuthorized() internal
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### isNotProcessed

```js
modifier isNotProcessed() internal
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### isNotBlacklisted

```js
modifier isNotBlacklisted() internal
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

## Functions

- [(address \_vestingFactory, address \_SOV, address[] \_CSOVtokens, uint256 \_priceSats, address \_staking, address \_feeSharingProxy, address \_vestingOwner)](#)
- [addAdmin(address \_admin)](#addadmin)
- [removeAdmin(address \_admin)](#removeadmin)
- [budget()](#budget)
- [deposit()](#deposit)
- [withdrawAll(address payable to)](#withdrawall)
- [setVestingFactory(address \_vestingFactory)](#setvestingfactory)
- [\_setVestingFactory(address \_vestingFactory)](#_setvestingfactory)
- [setCSOVtokens(address[] \_CSOVtokens)](#setcsovtokens)
- [\_setCSOVtokens(address[] \_CSOVtokens)](#_setcsovtokens)
- [setBlacklistFlag(address \_account, bool \_blacklisted)](#setblacklistflag)
- [setLockedAmount(address \_account, uint256 \_amount)](#setlockedamount)
- [transferSOV(address \_receiver, uint256 \_amount)](#transfersov)
- [\_createVestingForCSOV(uint256 \_amount)](#_createvestingforcsov)
- [\_validateCSOV(address \_CSOV)](#_validatecsov)
- [createVesting(address \_tokenOwner, uint256 \_amount, uint256 \_cliff, uint256 \_duration)](#createvesting)
- [createTeamVesting(address \_tokenOwner, uint256 \_amount, uint256 \_cliff, uint256 \_duration)](#createteamvesting)
- [stakeTokens(address \_vesting, uint256 \_amount)](#staketokens)
- [getVesting(address \_tokenOwner)](#getvesting)
- [getTeamVesting(address \_tokenOwner)](#getteamvesting)
- [\_getOrCreateVesting(address \_tokenOwner, uint256 \_cliff, uint256 \_duration)](#_getorcreatevesting)
- [\_getOrCreateTeamVesting(address \_tokenOwner, uint256 \_cliff, uint256 \_duration)](#_getorcreateteamvesting)

###

Contract deployment settings.

```js
function (address _vestingFactory, address _SOV, address[] _CSOVtokens, uint256 _priceSats, address _staking, address _feeSharingProxy, address _vestingOwner) public nonpayable
```

**Arguments**

| Name              | Type      | Description                                  |
| ----------------- | --------- | -------------------------------------------- |
| \_vestingFactory  | address   | The address of vesting factory contract.     |
| \_SOV             | address   | The SOV token address.                       |
| \_CSOVtokens      | address[] | The array of cSOV tokens.                    |
| \_priceSats       | uint256   | The price of cSOV tokens in satoshis.        |
| \_staking         | address   | The address of staking contract.             |
| \_feeSharingProxy | address   | The address of fee sharing proxy contract.   |
| \_vestingOwner    | address   | The address of an owner of vesting contract. |

### addAdmin

Add account to ACL.

```js
function addAdmin(address _admin) public nonpayable onlyOwner
```

**Arguments**

| Name    | Type    | Description                                        |
| ------- | ------- | -------------------------------------------------- |
| \_admin | address | The addresses of the account to grant permissions. |

### removeAdmin

Remove account from ACL.

```js
function removeAdmin(address _admin) public nonpayable onlyOwner
```

**Arguments**

| Name    | Type    | Description                                         |
| ------- | ------- | --------------------------------------------------- |
| \_admin | address | The addresses of the account to revoke permissions. |

### budget

Get contract balance.

```js
function budget() external view
returns(uint256)
```

**Returns**

The token balance of the contract.

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### deposit

Deposit function to receiving value (rBTC).

```js
function deposit() public payable
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### withdrawAll

Send all contract balance to an account.

```js
function withdrawAll(address payable to) public nonpayable onlyOwner
```

**Arguments**

| Name | Type            | Description                                 |
| ---- | --------------- | ------------------------------------------- |
| to   | address payable | The account address to send the balance to. |

### setVestingFactory

Sets vesting factory address. High level endpoint.

```js
function setVestingFactory(address _vestingFactory) public nonpayable onlyOwner
```

**Arguments**

| Name             | Type    | Description                              |
| ---------------- | ------- | ---------------------------------------- |
| \_vestingFactory | address | The address of vesting factory contract. |
| \*               |

### \_setVestingFactory

Sets vesting factory address. Low level core function.

```js
function _setVestingFactory(address _vestingFactory) internal nonpayable
```

**Arguments**

| Name             | Type    | Description                              |
| ---------------- | ------- | ---------------------------------------- |
| \_vestingFactory | address | The address of vesting factory contract. |

### setCSOVtokens

Sets cSOV tokens array. High level endpoint.

```js
function setCSOVtokens(address[] _CSOVtokens) public nonpayable onlyOwner
```

**Arguments**

| Name         | Type      | Description               |
| ------------ | --------- | ------------------------- |
| \_CSOVtokens | address[] | The array of cSOV tokens. |

### \_setCSOVtokens

Sets cSOV tokens array by looping through input. Low level function.

```js
function _setCSOVtokens(address[] _CSOVtokens) internal nonpayable
```

**Arguments**

| Name         | Type      | Description               |
| ------------ | --------- | ------------------------- |
| \_CSOVtokens | address[] | The array of cSOV tokens. |

### setBlacklistFlag

Set blacklist flag (true/false).

```js
function setBlacklistFlag(address _account, bool _blacklisted) public nonpayable onlyOwner
```

**Arguments**

| Name          | Type    | Description                                 |
| ------------- | ------- | ------------------------------------------- |
| \_account     | address | The address to be blacklisted.              |
| \_blacklisted | bool    | The flag to add/remove to/from a blacklist. |

### setLockedAmount

Set amount to be subtracted from user token balance.

```js
function setLockedAmount(address _account, uint256 _amount) public nonpayable onlyOwner
```

**Arguments**

| Name      | Type    | Description                     |
| --------- | ------- | ------------------------------- |
| \_account | address | The address with locked amount. |
| \_amount  | uint256 | The amount to be locked.        |

### transferSOV

Transfer SOV tokens to given address. \*

```js
function transferSOV(address _receiver, uint256 _amount) public nonpayable onlyOwner
```

**Arguments**

| Name       | Type    | Description                      |
| ---------- | ------- | -------------------------------- |
| \_receiver | address | The address of the SOV receiver. |
| \_amount   | uint256 | The amount to be transferred.    |

### \_createVestingForCSOV

cSOV tokens are moved and staked on Vesting contract.

```js
function _createVestingForCSOV(uint256 _amount) internal nonpayable
```

**Arguments**

| Name     | Type    | Description                        |
| -------- | ------- | ---------------------------------- |
| \_amount | uint256 | The amount of tokens to be vested. |

### \_validateCSOV

Check a token address is among the cSOV token addresses.

```js
function _validateCSOV(address _CSOV) internal view
```

**Arguments**

| Name   | Type    | Description             |
| ------ | ------- | ----------------------- |
| \_CSOV | address | The cSOV token address. |

### createVesting

Create Vesting contract.

```js
function createVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration) public nonpayable onlyAuthorized
```

**Arguments**

| Name         | Type    | Description                                         |
| ------------ | ------- | --------------------------------------------------- |
| \_tokenOwner | address | The owner of the tokens.                            |
| \_amount     | uint256 | The amount to be staked.                            |
| \_cliff      | uint256 | The time interval to the first withdraw in seconds. |
| \_duration   | uint256 | The total duration in seconds.                      |

### createTeamVesting

Create Team Vesting contract.

```js
function createTeamVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration) public nonpayable onlyAuthorized
```

**Arguments**

| Name         | Type    | Description                                         |
| ------------ | ------- | --------------------------------------------------- |
| \_tokenOwner | address | The owner of the tokens.                            |
| \_amount     | uint256 | The amount to be staked.                            |
| \_cliff      | uint256 | The time interval to the first withdraw in seconds. |
| \_duration   | uint256 | The total duration in seconds.                      |

### stakeTokens

Stake tokens according to the vesting schedule

```js
function stakeTokens(address _vesting, uint256 _amount) public nonpayable onlyAuthorized
```

**Arguments**

| Name      | Type    | Description                     |
| --------- | ------- | ------------------------------- |
| \_vesting | address | the address of Vesting contract |
| \_amount  | uint256 | the amount of tokens to stake   |

### getVesting

Query the vesting contract for an account.

```js
function getVesting(address _tokenOwner) public view
returns(address)
```

**Returns**

The vesting contract address for the given token owner.

**Arguments**

| Name         | Type    | Description              |
| ------------ | ------- | ------------------------ |
| \_tokenOwner | address | The owner of the tokens. |

### getTeamVesting

Query the team vesting contract for an account.

```js
function getTeamVesting(address _tokenOwner) public view
returns(address)
```

**Returns**

The team vesting contract address for the given token owner.

**Arguments**

| Name         | Type    | Description              |
| ------------ | ------- | ------------------------ |
| \_tokenOwner | address | The owner of the tokens. |

### \_getOrCreateVesting

If not exists, deploy a vesting contract through factory.

```js
function _getOrCreateVesting(address _tokenOwner, uint256 _cliff, uint256 _duration) internal nonpayable
returns(address)
```

**Returns**

The vesting contract address for the given token owner
whether it existed previously or not.

**Arguments**

| Name         | Type    | Description                                         |
| ------------ | ------- | --------------------------------------------------- |
| \_tokenOwner | address | The owner of the tokens.                            |
| \_cliff      | uint256 | The time interval to the first withdraw in seconds. |
| \_duration   | uint256 | The total duration in seconds.                      |

### \_getOrCreateTeamVesting

If not exists, deploy a team vesting contract through factory.

```js
function _getOrCreateTeamVesting(address _tokenOwner, uint256 _cliff, uint256 _duration) internal nonpayable
returns(address)
```

**Returns**

The team vesting contract address for the given token owner
whether it existed previously or not.

**Arguments**

| Name         | Type    | Description                                         |
| ------------ | ------- | --------------------------------------------------- |
| \_tokenOwner | address | The owner of the tokens.                            |
| \_cliff      | uint256 | The time interval to the first withdraw in seconds. |
| \_duration   | uint256 | The total duration in seconds.                      |

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
