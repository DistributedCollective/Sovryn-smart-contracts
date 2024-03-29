# LoanTokenLogicWrbtc.sol

View Source: [contracts/connectors/loantoken/modules/beaconLogicWRBTC/LoanTokenLogicWrbtc.sol](../contracts/connectors/loantoken/modules/beaconLogicWRBTC/LoanTokenLogicWrbtc.sol)

**↗ Extends: [LoanTokenLogicStandard](LoanTokenLogicStandard.md)**

## **LoanTokenLogicWrbtc** contract

## Functions

- [getListFunctionSignatures()](#getlistfunctionsignatures)
- [mintWithBTC(address receiver, bool useLM)](#mintwithbtc)
- [burnToBTC(address receiver, uint256 burnAmount, bool useLM)](#burntobtc)
- [_verifyTransfers(address collateralTokenAddress, struct MarginTradeStructHelpers.SentAddresses sentAddresses, struct MarginTradeStructHelpers.SentAmounts sentAmounts, uint256 withdrawalAmount)](#_verifytransfers)

---    

> ### getListFunctionSignatures

This function is MANDATORY, which will be called by LoanTokenLogicBeacon and be registered.
Every new public function, the sginature needs to be included in this function.
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
        bytes4[] memory res = new bytes4[](32);

        // Loan Token Logic Standard
        res[0] = this.mint.selector;
        res[1] = this.burn.selector;
        res[2] = this.borrow.selector;
        res[3] = this.marginTrade.selector;
        res[4] = this.marginTradeAffiliate.selector;
        res[5] = this.transfer.selector;
        res[6] = this.transferFrom.selector;
        res[7] = this.profitOf.selector;
        res[8] = this.tokenPrice.selector;
        res[9] = this.checkpointPrice.selector;
        res[10] = this.marketLiquidity.selector;
        res[11] = this.avgBorrowInterestRate.selector;
        res[12] = this.borrowInterestRate.selector;
        res[13] = this.nextBorrowInterestRate.selector;
        res[14] = this.supplyInterestRate.selector;
        res[15] = this.nextSupplyInterestRate.selector;
        res[16] = this.totalSupplyInterestRate.selector;
        res[17] = this.totalAssetBorrow.selector;
        res[18] = this.totalAssetSupply.selector;
        res[19] = this.getMaxEscrowAmount.selector;
        res[20] = this.assetBalanceOf.selector;
        res[21] = this.getEstimatedMarginDetails.selector;
        res[22] = this.getDepositAmountForBorrow.selector;
        res[23] = this.getBorrowAmountForDeposit.selector;
        res[24] = this.checkPriceDivergence.selector;
        res[25] = this.calculateSupplyInterestRate.selector;

        // Loan Token WRBTC
        res[26] = this.mintWithBTC.selector;
        res[27] = this.burnToBTC.selector;

        // Advanced Token
        res[28] = this.approve.selector;

        // Advanced Token Storage
        res[29] = this.totalSupply.selector;
        res[30] = this.balanceOf.selector;
        res[31] = this.allowance.selector;

        return (res, stringToBytes32("LoanTokenLogicWrbtc"));
    }
```
</details>

---    

> ### mintWithBTC

```solidity
function mintWithBTC(address receiver, bool useLM) external payable nonReentrant globallyNonReentrant 
returns(mintAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| useLM | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function mintWithBTC(address receiver, bool useLM)
        external
        payable
        nonReentrant
        globallyNonReentrant
        returns (uint256 mintAmount)
    {
        if (useLM) return _mintWithLM(receiver, msg.value);
        else return _mintToken(receiver, msg.value);
    }
```
</details>

---    

> ### burnToBTC

```solidity
function burnToBTC(address receiver, uint256 burnAmount, bool useLM) external nonpayable nonReentrant globallyNonReentrant 
returns(loanAmountPaid uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| burnAmount | uint256 |  | 
| useLM | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function burnToBTC(
        address receiver,
        uint256 burnAmount,
        bool useLM
    ) external nonReentrant globallyNonReentrant returns (uint256 loanAmountPaid) {
        if (useLM) loanAmountPaid = _burnFromLM(burnAmount);
        else loanAmountPaid = _burnToken(burnAmount);

        if (loanAmountPaid != 0) {
            IWrbtcERC20(wrbtcTokenAddress).withdraw(loanAmountPaid);
            Address.sendValue(receiver, loanAmountPaid);
        }
    }
```
</details>

---    

> ### _verifyTransfers

⤾ overrides [LoanTokenLogicStandard._verifyTransfers](LoanTokenLogicStandard.md#_verifytransfers)

Handle transfers prior to adding newPrincipal to loanTokenSent.
     *

```solidity
function _verifyTransfers(address collateralTokenAddress, struct MarginTradeStructHelpers.SentAddresses sentAddresses, struct MarginTradeStructHelpers.SentAmounts sentAmounts, uint256 withdrawalAmount) internal nonpayable
returns(msgValue uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| collateralTokenAddress | address | The address of the collateral token. | 
| sentAddresses | struct MarginTradeStructHelpers.SentAddresses | The struct which contains addresses of - lender - borrower - receiver - manager      * | 
| sentAmounts | struct MarginTradeStructHelpers.SentAmounts | The struct which contains uint256 of: - interestRate - newPrincipal - interestInitialAmount - loanTokenSent - collateralTokenSent      * | 
| withdrawalAmount | uint256 | The amount to withdraw.      * | 

**Returns**

msgValue The amount of value sent.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _verifyTransfers(
        address collateralTokenAddress,
        MarginTradeStructHelpers.SentAddresses memory sentAddresses,
        MarginTradeStructHelpers.SentAmounts memory sentAmounts,
        uint256 withdrawalAmount
    ) internal returns (uint256 msgValue) {
        address _wrbtcToken = wrbtcTokenAddress;
        address _loanTokenAddress = _wrbtcToken;
        address receiver = sentAddresses.receiver;
        uint256 newPrincipal = sentAmounts.newPrincipal;
        uint256 loanTokenSent = sentAmounts.loanTokenSent;
        uint256 collateralTokenSent = sentAmounts.collateralTokenSent;

        require(_loanTokenAddress != collateralTokenAddress, "26");

        msgValue = msg.value;

        if (withdrawalAmount != 0) {
            /// withdrawOnOpen == true
            IWrbtcERC20(_wrbtcToken).withdraw(withdrawalAmount);
            Address.sendValue(receiver, withdrawalAmount);
            if (newPrincipal > withdrawalAmount) {
                _safeTransfer(
                    _loanTokenAddress,
                    sovrynContractAddress,
                    newPrincipal - withdrawalAmount,
                    ""
                );
            }
        } else {
            _safeTransfer(_loanTokenAddress, sovrynContractAddress, newPrincipal, "27");
        }

        if (collateralTokenSent != 0) {
            _safeTransferFrom(
                collateralTokenAddress,
                msg.sender,
                sovrynContractAddress,
                collateralTokenSent,
                "28"
            );
        }

        if (loanTokenSent != 0) {
            if (msgValue != 0 && msgValue >= loanTokenSent) {
                IWrbtc(_wrbtcToken).deposit.value(loanTokenSent)();
                _safeTransfer(_loanTokenAddress, sovrynContractAddress, loanTokenSent, "29");
                msgValue -= loanTokenSent;
            } else {
                _safeTransferFrom(
                    _loanTokenAddress,
                    msg.sender,
                    sovrynContractAddress,
                    loanTokenSent,
                    "29"
                );
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
