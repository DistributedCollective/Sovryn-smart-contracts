# State contract. (State.sol)

View Source: [contracts/core/State.sol](../contracts/core/State.sol)

**↗ Extends: [Objects](Objects.md), [ReentrancyGuard](ReentrancyGuard.md), [Ownable](Ownable.md)**
**↘ Derived Contracts: [Affiliates](Affiliates.md), [FeesHelper](FeesHelper.md), [ISovryn](ISovryn.md), [LiquidationHelper](LiquidationHelper.md), [LoanSettings](LoanSettings.md), [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md), [ProtocolSettings](ProtocolSettings.md), [ProtocolTokenUser](ProtocolTokenUser.md), [RewardHelper](RewardHelper.md), [sovrynProtocol](sovrynProtocol.md), [SwapsImplLocal](SwapsImplLocal.md), [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md), [SwapsUser](SwapsUser.md), [VaultController](VaultController.md)**

**State**

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
 * This contract contains the storage values of the Protocol.

## Contract Members
**Constants & Variables**

```js
//public members
address public priceFeeds;
address public swapsImpl;
address public sovrynSwapContractRegistryAddress;
mapping(bytes4 => address) public logicTargets;
mapping(bytes32 => struct LoanStruct.Loan) public loans;
mapping(bytes32 => struct LoanParamsStruct.LoanParams) public loanParams;
mapping(address => mapping(bytes32 => struct OrderStruct.Order)) public lenderOrders;
mapping(address => mapping(bytes32 => struct OrderStruct.Order)) public borrowerOrders;
mapping(bytes32 => mapping(address => bool)) public delegatedManagers;
mapping(address => mapping(address => struct LenderInterestStruct.LenderInterest)) public lenderInterest;
mapping(bytes32 => struct LoanInterestStruct.LoanInterest) public loanInterest;
address public feesController;
uint256 public lendingFeePercent;
mapping(address => uint256) public lendingFeeTokensHeld;
mapping(address => uint256) public lendingFeeTokensPaid;
uint256 public tradingFeePercent;
mapping(address => uint256) public tradingFeeTokensHeld;
mapping(address => uint256) public tradingFeeTokensPaid;
uint256 public borrowingFeePercent;
mapping(address => uint256) public borrowingFeeTokensHeld;
mapping(address => uint256) public borrowingFeeTokensPaid;
uint256 public protocolTokenHeld;
uint256 public protocolTokenPaid;
uint256 public affiliateFeePercent;
uint256 public liquidationIncentivePercent;
mapping(address => address) public loanPoolToUnderlying;
mapping(address => address) public underlyingToLoanPool;
mapping(address => bool) public supportedTokens;
uint256 public maxDisagreement;
uint256 public sourceBuffer;
uint256 public maxSwapSize;
mapping(address => uint256) public borrowerNonce;
uint256 public rolloverBaseReward;
uint256 public rolloverFlexFeePercent;
contract IWrbtcERC20 public wrbtcToken;
address public protocolTokenAddress;
uint256 public feeRebatePercent;
address public admin;
address public protocolAddress;
mapping(address => bool) public userNotFirstTradeFlag;
mapping(address => address) public affiliatesUserReferrer;
uint256 public minReferralsToPayout;
mapping(address => uint256) public affiliateRewardsHeld;
address public sovTokenAddress;
address public lockedSOVAddress;
uint256 public affiliateTradingTokenFeePercent;
mapping(address => mapping(address => uint256)) public affiliatesReferrerBalances;
mapping(address => mapping(address => uint256)) public specialRebates;
bool public pause;

//internal members
struct EnumerableBytes32Set.Bytes32Set internal logicTargetsSet;
struct EnumerableBytes32Set.Bytes32Set internal activeLoansSet;
mapping(address => struct EnumerableBytes32Set.Bytes32Set) internal lenderLoanSets;
mapping(address => struct EnumerableBytes32Set.Bytes32Set) internal borrowerLoanSets;
mapping(address => struct EnumerableBytes32Set.Bytes32Set) internal userLoanParamSets;
struct EnumerableBytes32Set.Bytes32Set internal loanPoolsSet;
mapping(address => struct EnumerableAddressSet.AddressSet) internal referralsList;
mapping(address => struct EnumerableAddressSet.AddressSet) internal affiliatesReferrerTokensList;
uint256 internal swapExtrernalFeePercent;
uint256 internal tradingRebateRewardsBasisPoint;

```

## Functions

- [_setTarget(bytes4 sig, address target)](#_settarget)

---    

> ### _setTarget

Add signature and target to storage.

```solidity
function _setTarget(bytes4 sig, address target) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sig | bytes4 |  | 
| target | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _setTarget(bytes4 sig, address target) internal {
        logicTargets[sig] = target;

        if (target != address(0)) {
            logicTargetsSet.addBytes32(bytes32(sig));
        } else {
            logicTargetsSet.removeBytes32(bytes32(sig));
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
