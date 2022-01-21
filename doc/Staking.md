# Staking contract. (Staking.sol)

View Source: [contracts/governance/Staking/Staking.sol](../contracts/governance/Staking/Staking.sol)

**↗ Extends: [IStaking](IStaking.md), [WeightedStaking](WeightedStaking.md), [ApprovalReceiver](ApprovalReceiver.md)**
**↘ Derived Contracts: [StakingMock](StakingMock.md), [StakingMockup](StakingMockup.md)**

**Staking**

Pay-in and pay-out function for staking and withdrawing tokens.
Staking is delegated and vested: To gain voting power, SOV holders must
stake their SOV for a given period of time. Aside from Bitocracy
participation, there's a financially-rewarding reason for staking SOV.
Tokenholders who stake their SOV receive staking rewards, a pro-rata share
of the revenue that the platform generates from various transaction fees
plus revenues from stakers who have a portion of their SOV slashed for
early unstaking.

## Contract Members

**Constants & Variables**

```js
uint256 internal constant FOUR_WEEKS;

```

## Functions

- [stake(uint96 amount, uint256 until, address stakeFor, address delegatee)](#stake)
- [stakeWithApproval(address sender, uint96 amount, uint256 until, address stakeFor, address delegatee)](#stakewithapproval)
- [\_stake(address sender, uint96 amount, uint256 until, address stakeFor, address delegatee, bool timeAdjusted)](#_stake)
- [extendStakingDuration(uint256 previousLock, uint256 until)](#extendstakingduration)
- [\_increaseStake(address sender, uint96 amount, address stakeFor, uint256 until)](#_increasestake)
- [stakesBySchedule(uint256 amount, uint256 cliff, uint256 duration, uint256 intervalLength, address stakeFor, address delegatee)](#stakesbyschedule)
- [withdraw(uint96 amount, uint256 until, address receiver)](#withdraw)
- [governanceWithdraw(uint96 amount, uint256 until, address receiver)](#governancewithdraw)
- [governanceWithdrawVesting(address vesting, address receiver)](#governancewithdrawvesting)
- [\_withdraw(uint96 amount, uint256 until, address receiver, bool isGovernance)](#_withdraw)
- [\_withdrawNext(uint96 amount, uint256 until, address receiver, bool isGovernance)](#_withdrawnext)
- [getWithdrawAmounts(uint96 amount, uint256 until)](#getwithdrawamounts)
- [\_getPunishedAmount(uint96 amount, uint256 until)](#_getpunishedamount)
- [\_validateWithdrawParams(uint96 amount, uint256 until)](#_validatewithdrawparams)
- [currentBalance(address account, uint256 lockDate)](#currentbalance)
- [balanceOf(address account)](#balanceof)
- [delegate(address delegatee, uint256 lockDate)](#delegate)
- [delegateBySig(address delegatee, uint256 lockDate, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s)](#delegatebysig)
- [getCurrentVotes(address account)](#getcurrentvotes)
- [getCurrentStakedUntil(uint256 lockedTS)](#getcurrentstakeduntil)
- [\_delegate(address delegator, address delegatee, uint256 lockedTS)](#_delegate)
- [\_delegateNext(address delegator, address delegatee, uint256 lockedTS)](#_delegatenext)
- [\_moveDelegates(address srcRep, address dstRep, uint96 amount, uint256 lockedTS)](#_movedelegates)
- [getChainId()](#getchainid)
- [setNewStakingContract(address \_newStakingContract)](#setnewstakingcontract)
- [setFeeSharing(address \_feeSharing)](#setfeesharing)
- [setWeightScaling(uint96 \_weightScaling)](#setweightscaling)
- [migrateToNewStakingContract()](#migratetonewstakingcontract)
- [unlockAllTokens()](#unlockalltokens)
- [getStakes(address account)](#getstakes)
- [\_getToken()](#_gettoken)
- [\_getSelectors()](#_getselectors)

### stake

⤾ overrides [IStaking.stake](IStaking.md#stake)

Stake the given amount for the given duration of time.

```js
function stake(uint96 amount, uint256 until, address stakeFor, address delegatee) external nonpayable
```

**Arguments**

| Name      | Type    | Description                                                        |
| --------- | ------- | ------------------------------------------------------------------ |
| amount    | uint96  | The number of tokens to stake.                                     |
| until     | uint256 | Timestamp indicating the date until which to stake.                |
| stakeFor  | address | The address to stake the tokens for or 0x0 if staking for oneself. |
| delegatee | address | The address of the delegatee or 0x0 if there is none.              |

### stakeWithApproval

Stake the given amount for the given duration of time.

```js
function stakeWithApproval(address sender, uint96 amount, uint256 until, address stakeFor, address delegatee) public nonpayable onlyThisContract
```

**Arguments**

| Name      | Type    | Description                                                        |
| --------- | ------- | ------------------------------------------------------------------ |
| sender    | address | The sender of SOV.approveAndCall                                   |
| amount    | uint96  | The number of tokens to stake.                                     |
| until     | uint256 | Timestamp indicating the date until which to stake.                |
| stakeFor  | address | The address to stake the tokens for or 0x0 if staking for oneself. |
| delegatee | address | The address of the delegatee or 0x0 if there is none.              |

### \_stake

Send sender's tokens to this contract and update its staked balance.

```js
function _stake(address sender, uint96 amount, uint256 until, address stakeFor, address delegatee, bool timeAdjusted) internal nonpayable
```

**Arguments**

| Name         | Type    | Description                                              |
| ------------ | ------- | -------------------------------------------------------- |
| sender       | address | The sender of the tokens.                                |
| amount       | uint96  | The number of tokens to send.                            |
| until        | uint256 | The date until which the tokens will be staked.          |
| stakeFor     | address | The beneficiary whose stake will be increased.           |
| delegatee    | address | The address of the delegatee or stakeFor if default 0x0. |
| timeAdjusted | bool    | Whether fixing date to stacking periods or not.          |

### extendStakingDuration

Extend the staking duration until the specified date.

```js
function extendStakingDuration(uint256 previousLock, uint256 until) public nonpayable
```

**Arguments**

| Name         | Type    | Description                             |
| ------------ | ------- | --------------------------------------- |
| previousLock | uint256 | The old unlocking timestamp.            |
| until        | uint256 | The new unlocking timestamp in seconds. |

### \_increaseStake

Send sender's tokens to this contract and update its staked balance.

```js
function _increaseStake(address sender, uint96 amount, address stakeFor, uint256 until) internal nonpayable
```

**Arguments**

| Name     | Type    | Description                                     |
| -------- | ------- | ----------------------------------------------- |
| sender   | address | The sender of the tokens.                       |
| amount   | uint96  | The number of tokens to send.                   |
| stakeFor | address | The beneficiary whose stake will be increased.  |
| until    | uint256 | The date until which the tokens will be staked. |

### stakesBySchedule

⤾ overrides [IStaking.stakesBySchedule](IStaking.md#stakesbyschedule)

Stake tokens according to the vesting schedule.

```js
function stakesBySchedule(uint256 amount, uint256 cliff, uint256 duration, uint256 intervalLength, address stakeFor, address delegatee) public nonpayable
```

**Arguments**

| Name           | Type    | Description                                                        |
| -------------- | ------- | ------------------------------------------------------------------ |
| amount         | uint256 | The amount of tokens to stake.                                     |
| cliff          | uint256 | The time interval to the first withdraw.                           |
| duration       | uint256 | The staking duration.                                              |
| intervalLength | uint256 | The length of each staking interval when cliff passed.             |
| stakeFor       | address | The address to stake the tokens for or 0x0 if staking for oneself. |
| delegatee      | address | The address of the delegatee or 0x0 if there is none.              |

### withdraw

Withdraw the given amount of tokens if they are unlocked.

```js
function withdraw(uint96 amount, uint256 until, address receiver) public nonpayable
```

**Arguments**

| Name     | Type    | Description                                                          |
| -------- | ------- | -------------------------------------------------------------------- |
| amount   | uint96  | The number of tokens to withdraw.                                    |
| until    | uint256 | The date until which the tokens were staked.                         |
| receiver | address | The receiver of the tokens. If not specified, send to the msg.sender |

### governanceWithdraw

Withdraw the given amount of tokens.

```js
function governanceWithdraw(uint96 amount, uint256 until, address receiver) public nonpayable
```

**Arguments**

| Name     | Type    | Description                                                          |
| -------- | ------- | -------------------------------------------------------------------- |
| amount   | uint96  | The number of tokens to withdraw.                                    |
| until    | uint256 | The date until which the tokens were staked.                         |
| receiver | address | The receiver of the tokens. If not specified, send to the msg.sender |

### governanceWithdrawVesting

Withdraw tokens for vesting contract.

```js
function governanceWithdrawVesting(address vesting, address receiver) public nonpayable onlyAuthorized
```

**Arguments**

| Name     | Type    | Description                                                          |
| -------- | ------- | -------------------------------------------------------------------- |
| vesting  | address | The address of Vesting contract.                                     |
| receiver | address | The receiver of the tokens. If not specified, send to the msg.sender |

### \_withdraw

Send user' staked tokens to a receiver taking into account punishments.
Sovryn encourages long-term commitment and thinking. When/if you unstake before
the end of the staking period, a percentage of the original staking amount will
be slashed. This amount is also added to the reward pool and is distributed
between all other stakers. \*

```js
function _withdraw(uint96 amount, uint256 until, address receiver, bool isGovernance) internal nonpayable
```

**Arguments**

| Name                             | Type    | Description                                                          |
| -------------------------------- | ------- | -------------------------------------------------------------------- |
| amount                           | uint96  | The number of tokens to withdraw.                                    |
| until                            | uint256 | The date until which the tokens were staked.                         |
| receiver                         | address | The receiver of the tokens. If not specified, send to the msg.sender |
| isGovernance                     | bool    | Whether all tokens (true)                                            |
| or just unlocked tokens (false). |

### \_withdrawNext

```js
function _withdrawNext(uint96 amount, uint256 until, address receiver, bool isGovernance) internal nonpayable
```

**Arguments**

| Name         | Type    | Description |
| ------------ | ------- | ----------- |
| amount       | uint96  |             |
| until        | uint256 |             |
| receiver     | address |             |
| isGovernance | bool    |             |

### getWithdrawAmounts

Get available and punished amount for withdrawing.

```js
function getWithdrawAmounts(uint96 amount, uint256 until) public view
returns(uint96, uint96)
```

**Arguments**

| Name   | Type    | Description                                  |
| ------ | ------- | -------------------------------------------- |
| amount | uint96  | The number of tokens to withdraw.            |
| until  | uint256 | The date until which the tokens were staked. |

### \_getPunishedAmount

Get punished amount for withdrawing.

```js
function _getPunishedAmount(uint96 amount, uint256 until) internal view
returns(uint96)
```

**Arguments**

| Name   | Type    | Description                                  |
| ------ | ------- | -------------------------------------------- |
| amount | uint96  | The number of tokens to withdraw.            |
| until  | uint256 | The date until which the tokens were staked. |

### \_validateWithdrawParams

Validate withdraw parameters.

```js
function _validateWithdrawParams(uint96 amount, uint256 until) internal view
```

**Arguments**

| Name   | Type    | Description                                  |
| ------ | ------- | -------------------------------------------- |
| amount | uint96  | The number of tokens to withdraw.            |
| until  | uint256 | The date until which the tokens were staked. |

### currentBalance

Get the current balance of an account locked until a certain date.

```js
function currentBalance(address account, uint256 lockDate) internal view
returns(uint96)
```

**Returns**

The stake amount.

**Arguments**

| Name     | Type    | Description       |
| -------- | ------- | ----------------- |
| account  | address | The user address. |
| lockDate | uint256 | The lock date.    |

### balanceOf

Get the number of staked tokens held by the user account.

```js
function balanceOf(address account) public view
returns(balance uint96)
```

**Returns**

The number of tokens held.

**Arguments**

| Name    | Type    | Description                                       |
| ------- | ------- | ------------------------------------------------- |
| account | address | The address of the account to get the balance of. |

### delegate

Delegate votes from `msg.sender` which are locked until lockDate to `delegatee`.

```js
function delegate(address delegatee, uint256 lockDate) public nonpayable
```

**Arguments**

| Name      | Type    | Description                           |
| --------- | ------- | ------------------------------------- |
| delegatee | address | The address to delegate votes to.     |
| lockDate  | uint256 | the date if the position to delegate. |

### delegateBySig

Delegates votes from signatory to a delegatee account.
Voting with EIP-712 Signatures.
_ Voting power can be delegated to any address, and then can be used to
vote on proposals. A key benefit to users of by-signature functionality
is that they can create a signed vote transaction for free, and have a
trusted third-party spend rBTC(or ETH) on gas fees and write it to the
blockchain for them.
_ The third party in this scenario, submitting the SOV-holder’s signed
transaction holds a voting power that is for only a single proposal.
The signatory still holds the power to vote on their own behalf in
the proposal if the third party has not yet published the signed
transaction that was given to them. \*

```js
function delegateBySig(address delegatee, uint256 lockDate, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) public nonpayable
```

**Arguments**

| Name      | Type    | Description                                         |
| --------- | ------- | --------------------------------------------------- |
| delegatee | address | The address to delegate votes to.                   |
| lockDate  | uint256 | The date until which the position is locked.        |
| nonce     | uint256 | The contract state required to match the signature. |
| expiry    | uint256 | The time at which to expire the signature.          |
| v         | uint8   | The recovery byte of the signature.                 |
| r         | bytes32 | Half of the ECDSA signature pair.                   |
| s         | bytes32 | Half of the ECDSA signature pair.                   |

### getCurrentVotes

Get the current votes balance for a user account.

```js
function getCurrentVotes(address account) external view
returns(uint96)
```

**Returns**

The number of current votes for a user account.

**Arguments**

| Name    | Type    | Description                       |
| ------- | ------- | --------------------------------- |
| account | address | The address to get votes balance. |

### getCurrentStakedUntil

Get the current number of tokens staked for a day.

```js
function getCurrentStakedUntil(uint256 lockedTS) external view
returns(uint96)
```

**Arguments**

| Name     | Type    | Description                                 |
| -------- | ------- | ------------------------------------------- |
| lockedTS | uint256 | The timestamp to get the staked tokens for. |

### \_delegate

Set new delegatee. Move from user's current delegate to a new
delegatee the stake balance.

```js
function _delegate(address delegator, address delegatee, uint256 lockedTS) internal nonpayable
```

**Arguments**

| Name      | Type    | Description                                                        |
| --------- | ------- | ------------------------------------------------------------------ |
| delegator | address | The user address to move stake balance from its current delegatee. |
| delegatee | address | The new delegatee. The address to move stake balance to.           |
| lockedTS  | uint256 | The lock date.                                                     |

### \_delegateNext

```js
function _delegateNext(address delegator, address delegatee, uint256 lockedTS) internal nonpayable
```

**Arguments**

| Name      | Type    | Description |
| --------- | ------- | ----------- |
| delegator | address |             |
| delegatee | address |             |
| lockedTS  | uint256 |             |

### \_moveDelegates

Move an amount of delegate stake from a source address to a
destination address.

```js
function _moveDelegates(address srcRep, address dstRep, uint96 amount, uint256 lockedTS) internal nonpayable
```

**Arguments**

| Name     | Type    | Description                                |
| -------- | ------- | ------------------------------------------ |
| srcRep   | address | The address to get the staked amount from. |
| dstRep   | address | The address to send the staked amount to.  |
| amount   | uint96  | The staked amount to move.                 |
| lockedTS | uint256 | The lock date.                             |

### getChainId

Retrieve CHAIN*ID of the executing chain.
* Chain identifier (chainID) introduced in EIP-155 protects transaction
included into one chain from being included into another chain.
Basically, chain identifier is an integer number being used in the
processes of signing transactions and verifying transaction signatures.
\_

```js
function getChainId() internal pure
returns(uint256)
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### setNewStakingContract

Allow the owner to set a new staking contract.
As a consequence it allows the stakers to migrate their positions
to the new contract.

```js
function setNewStakingContract(address _newStakingContract) public nonpayable onlyOwner
```

**Arguments**

| Name                 | Type    | Description                              |
| -------------------- | ------- | ---------------------------------------- |
| \_newStakingContract | address | The address of the new staking contract. |

### setFeeSharing

Allow the owner to set a fee sharing proxy contract.
We need it for unstaking with slashing.

```js
function setFeeSharing(address _feeSharing) public nonpayable onlyOwner
```

**Arguments**

| Name         | Type    | Description                              |
| ------------ | ------- | ---------------------------------------- |
| \_feeSharing | address | The address of FeeSharingProxy contract. |

### setWeightScaling

Allow the owner to set weight scaling.
We need it for unstaking with slashing.

```js
function setWeightScaling(uint96 _weightScaling) public nonpayable onlyOwner
```

**Arguments**

| Name            | Type   | Description         |
| --------------- | ------ | ------------------- |
| \_weightScaling | uint96 | The weight scaling. |

### migrateToNewStakingContract

Allow a staker to migrate his positions to the new staking contract.

```js
function migrateToNewStakingContract() public nonpayable
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### unlockAllTokens

Allow the owner to unlock all tokens in case the staking contract
is going to be replaced
Note: Not reversible on purpose. once unlocked, everything is unlocked.
The owner should not be able to just quickly unlock to withdraw his own
tokens and lock again.

```js
function unlockAllTokens() public nonpayable onlyOwner
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### getStakes

Get list of stakes for a user account.

```js
function getStakes(address account) public view
returns(dates uint256[], stakes uint96[])
```

**Returns**

The arrays of dates and stakes.

**Arguments**

| Name    | Type    | Description                |
| ------- | ------- | -------------------------- |
| account | address | The address to get stakes. |

### \_getToken

⤾ overrides [ApprovalReceiver.\_getToken](ApprovalReceiver.md#_gettoken)

Overrides default ApprovalReceiver.\_getToken function to
register SOV token on this contract.

```js
function _getToken() internal view
returns(address)
```

**Returns**

The address of SOV token.

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### \_getSelectors

⤾ overrides [ApprovalReceiver.\_getSelectors](ApprovalReceiver.md#_getselectors)

Overrides default ApprovalReceiver.\_getSelectors function to
register stakeWithApproval selector on this contract.

```js
function _getSelectors() internal view
returns(bytes4[])
```

**Returns**

The array of registered selectors on this contract.

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
