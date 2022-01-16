# The FeeSharingLogic contract. (ILoanToken.sol)

View Source: [contracts/governance/FeeSharingProxy/FeeSharingLogic.sol](../contracts/governance/FeeSharingProxy/FeeSharingLogic.sol)

**↗ Extends: [SafeMath96](SafeMath96.md), [IFeeSharingProxy](IFeeSharingProxy.md), [Ownable](Ownable.md), [FeeSharingProxyStorage](FeeSharingProxyStorage.md)**

**ILoanToken**

Staking is not only granting voting rights, but also access to fee
sharing according to the own voting power in relation to the total. Whenever
somebody decides to collect the fees from the protocol, they get transferred
to a proxy contract which invests the funds in the lending pool and keeps
the pool tokens.
 * The fee sharing proxy will be set as feesController of the protocol contract.
This allows the fee sharing proxy to withdraw the fees. The fee sharing
proxy holds the pool tokens and keeps track of which user owns how many
tokens. In order to know how many tokens a user owns, the fee sharing proxy
needs to know the user’s weighted stake in relation to the total weighted
stake (aka total voting power).
 * Because both values are subject to change, they may be different on each fee
withdrawal. To be able to calculate a user’s share of tokens when he wants
to withdraw, we need checkpoints.
 * This contract is intended to be set as the protocol fee collector.
Anybody can invoke the withdrawFees function which uses
protocol.withdrawFees to obtain available fees from operations on a
certain token. These fees are deposited in the corresponding loanPool.
Also, the staking contract sends slashed tokens to this contract. When a
user calls the withdraw function, the contract transfers the fee sharing
rewards in proportion to the user’s weighted stake since the last withdrawal.
 * The protocol is collecting fees in all sorts of currencies and then automatically
supplies them to the respective lending pools. Therefore, all fees are
generating interest for the SOV holders. If one of them withdraws fees, it will
get pool tokens. It is planned to add the option to convert anything to rBTC
before withdrawing, but not yet implemented.

**Events**

```js
event FeeWithdrawn(address indexed sender, address indexed token, uint256  amount);
event TokensTransferred(address indexed sender, address indexed token, uint256  amount);
event CheckpointAdded(address indexed sender, address indexed token, uint256  amount);
event UserFeeWithdrawn(address indexed sender, address indexed receiver, address indexed token, uint256  amount);
event FeeAMMWithdrawn(address indexed sender, address indexed converter, uint256  amount);
event WhitelistedConverter(address indexed sender, address  converter);
event UnwhitelistedConverter(address indexed sender, address  converter);
```

## Functions

