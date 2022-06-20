# LoanTokenLogicLM.sol

View Source: [contracts/connectors/loantoken/modules/beaconLogicLM/LoanTokenLogicLM.sol](../contracts/connectors/loantoken/modules/beaconLogicLM/LoanTokenLogicLM.sol)

**↗ Extends: [LoanTokenLogicStandard](LoanTokenLogicStandard.md)**

**LoanTokenLogicLM**

## Functions

- [getListFunctionSignatures()](#getlistfunctionsignatures)
- [mint(address receiver, uint256 depositAmount, bool useLM)](#mint)
- [burn(address receiver, uint256 burnAmount, bool useLM)](#burn)

---    

> ### getListFunctionSignatures

This function is MANDATORY, which will be called by LoanTokenLogicBeacon and be registered.
Every new public function, the signature needs to be included in this function.
     *

```solidity
function getListFunctionSignatures() external pure
returns(functionSignatures bytes4[], moduleName bytes32)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getListFunctionSignatures()
        external
        pure
        returns (bytes4[] memory functionSignatures, bytes32 moduleName)
    {
        bytes4[] memory res = new bytes4[](36);

        // Loan Token Logic Standard
        res[0] = this.borrow.selector;
        res[1] = this.marginTrade.selector;
        res[2] = this.marginTradeAffiliate.selector;
        res[3] = this.transfer.selector;
        res[4] = this.transferFrom.selector;
        res[5] = this.profitOf.selector;
        res[6] = this.tokenPrice.selector;
        res[7] = this.checkpointPrice.selector;
        res[8] = this.marketLiquidity.selector;
        res[9] = this.avgBorrowInterestRate.selector;
        res[10] = this.borrowInterestRate.selector;
        res[11] = this.nextBorrowInterestRate.selector;
        res[12] = this.supplyInterestRate.selector;
        res[13] = this.nextSupplyInterestRate.selector;
        res[14] = this.totalSupplyInterestRate.selector;
        res[15] = this.totalAssetBorrow.selector;
        res[16] = this.totalAssetSupply.selector;
        res[17] = this.getMaxEscrowAmount.selector;
        res[18] = this.assetBalanceOf.selector;
        res[19] = this.getEstimatedMarginDetails.selector;
        res[20] = this.getDepositAmountForBorrow.selector;
        res[21] = this.getBorrowAmountForDeposit.selector;
        res[22] = this.checkPriceDivergence.selector;
        res[23] = this.checkPause.selector;
        res[24] = this.setLiquidityMiningAddress.selector;
        res[25] = this.calculateSupplyInterestRate.selector;

        // Loan Token LM & OVERLOADING function
        /**
         * @notice BE CAREFUL,
         * LoanTokenLogicStandard also has mint & burn function (overloading).
         * You need to compute the function signature manually --> bytes4(keccak256("mint(address,uint256,bool)"))
         */
        res[26] = bytes4(keccak256("mint(address,uint256)")); /// LoanTokenLogicStandard
        res[27] = bytes4(keccak256("mint(address,uint256,bool)")); /// LoanTokenLogicLM
        res[28] = bytes4(keccak256("burn(address,uint256)")); /// LoanTokenLogicStandard
        res[29] = bytes4(keccak256("burn(address,uint256,bool)")); /// LoanTokenLogicLM

        // Advanced Token
        res[30] = this.approve.selector;

        // Advanced Token Storage
        res[31] = this.totalSupply.selector;
        res[32] = this.balanceOf.selector;
        res[33] = this.allowance.selector;

        // Loan Token Logic Storage Additional Variable
        res[34] = this.getLiquidityMiningAddress.selector;
        res[35] = this.withdrawRBTCTo.selector;

        return (res, stringToBytes32("LoanTokenLogicLM"));
    }
```
</details>

---    

> ### mint

deposit into the lending pool and optionally participate at the Liquidity Mining Program

```solidity
function mint(address receiver, uint256 depositAmount, bool useLM) external nonpayable nonReentrant 
returns(minted uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address | the receiver of the tokens | 
| depositAmount | uint256 | The amount of underlying tokens provided on the loan. 					(Not the number of loan tokens to mint). | 
| useLM | bool | if true -> deposit the pool tokens into the Liquidity Mining contract | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function mint(
        address receiver,
        uint256 depositAmount,
        bool useLM
    ) external nonReentrant returns (uint256 minted) {
        if (useLM) return _mintWithLM(receiver, depositAmount);
        else return _mintToken(receiver, depositAmount);
    }
```
</details>

---    

> ### burn

withdraws from the lending pool and optionally retrieves the pool tokens from the
        Liquidity Mining Contract

```solidity
function burn(address receiver, uint256 burnAmount, bool useLM) external nonpayable nonReentrant 
returns(redeemed uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address | the receiver of the underlying tokens. note: potetial LM rewards are always sent to the msg.sender | 
| burnAmount | uint256 | The amount of pool tokens to redeem. | 
| useLM | bool | if true -> deposit the pool tokens into the Liquidity Mining contract | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function burn(
        address receiver,
        uint256 burnAmount,
        bool useLM
    ) external nonReentrant returns (uint256 redeemed) {
        if (useLM) redeemed = _burnFromLM(burnAmount);
        else redeemed = _burnToken(burnAmount);
        //this needs to be here and not in _burnTokens because of the WRBTC implementation
        if (redeemed != 0) {
            _safeTransfer(loanTokenAddress, receiver, redeemed, "asset transfer failed");
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
