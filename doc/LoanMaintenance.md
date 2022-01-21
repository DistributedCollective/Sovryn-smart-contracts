# Loan Maintenance contract.

- (LoanMaintenance.sol)

View Source: [contracts/modules/LoanMaintenance.sol](../contracts/modules/LoanMaintenance.sol)

**↗ Extends: [LoanOpeningsEvents](LoanOpeningsEvents.md), [LoanMaintenanceEvents](LoanMaintenanceEvents.md), [VaultController](VaultController.md), [InterestUser](InterestUser.md), [SwapsUser](SwapsUser.md), [LiquidationHelper](LiquidationHelper.md), [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)**

**LoanMaintenance**

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.

- This contract contains functions to query loan data and to modify its status
  by withdrawing or depositing collateral.

## Structs

### LoanReturnData

```js
struct LoanReturnData {
 bytes32 loanId,
 address loanToken,
 address collateralToken,
 address borrower,
 uint256 principal,
 uint256 collateral,
 uint256 interestOwedPerDay,
 uint256 interestDepositRemaining,
 uint256 startRate,
 uint256 startMargin,
 uint256 maintenanceMargin,
 uint256 currentMargin,
 uint256 maxLoanTerm,
 uint256 endTimestamp,
 uint256 maxLiquidatable,
 uint256 maxSeizable,
 uint256 creationTimestamp
}
```

## Functions

