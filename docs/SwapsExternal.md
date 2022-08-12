# Swaps External contract.
 * (SwapsExternal.sol)

View Source: [contracts/modules/SwapsExternal.sol](../contracts/modules/SwapsExternal.sol)

**↗ Extends: [VaultController](VaultController.md), [SwapsUser](SwapsUser.md), [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)**

**SwapsExternal**

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
 * This contract contains functions to calculate and execute swaps.

## Functions

- [constructor()](#constructor)
- [constructor()](#constructor)
- [initialize(address target)](#initialize)
- [swapExternal(address sourceToken, address destToken, address receiver, address returnToSender, uint256 sourceTokenAmount, uint256 requiredDestTokenAmount, uint256 minReturn, bytes swapData)](#swapexternal)
- [getSwapExpectedReturn(address sourceToken, address destToken, uint256 sourceTokenAmount)](#getswapexpectedreturn)
- [checkPriceDivergence(address sourceToken, address destToken, uint256 sourceTokenAmount, uint256 minReturn)](#checkpricedivergence)

---    

> ### constructor

Empty public constructor.

```solidity
function () public nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor() public {}
```
</details>

---    

> ### constructor

Fallback function is to react to receiving value (rBTC).

```solidity
function () external nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function() external {
        revert("fallback not allowed");
    }
```
</details>

---    

> ### initialize

Set function selectors on target contract.
     *

```solidity
function initialize(address target) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address | The address of the target contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function initialize(address target) external onlyOwner {
        address prevModuleContractAddress = logicTargets[this.swapExternal.selector];
        _setTarget(this.swapExternal.selector, target);
        _setTarget(this.getSwapExpectedReturn.selector, target);
        _setTarget(this.checkPriceDivergence.selector, target);
        emit ProtocolModuleContractReplaced(prevModuleContractAddress, target, "SwapsExternal");
    }
```
</details>

---    

> ### swapExternal

Perform a swap w/ tokens or rBTC as source currency.
     *

```solidity
function swapExternal(address sourceToken, address destToken, address receiver, address returnToSender, uint256 sourceTokenAmount, uint256 requiredDestTokenAmount, uint256 minReturn, bytes swapData) public payable nonReentrant whenNotPaused 
returns(destTokenAmountReceived uint256, sourceTokenAmountUsed uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address | The address of the source token instance. | 
| destToken | address | The address of the destiny token instance. | 
| receiver | address | The address of the recipient account. | 
| returnToSender | address | The address of the sender account. | 
| sourceTokenAmount | uint256 | The amount of source tokens. | 
| requiredDestTokenAmount | uint256 | The amount of required destiny tokens. | 
| minReturn | uint256 | Minimum amount (position size) in the collateral tokens. | 
| swapData | bytes | Additional swap data (not in use yet).      * | 

**Returns**

destTokenAmountReceived The amount of destiny tokens sent.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function swapExternal(
        address sourceToken,
        address destToken,
        address receiver,
        address returnToSender,
        uint256 sourceTokenAmount,
        uint256 requiredDestTokenAmount,
        uint256 minReturn,
        bytes memory swapData
    )
        public
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed)
    {
        require(sourceTokenAmount != 0, "sourceTokenAmount == 0");
        checkPriceDivergence(sourceToken, destToken, sourceTokenAmount, minReturn);

        /// @dev Get payed value, be it rBTC or tokenized.
        if (msg.value != 0) {
            if (sourceToken == address(0)) {
                sourceToken = address(wrbtcToken);
            }
            require(sourceToken == address(wrbtcToken), "sourceToken mismatch");
            require(msg.value == sourceTokenAmount, "sourceTokenAmount mismatch");

            /// @dev Update wrBTC balance for this contract.
            wrbtcToken.deposit.value(sourceTokenAmount)();
        } else {
            if (address(this) != msg.sender) {
                IERC20(sourceToken).safeTransferFrom(msg.sender, address(this), sourceTokenAmount);
            }
        }

        /// @dev Perform the swap w/ tokens.
        (destTokenAmountReceived, sourceTokenAmountUsed) = _swapsCall(
            [
                sourceToken,
                destToken,
                receiver,
                returnToSender,
                msg.sender /// user
            ],
            [
                sourceTokenAmount, /// minSourceTokenAmount
                sourceTokenAmount, /// maxSourceTokenAmount
                requiredDestTokenAmount
            ],
            0, /// loanId (not tied to a specific loan)
            false, /// bypassFee
            swapData,
            true // the flag for swapExternal (so that it will use the swapExternalFeePercent)
        );

        emit ExternalSwap(
            msg.sender, /// user
            sourceToken,
            destToken,
            sourceTokenAmountUsed,
            destTokenAmountReceived
        );
    }
```
</details>

---    

> ### getSwapExpectedReturn

Get the swap expected return value.
     *

```solidity
function getSwapExpectedReturn(address sourceToken, address destToken, uint256 sourceTokenAmount) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address | The address of the source token instance. | 
| destToken | address | The address of the destiny token instance. | 
| sourceTokenAmount | uint256 | The amount of source tokens.      * | 

**Returns**

The expected return value.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getSwapExpectedReturn(
        address sourceToken,
        address destToken,
        uint256 sourceTokenAmount
    ) external view returns (uint256) {
        return _swapsExpectedReturn(sourceToken, destToken, sourceTokenAmount);
    }
```
</details>

---    

> ### checkPriceDivergence

Check the slippage based on the swapExpectedReturn.
     *

```solidity
function checkPriceDivergence(address sourceToken, address destToken, uint256 sourceTokenAmount, uint256 minReturn) public view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address | The address of the source token instance. | 
| destToken | address | The address of the destiny token instance. | 
| sourceTokenAmount | uint256 | The amount of source tokens. | 
| minReturn | uint256 | The amount (max slippage) that will be compared to the swapsExpectedReturn. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function checkPriceDivergence(
        address sourceToken,
        address destToken,
        uint256 sourceTokenAmount,
        uint256 minReturn
    ) public view {
        uint256 destTokenAmount = _swapsExpectedReturn(sourceToken, destToken, sourceTokenAmount);
        require(destTokenAmount >= minReturn, "destTokenAmountReceived too low");
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