- [withdrawFees(address[] _tokens)](#withdrawfees)
- [withdrawFeesAMM(address[] _converters)](#withdrawfeesamm)
- [transferTokens(address _token, uint96 _amount)](#transfertokens)
- [_addCheckpoint(address _token, uint96 _amount)](#_addcheckpoint)
- [withdraw(address _loanPoolToken, uint32 _maxCheckpoints, address _receiver)](#withdraw)
- [getAccumulatedFees(address _user, address _loanPoolToken)](#getaccumulatedfees)
- [_getAccumulatedFees(address _user, address _loanPoolToken, uint32 _maxCheckpoints)](#_getaccumulatedfees)
- [_getEndOfRange(uint256 start, address _loanPoolToken, uint32 _maxCheckpoints)](#_getendofrange)
- [_writeTokenCheckpoint(address _token, uint96 _numTokens)](#_writetokencheckpoint)
- [_getVoluntaryWeightedStake(uint32 blockNumber, uint256 timestamp)](#_getvoluntaryweightedstake)
- [addWhitelistedConverterAddress(address converterAddress)](#addwhitelistedconverteraddress)
- [removeWhitelistedConverterAddress(address converterAddress)](#removewhitelistedconverteraddress)
- [getWhitelistedConverterList()](#getwhitelistedconverterlist)
- [_validateWhitelistedConverter(address[] converterAddresses)](#_validatewhitelistedconverter)
- [withdrawWRBTC(address receiver, uint256 wrbtcAmount)](#withdrawwrbtc)
- [mint(address receiver, uint256 depositAmount)](#mint)
- [burnToBTC(address receiver, uint256 burnAmount, bool useLM)](#burntobtc)

### withdrawFees

⤾ overrides [IFeeSharingProxy.withdrawFees](IFeeSharingProxy.md#withdrawfees)

Withdraw fees for the given token:
lendingFee + tradingFee + borrowingFee
the fees (except SOV) will be converted in wRBTC form, and then will be transferred to wRBTC loan pool.
For SOV, it will be directly deposited into the feeSharingProxy from the protocol.
	 *

```js
function withdrawFees(address[] _tokens) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokens | address[] | array address of the token | 

### withdrawFeesAMM

Withdraw amm fees for the given converter addresses:
protocolFee from the conversion
the fees will be converted in wRBTC form, and then will be transferred to wRBTC loan pool
	 *

```js
function withdrawFeesAMM(address[] _converters) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _converters | address[] | array addresses of the converters | 

### transferTokens

⤾ overrides [IFeeSharingProxy.transferTokens](IFeeSharingProxy.md#transfertokens)

Transfer tokens to this contract.

```js
function transferTokens(address _token, uint96 _amount) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _token | address | Address of the token. | 
| _amount | uint96 | Amount to be transferred. | 

### _addCheckpoint

Add checkpoint with accumulated amount by function invocation.

```js
function _addCheckpoint(address _token, uint96 _amount) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _token | address | Address of the token. | 
| _amount | uint96 |  | 

### withdraw

⤾ overrides [IFeeSharingProxy.withdraw](IFeeSharingProxy.md#withdraw)

⤿ Overridden Implementation(s): [FeeSharingProxyMockup.withdraw](FeeSharingProxyMockup.md#withdraw)

Withdraw accumulated fee to the message sender.
	 * The Sovryn protocol collects fees on every trade/swap and loan.
These fees will be distributed to SOV stakers based on their voting
power as a percentage of total voting power. Therefore, staking more
SOV and/or staking for longer will increase your share of the fees
generated, meaning you will earn more from staking.
	 * This function will directly burnToBTC and use the msg.sender (user) as the receiver
	 *

```js
function withdraw(address _loanPoolToken, uint32 _maxCheckpoints, address _receiver) public nonpayable nonReentrant 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _loanPoolToken | address | Address of the pool token. | 
| _maxCheckpoints | uint32 | Maximum number of checkpoints to be processed. | 
| _receiver | address | The receiver of tokens or msg.sender | 

### getAccumulatedFees

Get the accumulated loan pool fee of the message sender.

```js
function getAccumulatedFees(address _user, address _loanPoolToken) public view
returns(uint256)
```

**Returns**

The accumulated fee for the message sender.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | The address of the user or contract. | 
| _loanPoolToken | address | Address of the pool token. | 

### _getAccumulatedFees

Whenever fees are withdrawn, the staking contract needs to
checkpoint the block number, the number of pool tokens and the
total voting power at that time (read from the staking contract).
While the total voting power would not necessarily need to be
checkpointed, it makes sense to save gas cost on withdrawal.
	 * When the user wants to withdraw its share of tokens, we need
to iterate over all of the checkpoints since the users last
withdrawal (note: remember last withdrawal block), query the
user’s balance at the checkpoint blocks from the staking contract,
compute his share of the checkpointed tokens and add them up.
The maximum number of checkpoints to process at once should be limited.
	 *

```js
function _getAccumulatedFees(address _user, address _loanPoolToken, uint32 _maxCheckpoints) internal view
returns(uint256, uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | Address of the user's account. | 
| _loanPoolToken | address | Loan pool token address. | 
| _maxCheckpoints | uint32 | Checkpoint index incremental. | 

### _getEndOfRange

Withdrawal should only be possible for blocks which were already
mined. If the fees are withdrawn in the same block as the user withdrawal
they are not considered by the withdrawing logic (to avoid inconsistencies).
	 *

```js
function _getEndOfRange(uint256 start, address _loanPoolToken, uint32 _maxCheckpoints) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| start | uint256 | Start of the range. | 
| _loanPoolToken | address | Loan pool token address. | 
| _maxCheckpoints | uint32 | Checkpoint index incremental. | 

### _writeTokenCheckpoint

Write a regular checkpoint w/ the foolowing data:
block number, block timestamp, total weighted stake and num of tokens.

```js
function _writeTokenCheckpoint(address _token, uint96 _numTokens) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _token | address | The pool token address. | 
| _numTokens | uint96 | The amount of pool tokens. | 

### _getVoluntaryWeightedStake

```js
function _getVoluntaryWeightedStake(uint32 blockNumber, uint256 timestamp) internal view
returns(totalWeightedStake uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| blockNumber | uint32 | the blocknumber | 
| timestamp | uint256 | the timestamp | 

### addWhitelistedConverterAddress

Whitelisting converter address.
	 *

```js
function addWhitelistedConverterAddress(address converterAddress) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| converterAddress | address | converter address to be whitelisted. | 

### removeWhitelistedConverterAddress

Removing converter address from whitelist.
	 *

```js
function removeWhitelistedConverterAddress(address converterAddress) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| converterAddress | address | converter address to be removed from whitelist. | 

### getWhitelistedConverterList

Getter to query all of the whitelisted converter.

```js
function getWhitelistedConverterList() external view
returns(converterList address[])
```

**Returns**

All of the whitelisted converter list.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### _validateWhitelistedConverter

validate array of given address whether is whitelisted or not.

```js
function _validateWhitelistedConverter(address[] converterAddresses) private view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| converterAddresses | address[] | array of converter addresses. | 

### withdrawWRBTC

```js
function withdrawWRBTC(address receiver, uint256 wrbtcAmount) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| wrbtcAmount | uint256 |  | 

### mint

```js
function mint(address receiver, uint256 depositAmount) external nonpayable
returns(mintAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| depositAmount | uint256 |  | 

### burnToBTC

```js
function burnToBTC(address receiver, uint256 burnAmount, bool useLM) external nonpayable
returns(loanAmountPaid uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| burnAmount | uint256 |  | 
| useLM | bool |  | 

## Contracts

* [Address](Address.md)
* [Administered](Administered.md)
* [AdminRole](AdminRole.md)
* [AdvancedToken](AdvancedToken.md)
* [AdvancedTokenStorage](AdvancedTokenStorage.md)
* [Affiliates](Affiliates.md)
* [AffiliatesEvents](AffiliatesEvents.md)
* [ApprovalReceiver](ApprovalReceiver.md)
* [BlockMockUp](BlockMockUp.md)
* [BProPriceFeed](BProPriceFeed.md)
* [BProPriceFeedMockup](BProPriceFeedMockup.md)
* [Checkpoints](Checkpoints.md)
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
* [FeeSharingProxyMockup](FeeSharingProxyMockup.md)
* [FeeSharingProxyStorage](FeeSharingProxyStorage.md)
* [FeesHelper](FeesHelper.md)
* [FlashLoanerTest](FlashLoanerTest.md)
* [GenericTokenSender](GenericTokenSender.md)
* [GovernorAlpha](GovernorAlpha.md)
* [GovernorAlphaMockup](GovernorAlphaMockup.md)
* [GovernorVault](GovernorVault.md)
* [IApproveAndCall](IApproveAndCall.md)
* [IChai](IChai.md)
* [IContractRegistry](IContractRegistry.md)
* [IConverterAMM](IConverterAMM.md)
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IFeeSharingProxy](IFeeSharingProxy.md)
* [ILiquidityMining](ILiquidityMining.md)
* [ILiquidityPoolV1Converter](ILiquidityPoolV1Converter.md)
* [ILoanPool](ILoanPool.md)
* [ILoanToken](ILoanToken.md)
* [ILoanTokenLogicBeacon](ILoanTokenLogicBeacon.md)
* [ILoanTokenLogicModules](ILoanTokenLogicModules.md)
* [ILoanTokenLogicProxy](ILoanTokenLogicProxy.md)
* [ILoanTokenModules](ILoanTokenModules.md)
* [ILoanTokenModulesMock](ILoanTokenModulesMock.md)
* [ILoanTokenWRBTC](ILoanTokenWRBTC.md)
* [ILockedSOV](ILockedSOV.md)
* [IMoCState](IMoCState.md)
* [ImplementationMockup](ImplementationMockup.md)
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
* [ITokenFlashLoanTest](ITokenFlashLoanTest.md)
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
* [LiquidityMiningMockup](LiquidityMiningMockup.md)
* [LiquidityMiningProxy](LiquidityMiningProxy.md)
* [LiquidityMiningStorage](LiquidityMiningStorage.md)
* [LiquidityPoolV1ConverterMockup](LiquidityPoolV1ConverterMockup.md)
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
* [LoanTokenLogicLMMockup](LoanTokenLogicLMMockup.md)
* [LoanTokenLogicLMV1Mockup](LoanTokenLogicLMV1Mockup.md)
* [LoanTokenLogicLMV2Mockup](LoanTokenLogicLMV2Mockup.md)
* [LoanTokenLogicProxy](LoanTokenLogicProxy.md)
* [LoanTokenLogicStandard](LoanTokenLogicStandard.md)
* [LoanTokenLogicStorage](LoanTokenLogicStorage.md)
* [LoanTokenLogicTest](LoanTokenLogicTest.md)
* [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)
* [LoanTokenSettingsLowerAdmin](LoanTokenSettingsLowerAdmin.md)
* [LockedSOV](LockedSOV.md)
* [LockedSOVFailedMockup](LockedSOVFailedMockup.md)
* [LockedSOVMockup](LockedSOVMockup.md)
* [Medianizer](Medianizer.md)
* [MockAffiliates](MockAffiliates.md)
* [MockLoanTokenLogic](MockLoanTokenLogic.md)
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
* [PriceFeedRSKOracleMockup](PriceFeedRSKOracleMockup.md)
* [PriceFeeds](PriceFeeds.md)
* [PriceFeedsConstants](PriceFeedsConstants.md)
* [PriceFeedsMoC](PriceFeedsMoC.md)
* [PriceFeedsMoCMockup](PriceFeedsMoCMockup.md)
* [PriceFeedV1PoolOracle](PriceFeedV1PoolOracle.md)
* [ProtocolAffiliatesInterface](ProtocolAffiliatesInterface.md)
* [ProtocolLike](ProtocolLike.md)
* [ProtocolSettings](ProtocolSettings.md)
* [ProtocolSettingsEvents](ProtocolSettingsEvents.md)
* [ProtocolSettingsLike](ProtocolSettingsLike.md)
* [ProtocolSettingsMockup](ProtocolSettingsMockup.md)
* [ProtocolSwapExternalInterface](ProtocolSwapExternalInterface.md)
* [ProtocolTokenUser](ProtocolTokenUser.md)
* [Proxy](Proxy.md)
* [ProxyMockup](ProxyMockup.md)
* [RBTCWrapperProxyMockup](RBTCWrapperProxyMockup.md)
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
* [StakingMock](StakingMock.md)
* [StakingMockup](StakingMockup.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsMockUp](StakingRewardsMockUp.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingStorage](StakingStorage.md)
* [State](State.md)
* [StorageMockup](StorageMockup.md)
* [SVR](SVR.md)
* [SwapsEvents](SwapsEvents.md)
* [SwapsExternal](SwapsExternal.md)
* [SwapsImplLocal](SwapsImplLocal.md)
* [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md)
* [SwapsUser](SwapsUser.md)
* [TeamVesting](TeamVesting.md)
* [TestCoverage](TestCoverage.md)
* [TestLibraries](TestLibraries.md)
* [TestSovrynSwap](TestSovrynSwap.md)
* [TestToken](TestToken.md)
* [TestWrbtc](TestWrbtc.md)
* [Timelock](Timelock.md)
* [TimelockHarness](TimelockHarness.md)
* [TimelockInterface](TimelockInterface.md)
* [TimelockTest](TimelockTest.md)
* [TokenSender](TokenSender.md)
* [UpgradableProxy](UpgradableProxy.md)
* [USDTPriceFeed](USDTPriceFeed.md)
* [VaultController](VaultController.md)
* [Vesting](Vesting.md)
* [VestingCreator](VestingCreator.md)
* [VestingFactory](VestingFactory.md)
* [VestingLogic](VestingLogic.md)
* [VestingLogicMockup](VestingLogicMockup.md)
* [VestingRegistry](VestingRegistry.md)
* [VestingRegistry2](VestingRegistry2.md)
* [VestingRegistry3](VestingRegistry3.md)
* [VestingRegistryLogic](VestingRegistryLogic.md)
* [VestingRegistryLogicMockup](VestingRegistryLogicMockup.md)
* [VestingRegistryProxy](VestingRegistryProxy.md)
* [VestingRegistryStorage](VestingRegistryStorage.md)
* [VestingStorage](VestingStorage.md)
* [WeightedStaking](WeightedStaking.md)
* [WRBTC](WRBTC.md)