- [()](#)
- [()](#)
- [initialize(address target)](#initialize)
- [depositCollateral(bytes32 loanId, uint256 depositAmount)](#depositcollateral)
- [withdrawCollateral(bytes32 loanId, address receiver, uint256 withdrawAmount)](#withdrawcollateral)
- [withdrawAccruedInterest(address loanToken)](#withdrawaccruedinterest)
- [extendLoanDuration(bytes32 loanId, uint256 depositAmount, bool useCollateral, bytes )](#extendloanduration)
- [reduceLoanDuration(bytes32 loanId, address receiver, uint256 withdrawAmount)](#reduceloanduration)
- [getLenderInterestData(address lender, address loanToken)](#getlenderinterestdata)
- [getLoanInterestData(bytes32 loanId)](#getloaninterestdata)
- [getUserLoans(address user, uint256 start, uint256 count, uint256 loanType, bool isLender, bool unsafeOnly)](#getuserloans)
- [getLoan(bytes32 loanId)](#getloan)
- [getActiveLoans(uint256 start, uint256 count, bool unsafeOnly)](#getactiveloans)
- [\_getLoan(bytes32 loanId, uint256 loanType, bool unsafeOnly)](#_getloan)
- [\_doCollateralSwap(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 depositAmount)](#_docollateralswap)

###

Empty public constructor.

```js
function () public nonpayable
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

###

Fallback function is to react to receiving value (rBTC).

```js
function () external nonpayable
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### initialize

Set initial values of proxy targets. \*

```js
function initialize(address target) external nonpayable onlyOwner
```

**Arguments**

| Name   | Type    | Description                                 |
| ------ | ------- | ------------------------------------------- |
| target | address | The address of the logic contract instance. |

### depositCollateral

Increase the margin of a position by depositing additional collateral. \*

```js
function depositCollateral(bytes32 loanId, uint256 depositAmount) external payable nonReentrant whenNotPaused
```

**Returns**

actualWithdrawAmount The amount withdrawn taking into account drawdowns.

**Arguments**

| Name          | Type    | Description                                      |
| ------------- | ------- | ------------------------------------------------ |
| loanId        | bytes32 | A unique ID representing the loan.               |
| depositAmount | uint256 | The amount to be deposited in collateral tokens. |
| \*            |

### withdrawCollateral

Withdraw from the collateral. This reduces the margin of a position. \*

```js
function withdrawCollateral(bytes32 loanId, address receiver, uint256 withdrawAmount) external nonpayable nonReentrant whenNotPaused
returns(actualWithdrawAmount uint256)
```

**Returns**

actualWithdrawAmount The amount withdrawn taking into account drawdowns.

**Arguments**

| Name           | Type    | Description                                      |
| -------------- | ------- | ------------------------------------------------ |
| loanId         | bytes32 | A unique ID representing the loan.               |
| receiver       | address | The account getting the withdrawal.              |
| withdrawAmount | uint256 | The amount to be withdrawn in collateral tokens. |
| \*             |

### withdrawAccruedInterest

Withdraw accrued loan interest. \*

```js
function withdrawAccruedInterest(address loanToken) external nonpayable whenNotPaused
```

**Arguments**

| Name      | Type    | Description             |
| --------- | ------- | ----------------------- |
| loanToken | address | The loan token address. |

### extendLoanDuration

Extend the loan duration by as much time as depositAmount can buy. \*

```js
function extendLoanDuration(bytes32 loanId, uint256 depositAmount, bool useCollateral, bytes ) external payable nonReentrant whenNotPaused
returns(secondsExtended uint256)
```

**Returns**

secondsExtended The amount of time in seconds the loan is extended.

**Arguments**

| Name          | Type    | Description                                                                               |
| ------------- | ------- | ----------------------------------------------------------------------------------------- |
| loanId        | bytes32 | A unique ID representing the loan.                                                        |
| depositAmount | uint256 | The amount to be deposited in loan tokens. Used to pay the interest for the new duration. |
| useCollateral | bool    | Whether pay interests w/ the collateral. If true, depositAmount of loan tokens            |

    				will be purchased with the collateral.

// param calldata The payload for the call. These loan DataBytes are additional loan data (not in use for token swaps). \* |
| | bytes | loanId A unique ID representing the loan. |

### reduceLoanDuration

Reduce the loan duration by withdrawing from the deposited interest. \*

```js
function reduceLoanDuration(bytes32 loanId, address receiver, uint256 withdrawAmount) external nonpayable nonReentrant whenNotPaused
returns(secondsReduced uint256)
```

**Returns**

secondsReduced The amount of time in seconds the loan is reduced.

**Arguments**

| Name           | Type    | Description                                |
| -------------- | ------- | ------------------------------------------ |
| loanId         | bytes32 | A unique ID representing the loan.         |
| receiver       | address | The account getting the withdrawal.        |
| withdrawAmount | uint256 | The amount to be withdrawn in loan tokens. |
| \*             |

### getLenderInterestData

Get current lender interest data totals for all loans
with a specific oracle and interest token. \*

```js
function getLenderInterestData(address lender, address loanToken) external view
returns(interestPaid uint256, interestPaidDate uint256, interestOwedPerDay uint256, interestUnPaid uint256, interestFeePercent uint256, principalTotal uint256)
```

**Returns**

interestPaid The total amount of interest that has been paid to a lender so far.

**Arguments**

| Name      | Type    | Description             |
| --------- | ------- | ----------------------- |
| lender    | address | The lender address.     |
| loanToken | address | The loan token address. |
| \*        |

### getLoanInterestData

Get current interest data for a loan. \*

```js
function getLoanInterestData(bytes32 loanId) external view
returns(loanToken address, interestOwedPerDay uint256, interestDepositTotal uint256, interestDepositRemaining uint256)
```

**Returns**

loanToken The loan token that interest is paid in.

**Arguments**

| Name   | Type    | Description                        |
| ------ | ------- | ---------------------------------- |
| loanId | bytes32 | A unique ID representing the loan. |
| \*     |

### getUserLoans

Get all user loans.
_ Only returns data for loans that are active.
_

```js
function getUserLoans(address user, uint256 start, uint256 count, uint256 loanType, bool isLender, bool unsafeOnly) external view
returns(loansData struct LoanMaintenance.LoanReturnData[])
```

**Returns**

loansData The array of loans as query result.

**Arguments**

| Name     | Type    | Description                      |
| -------- | ------- | -------------------------------- |
| user     | address | The user address.                |
| start    | uint256 | The lower loan ID to start with. |
| count    | uint256 | The maximum number of results.   |
| loanType | uint256 | The type of loan.                |

loanType 0: all loans.
loanType 1: margin trade loans.
loanType 2: non-margin trade loans. |
| isLender | bool | Whether the user is lender or borrower. |
| unsafeOnly | bool | The safe filter (True/False). \* |

### getLoan

Get one loan data structure by matching ID.
_ Wrapper to internal \_getLoan call.
_

```js
function getLoan(bytes32 loanId) external view
returns(loanData struct LoanMaintenance.LoanReturnData)
```

**Returns**

loansData The data structure w/ loan information.

**Arguments**

| Name   | Type    | Description                        |
| ------ | ------- | ---------------------------------- |
| loanId | bytes32 | A unique ID representing the loan. |
| \*     |

### getActiveLoans

Get all active loans. \*

```js
function getActiveLoans(uint256 start, uint256 count, bool unsafeOnly) external view
returns(loansData struct LoanMaintenance.LoanReturnData[])
```

**Returns**

loansData The data structure w/ loan information.

**Arguments**

| Name       | Type    | Description                      |
| ---------- | ------- | -------------------------------- |
| start      | uint256 | The lower loan ID to start with. |
| count      | uint256 | The maximum number of results.   |
| unsafeOnly | bool    | The safe filter (True/False).    |
| \*         |

### \_getLoan

Internal function to get one loan data structure. \*

```js
function _getLoan(bytes32 loanId, uint256 loanType, bool unsafeOnly) internal view
returns(loanData struct LoanMaintenance.LoanReturnData)
```

**Returns**

loansData The data structure w/ the loan information.

**Arguments**

| Name     | Type    | Description                        |
| -------- | ------- | ---------------------------------- |
| loanId   | bytes32 | A unique ID representing the loan. |
| loanType | uint256 | The type of loan.                  |

loanType 0: all loans.
loanType 1: margin trade loans.
loanType 2: non-margin trade loans. |
| unsafeOnly | bool | The safe filter (True/False). \* |

### \_doCollateralSwap

Internal function to collect interest from the collateral. \*

```js
function _doCollateralSwap(struct LoanStruct.Loan loanLocal, struct LoanParamsStruct.LoanParams loanParamsLocal, uint256 depositAmount) internal nonpayable
```

**Arguments**

| Name            | Type                               | Description                                           |
| --------------- | ---------------------------------- | ----------------------------------------------------- |
| loanLocal       | struct LoanStruct.Loan             | The loan object.                                      |
| loanParamsLocal | struct LoanParamsStruct.LoanParams | The loan parameters.                                  |
| depositAmount   | uint256                            | The amount of underlying tokens provided on the loan. |

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
