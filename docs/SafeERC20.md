# SafeERC20 (SafeERC20.sol)

View Source: [contracts/openzeppelin/SafeERC20.sol](../contracts/openzeppelin/SafeERC20.sol)

**SafeERC20**

Wrappers around ERC20 operations that throw on failure (when the token
contract returns false). Tokens that return no value (and instead revert or
throw on failure) are also supported, non-reverting calls are assumed to be
successful.
To use this library you can add a `using SafeERC20 for ERC20;` statement to your contract,
which allows you to call the safe operations as `token.safeTransfer(...)`, etc.

## Functions

- [safeTransfer(IERC20 token, address to, uint256 value)](#safetransfer)
- [safeTransferFrom(IERC20 token, address from, address to, uint256 value)](#safetransferfrom)
- [safeApprove(IERC20 token, address spender, uint256 value)](#safeapprove)
- [safeIncreaseAllowance(IERC20 token, address spender, uint256 value)](#safeincreaseallowance)
- [safeDecreaseAllowance(IERC20 token, address spender, uint256 value)](#safedecreaseallowance)
- [callOptionalReturn(IERC20 token, bytes data)](#calloptionalreturn)

---    

> ### safeTransfer

```solidity
function safeTransfer(IERC20 token, address to, uint256 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | IERC20 |  | 
| to | address |  | 
| value | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function safeTransfer(
        IERC20 token,
        address to,
        uint256 value
    ) internal {
        callOptionalReturn(token, abi.encodeWithSelector(token.transfer.selector, to, value));
    }
```
</details>

---    

> ### safeTransferFrom

```solidity
function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | IERC20 |  | 
| from | address |  | 
| to | address |  | 
| value | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function safeTransferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 value
    ) internal {
        callOptionalReturn(
            token,
            abi.encodeWithSelector(token.transferFrom.selector, from, to, value)
        );
    }
```
</details>

---    

> ### safeApprove

```solidity
function safeApprove(IERC20 token, address spender, uint256 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | IERC20 |  | 
| spender | address |  | 
| value | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function safeApprove(
        IERC20 token,
        address spender,
        uint256 value
    ) internal {
        // safeApprove should only be called when setting an initial allowance,
        // or when resetting it to zero. To increase and decrease it, use
        // 'safeIncreaseAllowance' and 'safeDecreaseAllowance'
        // solhint-disable-next-line max-line-length
        require(
            (value == 0) || (token.allowance(address(this), spender) == 0),
            "SafeERC20: approve from non-zero to non-zero allowance"
        );
        callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, value));
    }
```
</details>

---    

> ### safeIncreaseAllowance

```solidity
function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | IERC20 |  | 
| spender | address |  | 
| value | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function safeIncreaseAllowance(
        IERC20 token,
        address spender,
        uint256 value
    ) internal {
        uint256 newAllowance = token.allowance(address(this), spender).add(value);
        callOptionalReturn(
            token,
            abi.encodeWithSelector(token.approve.selector, spender, newAllowance)
        );
    }
```
</details>

---    

> ### safeDecreaseAllowance

```solidity
function safeDecreaseAllowance(IERC20 token, address spender, uint256 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | IERC20 |  | 
| spender | address |  | 
| value | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function safeDecreaseAllowance(
        IERC20 token,
        address spender,
        uint256 value
    ) internal {
        uint256 newAllowance =
            token.allowance(address(this), spender).sub(
                value,
                "SafeERC20: decreased allowance below zero"
            );
        callOptionalReturn(
            token,
            abi.encodeWithSelector(token.approve.selector, spender, newAllowance)
        );
    }
```
</details>

---    

> ### callOptionalReturn

Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
on the return value: the return value is optional (but if data is returned, it must not be false).

```solidity
function callOptionalReturn(IERC20 token, bytes data) private nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | IERC20 | The token targeted by the call. | 
| data | bytes | The call data (encoded using abi.encode or one of its variants). | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function callOptionalReturn(IERC20 token, bytes memory data) private {
        // We need to perform a low level call here, to bypass Solidity's return data size checking mechanism, since
        // we're implementing it ourselves.

        // A Solidity high level call has three parts:
        //  1. The target address is checked to verify it contains contract code
        //  2. The call itself is made, and success asserted
        //  3. The return value is decoded, which in turn checks the size of the returned data.
        // solhint-disable-next-line max-line-length
        require(address(token).isContract(), "SafeERC20: call to non-contract");

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = address(token).call(data);
        require(success, "SafeERC20: low-level call failed");

        if (returndata.length > 0) {
            // Return data is optional
            // solhint-disable-next-line max-line-length
            require(abi.decode(returndata, (bool)), "SafeERC20: ERC20 operation did not succeed");
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
