# Protocol Settings contract.

- (ProtocolSettings.sol)

View Source: [contracts/modules/ProtocolSettings.sol](../contracts/modules/ProtocolSettings.sol)

**↗ Extends: [State](State.md), [ProtocolTokenUser](ProtocolTokenUser.md), [ProtocolSettingsEvents](ProtocolSettingsEvents.md), [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)**
**↘ Derived Contracts: [ProtocolSettingsMockup](ProtocolSettingsMockup.md)**

**ProtocolSettings**

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.

- This contract contains functions to customize protocol settings.

## Functions

- [()](#)
- [()](#)
- [initialize(address target)](#initialize)
- [setSovrynProtocolAddress(address newProtocolAddress)](#setsovrynprotocoladdress)
- [setSOVTokenAddress(address newSovTokenAddress)](#setsovtokenaddress)
- [setLockedSOVAddress(address newLockedSOVAddress)](#setlockedsovaddress)
- [setTradingRebateRewardsBasisPoint(uint256 newBasisPoint)](#settradingrebaterewardsbasispoint)
- [setMinReferralsToPayoutAffiliates(uint256 newMinReferrals)](#setminreferralstopayoutaffiliates)
- [setPriceFeedContract(address newContract)](#setpricefeedcontract)
- [setSwapsImplContract(address newContract)](#setswapsimplcontract)
- [setLoanPool(address[] pools, address[] assets)](#setloanpool)
- [setSupportedTokens(address[] addrs, bool[] toggles)](#setsupportedtokens)
- [setLendingFeePercent(uint256 newValue)](#setlendingfeepercent)
- [setTradingFeePercent(uint256 newValue)](#settradingfeepercent)
- [setBorrowingFeePercent(uint256 newValue)](#setborrowingfeepercent)
- [setSwapExternalFeePercent(uint256 newValue)](#setswapexternalfeepercent)
- [setAffiliateFeePercent(uint256 newValue)](#setaffiliatefeepercent)
- [setAffiliateTradingTokenFeePercent(uint256 newValue)](#setaffiliatetradingtokenfeepercent)
- [setLiquidationIncentivePercent(uint256 newValue)](#setliquidationincentivepercent)
- [setMaxDisagreement(uint256 newValue)](#setmaxdisagreement)
- [setSourceBuffer(uint256 newValue)](#setsourcebuffer)
- [setMaxSwapSize(uint256 newValue)](#setmaxswapsize)
- [setFeesController(address newController)](#setfeescontroller)
- [withdrawFees(address[] tokens, address receiver)](#withdrawfees)
- [withdrawLendingFees(address token, address receiver, uint256 amount)](#withdrawlendingfees)
- [withdrawTradingFees(address token, address receiver, uint256 amount)](#withdrawtradingfees)
- [withdrawBorrowingFees(address token, address receiver, uint256 amount)](#withdrawborrowingfees)
- [withdrawProtocolToken(address receiver, uint256 amount)](#withdrawprotocoltoken)
- [depositProtocolToken(uint256 amount)](#depositprotocoltoken)
- [getLoanPoolsList(uint256 start, uint256 count)](#getloanpoolslist)
- [isLoanPool(address loanPool)](#isloanpool)
- [setSovrynSwapContractRegistryAddress(address registryAddress)](#setsovrynswapcontractregistryaddress)
- [setWrbtcToken(address wrbtcTokenAddress)](#setwrbtctoken)
- [setProtocolTokenAddress(address \_protocolTokenAddress)](#setprotocoltokenaddress)
- [setRolloverBaseReward(uint256 baseRewardValue)](#setrolloverbasereward)
- [setRebatePercent(uint256 rebatePercent)](#setrebatepercent)
- [setSpecialRebates(address sourceToken, address destToken, uint256 specialRebatesPercent)](#setspecialrebates)
- [getSpecialRebates(address sourceTokenAddress, address destTokenAddress)](#getspecialrebates)
- [getProtocolAddress()](#getprotocoladdress)
- [getSovTokenAddress()](#getsovtokenaddress)
- [getLockedSOVAddress()](#getlockedsovaddress)
- [getFeeRebatePercent()](#getfeerebatepercent)
- [togglePaused(bool paused)](#togglepaused)
- [isProtocolPaused()](#isprotocolpaused)
- [getSwapExternalFeePercent()](#getswapexternalfeepercent)
- [getTradingRebateRewardsBasisPoint()](#gettradingrebaterewardsbasispoint)
- [getDedicatedSOVRebate()](#getdedicatedsovrebate)

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

⤿ Overridden Implementation(s): [ProtocolSettingsMockup.initialize](ProtocolSettingsMockup.md#initialize)

Set function selectors on target contract. \*

```js
function initialize(address target) external nonpayable onlyOwner
```

**Arguments**

| Name   | Type    | Description                         |
| ------ | ------- | ----------------------------------- |
| target | address | The address of the target contract. |

### setSovrynProtocolAddress

```js
function setSovrynProtocolAddress(address newProtocolAddress) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name               | Type    | Description |
| ------------------ | ------- | ----------- |
| newProtocolAddress | address |             |

### setSOVTokenAddress

```js
function setSOVTokenAddress(address newSovTokenAddress) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name               | Type    | Description |
| ------------------ | ------- | ----------- |
| newSovTokenAddress | address |             |

### setLockedSOVAddress

```js
function setLockedSOVAddress(address newLockedSOVAddress) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name                | Type    | Description |
| ------------------- | ------- | ----------- |
| newLockedSOVAddress | address |             |

### setTradingRebateRewardsBasisPoint

Set the basis point of trading rebate rewards (SOV), max value is 9999 (99.99% liquid, 0.01% vested). \*

```js
function setTradingRebateRewardsBasisPoint(uint256 newBasisPoint) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name          | Type    | Description        |
| ------------- | ------- | ------------------ |
| newBasisPoint | uint256 | Basis point value. |

### setMinReferralsToPayoutAffiliates

Update the minimum number of referrals to get affiliates rewards. \*

```js
function setMinReferralsToPayoutAffiliates(uint256 newMinReferrals) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name            | Type    | Description                          |
| --------------- | ------- | ------------------------------------ |
| newMinReferrals | uint256 | The new minimum number of referrals. |

### setPriceFeedContract

Set the address of the Price Feed instance. \*

```js
function setPriceFeedContract(address newContract) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name        | Type    | Description                                 |
| ----------- | ------- | ------------------------------------------- |
| newContract | address | The address of the Price Feed new instance. |

### setSwapsImplContract

Set the address of the asset swapper instance. \*

```js
function setSwapsImplContract(address newContract) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name        | Type    | Description                                    |
| ----------- | ------- | ---------------------------------------------- |
| newContract | address | The address of the asset swapper new instance. |

### setLoanPool

Set a list of loan pools and its tokens. \*

```js
function setLoanPool(address[] pools, address[] assets) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name   | Type      | Description                                                    |
| ------ | --------- | -------------------------------------------------------------- |
| pools  | address[] | The array of addresses of new loan pool instances.             |
| assets | address[] | The array of addresses of the corresponding underlying tokens. |

### setSupportedTokens

Set a list of supported tokens by populating the
storage supportedTokens mapping. \*

```js
function setSupportedTokens(address[] addrs, bool[] toggles) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name                                         | Type      | Description                           |
| -------------------------------------------- | --------- | ------------------------------------- |
| addrs                                        | address[] | The array of addresses of the tokens. |
| toggles                                      | bool[]    | The array of flags indicating whether |
| the corresponding token is supported or not. |

### setLendingFeePercent

Set the value of lendingFeePercent storage variable. \*

```js
function setLendingFeePercent(uint256 newValue) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name     | Type    | Description                          |
| -------- | ------- | ------------------------------------ |
| newValue | uint256 | The new value for lendingFeePercent. |

### setTradingFeePercent

Set the value of tradingFeePercent storage variable. \*

```js
function setTradingFeePercent(uint256 newValue) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name     | Type    | Description                          |
| -------- | ------- | ------------------------------------ |
| newValue | uint256 | The new value for tradingFeePercent. |

### setBorrowingFeePercent

Set the value of borrowingFeePercent storage variable. \*

```js
function setBorrowingFeePercent(uint256 newValue) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name     | Type    | Description                            |
| -------- | ------- | -------------------------------------- |
| newValue | uint256 | The new value for borrowingFeePercent. |

### setSwapExternalFeePercent

Set the value of swapExtrernalFeePercent storage variable \*

```js
function setSwapExternalFeePercent(uint256 newValue) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name     | Type    | Description                              |
| -------- | ------- | ---------------------------------------- |
| newValue | uint256 | the new value for swapExternalFeePercent |

### setAffiliateFeePercent

Set the value of affiliateFeePercent storage variable. \*

```js
function setAffiliateFeePercent(uint256 newValue) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name     | Type    | Description                            |
| -------- | ------- | -------------------------------------- |
| newValue | uint256 | The new value for affiliateFeePercent. |

### setAffiliateTradingTokenFeePercent

Set the value of affiliateTradingTokenFeePercent storage variable. \*

```js
function setAffiliateTradingTokenFeePercent(uint256 newValue) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name     | Type    | Description                                        |
| -------- | ------- | -------------------------------------------------- |
| newValue | uint256 | The new value for affiliateTradingTokenFeePercent. |

### setLiquidationIncentivePercent

Set the value of liquidationIncentivePercent storage variable. \*

```js
function setLiquidationIncentivePercent(uint256 newValue) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name     | Type    | Description                                    |
| -------- | ------- | ---------------------------------------------- |
| newValue | uint256 | The new value for liquidationIncentivePercent. |

### setMaxDisagreement

Set the value of the maximum swap spread. \*

```js
function setMaxDisagreement(uint256 newValue) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name     | Type    | Description                        |
| -------- | ------- | ---------------------------------- |
| newValue | uint256 | The new value for maxDisagreement. |

### setSourceBuffer

Set the value of the maximum source buffer. \*

```js
function setSourceBuffer(uint256 newValue) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name     | Type    | Description                                  |
| -------- | ------- | -------------------------------------------- |
| newValue | uint256 | The new value for the maximum source buffer. |

### setMaxSwapSize

Set the value of the swap size limit. \*

```js
function setMaxSwapSize(uint256 newValue) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name     | Type    | Description                              |
| -------- | ------- | ---------------------------------------- |
| newValue | uint256 | The new value for the maximum swap size. |

### setFeesController

Set the address of the feesController instance. \*

```js
function setFeesController(address newController) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name          | Type    | Description                            |
| ------------- | ------- | -------------------------------------- |
| newController | address | The new address of the feesController. |

### withdrawFees

The feesController calls this function to withdraw fees
from three sources: lending, trading and borrowing.
The fees (except SOV) will be converted to wRBTC.
For SOV, it will be deposited directly to feeSharingProxy from the protocol. \*

```js
function withdrawFees(address[] tokens, address receiver) external nonpayable whenNotPaused
returns(totalWRBTCWithdrawn uint256)
```

**Returns**

The withdrawn total amount in wRBTC

**Arguments**

| Name     | Type      | Description                                 |
| -------- | --------- | ------------------------------------------- |
| tokens   | address[] | The array of address of the token instance. |
| receiver | address   | The address of the withdrawal recipient.    |
| \*       |

### withdrawLendingFees

The feesController calls this function to withdraw fees
accrued from lending operations. \*

```js
function withdrawLendingFees(address token, address receiver, uint256 amount) external nonpayable whenNotPaused
returns(bool)
```

**Returns**

Whether withdrawal was successful.

**Arguments**

| Name     | Type    | Description                                                 |
| -------- | ------- | ----------------------------------------------------------- |
| token    | address | The address of the token instance.                          |
| receiver | address | The address of the withdrawal recipient.                    |
| amount   | uint256 | The amount of fees to get, ignored if greater than balance. |
| \*       |

### withdrawTradingFees

The feesController calls this function to withdraw fees
accrued from trading operations. \*

```js
function withdrawTradingFees(address token, address receiver, uint256 amount) external nonpayable whenNotPaused
returns(bool)
```

**Returns**

Whether withdrawal was successful.

**Arguments**

| Name     | Type    | Description                                                 |
| -------- | ------- | ----------------------------------------------------------- |
| token    | address | The address of the token instance.                          |
| receiver | address | The address of the withdrawal recipient.                    |
| amount   | uint256 | The amount of fees to get, ignored if greater than balance. |
| \*       |

### withdrawBorrowingFees

The feesController calls this function to withdraw fees
accrued from borrowing operations. \*

```js
function withdrawBorrowingFees(address token, address receiver, uint256 amount) external nonpayable whenNotPaused
returns(bool)
```

**Returns**

Whether withdrawal was successful.

**Arguments**

| Name     | Type    | Description                                                 |
| -------- | ------- | ----------------------------------------------------------- |
| token    | address | The address of the token instance.                          |
| receiver | address | The address of the withdrawal recipient.                    |
| amount   | uint256 | The amount of fees to get, ignored if greater than balance. |
| \*       |

### withdrawProtocolToken

The owner calls this function to withdraw protocol tokens. \*

```js
function withdrawProtocolToken(address receiver, uint256 amount) external nonpayable onlyOwner whenNotPaused
returns(address, bool)
```

**Returns**

The protocol token address.

**Arguments**

| Name     | Type    | Description                              |
| -------- | ------- | ---------------------------------------- |
| receiver | address | The address of the withdrawal recipient. |
| amount   | uint256 | The amount of tokens to get.             |
| \*       |

### depositProtocolToken

The owner calls this function to deposit protocol tokens. \*

```js
function depositProtocolToken(uint256 amount) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name   | Type    | Description                 |
| ------ | ------- | --------------------------- |
| amount | uint256 | The tokens of fees to send. |

### getLoanPoolsList

Get a list of loan pools. \*

```js
function getLoanPoolsList(uint256 start, uint256 count) external view
returns(bytes32[])
```

**Returns**

The array of loan pools.

**Arguments**

| Name  | Type    | Description |
| ----- | ------- | ----------- |
| start | uint256 | The offset. |
| count | uint256 | The limit.  |
| \*    |

### isLoanPool

Check whether a token is a pool token. \*

```js
function isLoanPool(address loanPool) external view
returns(bool)
```

**Arguments**

| Name     | Type    | Description                 |
| -------- | ------- | --------------------------- |
| loanPool | address | The token address to check. |

### setSovrynSwapContractRegistryAddress

Set the contract registry address of the SovrynSwap network. \*

```js
function setSovrynSwapContractRegistryAddress(address registryAddress) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name            | Type    | Description                           |
| --------------- | ------- | ------------------------------------- |
| registryAddress | address | the address of the registry contract. |

### setWrbtcToken

Set the wrBTC contract address. \*

```js
function setWrbtcToken(address wrbtcTokenAddress) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name              | Type    | Description                        |
| ----------------- | ------- | ---------------------------------- |
| wrbtcTokenAddress | address | The address of the wrBTC contract. |

### setProtocolTokenAddress

Set the protocol token contract address. \*

```js
function setProtocolTokenAddress(address _protocolTokenAddress) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name                   | Type    | Description                                 |
| ---------------------- | ------- | ------------------------------------------- |
| \_protocolTokenAddress | address | The address of the protocol token contract. |

### setRolloverBaseReward

Set rollover base reward. It should be denominated in wrBTC. \*

```js
function setRolloverBaseReward(uint256 baseRewardValue) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name            | Type    | Description      |
| --------------- | ------- | ---------------- |
| baseRewardValue | uint256 | The base reward. |

### setRebatePercent

Set the fee rebate percent. \*

```js
function setRebatePercent(uint256 rebatePercent) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name          | Type    | Description             |
| ------------- | ------- | ----------------------- |
| rebatePercent | uint256 | The fee rebate percent. |

### setSpecialRebates

Set the special fee rebate percent for specific pair \*

```js
function setSpecialRebates(address sourceToken, address destToken, uint256 specialRebatesPercent) external nonpayable onlyOwner whenNotPaused
```

**Arguments**

| Name                  | Type    | Description                         |
| --------------------- | ------- | ----------------------------------- |
| sourceToken           | address |                                     |
| destToken             | address |                                     |
| specialRebatesPercent | uint256 | The new special fee rebate percent. |

### getSpecialRebates

Get a rebate percent of specific pairs. \*

```js
function getSpecialRebates(address sourceTokenAddress, address destTokenAddress) external view
returns(specialRebatesPercent uint256)
```

**Returns**

The percent rebates of the pairs.

**Arguments**

| Name               | Type    | Description          |
| ------------------ | ------- | -------------------- |
| sourceTokenAddress | address | The source of pairs. |
| destTokenAddress   | address | The dest of pairs.   |
| \*                 |

### getProtocolAddress

```js
function getProtocolAddress() external view
returns(address)
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### getSovTokenAddress

```js
function getSovTokenAddress() external view
returns(address)
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### getLockedSOVAddress

```js
function getLockedSOVAddress() external view
returns(address)
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### getFeeRebatePercent

```js
function getFeeRebatePercent() external view
returns(uint256)
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### togglePaused

```js
function togglePaused(bool paused) external nonpayable onlyOwner
```

**Arguments**

| Name   | Type | Description |
| ------ | ---- | ----------- |
| paused | bool |             |

### isProtocolPaused

```js
function isProtocolPaused() external view
returns(bool)
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### getSwapExternalFeePercent

```js
function getSwapExternalFeePercent() external view
returns(uint256)
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### getTradingRebateRewardsBasisPoint

Get the basis point of trading rebate rewards. \*

```js
function getTradingRebateRewardsBasisPoint() external view
returns(uint256)
```

**Returns**

The basis point value.

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### getDedicatedSOVRebate

If SOV balance is less than the fees held, it will return 0. \*

```js
function getDedicatedSOVRebate() public view
returns(uint256)
```

**Returns**

total dedicated SOV.

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

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
