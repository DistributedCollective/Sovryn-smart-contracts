# IERC777.sol

View Source: [contracts/interfaces/IERC777.sol](../contracts/interfaces/IERC777.sol)

**IERC777**

Interface of the ERC777Token standard as defined in the EIP.
 * This contract uses the
https://eips.ethereum.org/EIPS/eip-1820[ERC1820 registry standard] to let
token holders and recipients react to token movements by using setting implementers
for the associated interfaces in said registry. See {IERC1820Registry} and
{ERC1820Implementer}.

**Events**

```js
event Sent(address indexed operator, address indexed from, address indexed to, uint256  amount, bytes  data, bytes  operatorData);
event Minted(address indexed operator, address indexed to, uint256  amount, bytes  data, bytes  operatorData);
event Burned(address indexed operator, address indexed from, uint256  amount, bytes  data, bytes  operatorData);
event AuthorizedOperator(address indexed operator, address indexed tokenHolder);
event RevokedOperator(address indexed operator, address indexed tokenHolder);
```

## Functions

- [name()](#name)
- [symbol()](#symbol)
- [granularity()](#granularity)
- [totalSupply()](#totalsupply)
- [balanceOf(address owner)](#balanceof)
- [send(address recipient, uint256 amount, bytes data)](#send)
- [burn(uint256 amount, bytes data)](#burn)
- [isOperatorFor(address operator, address tokenHolder)](#isoperatorfor)
- [authorizeOperator(address operator)](#authorizeoperator)
- [revokeOperator(address operator)](#revokeoperator)
- [defaultOperators()](#defaultoperators)
- [operatorSend(address sender, address recipient, uint256 amount, bytes data, bytes operatorData)](#operatorsend)
- [operatorBurn(address account, uint256 amount, bytes data, bytes operatorData)](#operatorburn)

---    

> ### name

Returns the name of the token.

```solidity
function name() external view
returns(string)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function name() external view returns (string memory);
```
</details>

---    

> ### symbol

Returns the symbol of the token, usually a shorter version of the
name.

```solidity
function symbol() external view
returns(string)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function symbol() external view returns (string memory);
```
</details>

---    

> ### granularity

Returns the smallest part of the token that is not divisible. This
means all token operations (creation, movement and destruction) must have
amounts that are a multiple of this number.
     * For most token contracts, this value will equal 1.

```solidity
function granularity() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function granularity() external view returns (uint256);
```
</details>

---    

> ### totalSupply

Returns the amount of tokens in existence.

```solidity
function totalSupply() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function totalSupply() external view returns (uint256);
```
</details>

---    

> ### balanceOf

Returns the amount of tokens owned by an account (`owner`).

```solidity
function balanceOf(address owner) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| owner | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function balanceOf(address owner) external view returns (uint256);
```
</details>

---    

> ### send

Moves `amount` tokens from the caller's account to `recipient`.
     * If send or receive hooks are registered for the caller and `recipient`,
the corresponding functions will be called with `data` and empty
`operatorData`. See {IERC777Sender} and {IERC777Recipient}.
     * Emits a {Sent} event.
     * Requirements
     * - the caller must have at least `amount` tokens.
- `recipient` cannot be the zero address.
- if `recipient` is a contract, it must implement the {IERC777Recipient}
interface.

```solidity
function send(address recipient, uint256 amount, bytes data) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| recipient | address |  | 
| amount | uint256 |  | 
| data | bytes |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function send(
        address recipient,
        uint256 amount,
        bytes calldata data
    ) external;
```
</details>

---    

> ### burn

Destroys `amount` tokens from the caller's account, reducing the
total supply.
     * If a send hook is registered for the caller, the corresponding function
will be called with `data` and empty `operatorData`. See {IERC777Sender}.
     * Emits a {Burned} event.
     * Requirements
     * - the caller must have at least `amount` tokens.

```solidity
function burn(uint256 amount, bytes data) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint256 |  | 
| data | bytes |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function burn(uint256 amount, bytes calldata data) external;
```
</details>

---    

> ### isOperatorFor

Returns true if an account is an operator of `tokenHolder`.
Operators can send and burn tokens on behalf of their owners. All
accounts are their own operator.
     * See {operatorSend} and {operatorBurn}.

```solidity
function isOperatorFor(address operator, address tokenHolder) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| operator | address |  | 
| tokenHolder | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function isOperatorFor(address operator, address tokenHolder) external view returns (bool);
```
</details>

---    

> ### authorizeOperator

Make an account an operator of the caller.
     * See {isOperatorFor}.
     * Emits an {AuthorizedOperator} event.
     * Requirements
     * - `operator` cannot be calling address.

```solidity
function authorizeOperator(address operator) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| operator | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function authorizeOperator(address operator) external;
```
</details>

---    

> ### revokeOperator

Make an account an operator of the caller.
     * See {isOperatorFor} and {defaultOperators}.
     * Emits a {RevokedOperator} event.
     * Requirements
     * - `operator` cannot be calling address.

```solidity
function revokeOperator(address operator) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| operator | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function revokeOperator(address operator) external;
```
</details>

---    

> ### defaultOperators

Returns the list of default operators. These accounts are operators
for all token holders, even if {authorizeOperator} was never called on
them.
     * This list is immutable, but individual holders may revoke these via
{revokeOperator}, in which case {isOperatorFor} will return false.

```solidity
function defaultOperators() external view
returns(address[])
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function defaultOperators() external view returns (address[] memory);
```
</details>

---    

> ### operatorSend

Moves `amount` tokens from `sender` to `recipient`. The caller must
be an operator of `sender`.
     * If send or receive hooks are registered for `sender` and `recipient`,
the corresponding functions will be called with `data` and
`operatorData`. See {IERC777Sender} and {IERC777Recipient}.
     * Emits a {Sent} event.
     * Requirements
     * - `sender` cannot be the zero address.
- `sender` must have at least `amount` tokens.
- the caller must be an operator for `sender`.
- `recipient` cannot be the zero address.
- if `recipient` is a contract, it must implement the {IERC777Recipient}
interface.

```solidity
function operatorSend(address sender, address recipient, uint256 amount, bytes data, bytes operatorData) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sender | address |  | 
| recipient | address |  | 
| amount | uint256 |  | 
| data | bytes |  | 
| operatorData | bytes |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function operatorSend(
        address sender,
        address recipient,
        uint256 amount,
        bytes calldata data,
        bytes calldata operatorData
    ) external;
```
</details>

---    

> ### operatorBurn

Destoys `amount` tokens from `account`, reducing the total supply.
The caller must be an operator of `account`.
     * If a send hook is registered for `account`, the corresponding function
will be called with `data` and `operatorData`. See {IERC777Sender}.
     * Emits a {Burned} event.
     * Requirements
     * - `account` cannot be the zero address.
- `account` must have at least `amount` tokens.
- the caller must be an operator for `account`.

```solidity
function operatorBurn(address account, uint256 amount, bytes data, bytes operatorData) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address |  | 
| amount | uint256 |  | 
| data | bytes |  | 
| operatorData | bytes |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function operatorBurn(
        address account,
        uint256 amount,
        bytes calldata data,
        bytes calldata operatorData
    ) external;
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
