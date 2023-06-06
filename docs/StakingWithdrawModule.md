# Staking withdrawal functionality module* (StakingWithdrawModule.sol)

View Source: [contracts/governance/Staking/modules/StakingWithdrawModule.sol](../contracts/governance/Staking/modules/StakingWithdrawModule.sol)

**↗ Extends: [IFunctionsList](IFunctionsList.md), [StakingShared](StakingShared.md), [CheckpointsShared](CheckpointsShared.md)**

**StakingWithdrawModule**

## Structs
### VestingConfig

```js
struct VestingConfig {
 address vestingAddress,
 uint256 startDate,
 uint256 endDate,
 uint256 cliff,
 uint256 duration,
 address tokenOwner
}
```

**Events**

```js
event MaxVestingWithdrawIterationsUpdated(uint256  oldMaxIterations, uint256  newMaxIterations);
event StakingWithdrawn(address indexed staker, uint256  amount, uint256  until, address indexed receiver, bool  isGovernance);
event VestingTokensWithdrawn(address  vesting, address  receiver);
event TokensUnlocked(uint256  amount);
```

## Functions

- [withdraw(uint96 amount, uint256 until, address receiver)](#withdraw)
- [cancelTeamVesting(address vesting, address receiver, uint256 startFrom)](#cancelteamvesting)
- [_cancelTeamVesting(address _vesting, address _receiver, uint256 _startFrom)](#_cancelteamvesting)
- [_withdraw(uint96 amount, uint256 until, address receiver, bool isGovernance)](#_withdraw)
- [_withdrawFromTeamVesting(uint96 amount, uint256 until, address receiver, struct StakingWithdrawModule.VestingConfig vestingConfig)](#_withdrawfromteamvesting)
- [_withdrawNext(uint256 until, address receiver, bool isGovernance)](#_withdrawnext)
- [getWithdrawAmounts(uint96 amount, uint256 until)](#getwithdrawamounts)
- [_getPunishedAmount(uint96 amount, uint256 until)](#_getpunishedamount)
- [_validateWithdrawParams(address account, uint96 amount, uint256 until)](#_validatewithdrawparams)
- [unlockAllTokens()](#unlockalltokens)
- [setMaxVestingWithdrawIterations(uint256 newMaxIterations)](#setmaxvestingwithdrawiterations)
- [governanceWithdrawVesting(address vesting, address receiver)](#governancewithdrawvesting)
- [governanceWithdraw(uint96 amount, uint256 until, address receiver)](#governancewithdraw)
- [getFunctionsList()](#getfunctionslist)

---    

> ### withdraw

Withdraw the given amount of tokens if they are unlocked.

```solidity
function withdraw(uint96 amount, uint256 until, address receiver) external nonpayable whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint96 | The number of tokens to withdraw. | 
| until | uint256 | The date until which the tokens were staked. | 
| receiver | address | The receiver of the tokens. If not specified, send to the msg.sender | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdraw(
        uint96 amount,
        uint256 until,
        address receiver
    ) external whenNotFrozen {
        // adjust until here to avoid adjusting multiple times, and to make sure an adjusted date is passed to
        // _notSameBlockAsStakingCheckpoint
        until = _adjustDateForOrigin(until);

        _notSameBlockAsStakingCheckpoint(until, msg.sender);

        _withdraw(amount, until, receiver, false);
        // @dev withdraws tokens for lock date 2 weeks later than given lock date if sender is a contract
        //		we need to check block.timestamp here
        _withdrawNext(until, receiver, false);
    }
```
</details>

---    

> ### cancelTeamVesting

Governance withdraw vesting directly through staking contract.
This direct withdraw vesting solves the out of gas issue when there are too many iterations when withdrawing.
This function only allows cancelling vesting contract of the TeamVesting type.
     *

```solidity
function cancelTeamVesting(address vesting, address receiver, uint256 startFrom) external nonpayable onlyAuthorized whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vesting | address | The vesting address. | 
| receiver | address | The receiving address. | 
| startFrom | uint256 | The start value for the iterations. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function cancelTeamVesting(
        address vesting,
        address receiver,
        uint256 startFrom
    ) external onlyAuthorized whenNotFrozen {
        /// require the caller only for team vesting contract.
        require(vestingRegistryLogic.isTeamVesting(vesting), "Only team vesting allowed");

        _cancelTeamVesting(vesting, receiver, startFrom);
    }
```
</details>

---    

> ### _cancelTeamVesting

Withdraws tokens from the staking contract and forwards them
to an address specified by the token owner. Low level function.

```solidity
function _cancelTeamVesting(address _vesting, address _receiver, uint256 _startFrom) private nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vesting | address | The vesting address. | 
| _receiver | address | The receiving address. | 
| _startFrom | uint256 | The start value for the iterations. or just unlocked tokens (false). | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _cancelTeamVesting(
        address _vesting,
        address _receiver,
        uint256 _startFrom
    ) private {
        require(_receiver != address(0), "receiver address invalid");

        ITeamVesting teamVesting = ITeamVesting(_vesting);

        VestingConfig memory vestingConfig =
            VestingConfig(
                _vesting,
                teamVesting.startDate(),
                teamVesting.endDate(),
                teamVesting.cliff(),
                teamVesting.duration(),
                teamVesting.tokenOwner()
            );

        /// @dev In the unlikely case that all tokens have been unlocked early,
        /// allow to withdraw all of them, as long as the itrations less than maxVestingWithdrawIterations.
        uint256 end = vestingConfig.endDate;

        uint256 defaultStart = vestingConfig.startDate + vestingConfig.cliff;

        _startFrom = _startFrom >= defaultStart ? _startFrom : defaultStart;

        /// @dev max iterations need to be decreased by 1, otherwise the iteration will always be surplus by 1
        uint256 totalIterationValue =
            (_startFrom + (TWO_WEEKS * (maxVestingWithdrawIterations - 1)));
        uint256 adjustedEnd = end < totalIterationValue ? end : totalIterationValue;

        /// @dev Withdraw for each unlocked position.
        for (uint256 i = _startFrom; i <= adjustedEnd; i += TWO_WEEKS) {
            /// @dev Read amount to withdraw.
            uint96 tempStake = _getPriorUserStakeByDate(_vesting, i, block.number - 1);

            if (tempStake > 0) {
                /// @dev do governance direct withdraw for team vesting
                _withdrawFromTeamVesting(tempStake, i, _receiver, vestingConfig);
            }
        }

        if (adjustedEnd < end) {
            emit TeamVestingPartiallyCancelled(msg.sender, _receiver, adjustedEnd);
        } else {
            emit TeamVestingCancelled(msg.sender, _receiver);
        }
    }
```
</details>

---    

> ### _withdraw

Send user' staked tokens to a receiver taking into account punishments.
Sovryn encourages long-term commitment and thinking. When/if you unstake before
the end of the staking period, a percentage of the original staking amount will
be slashed. This amount is also added to the reward pool and is distributed
between all other stakers.
     *

```solidity
function _withdraw(uint96 amount, uint256 until, address receiver, bool isGovernance) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint96 | The number of tokens to withdraw. | 
| until | uint256 | The date until which the tokens were staked. Needs to be adjusted to the next valid lock date before calling this function. | 
| receiver | address | The receiver of the tokens. If not specified, send to the msg.sender | 
| isGovernance | bool | Whether all tokens (true) or just unlocked tokens (false). | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _withdraw(
        uint96 amount,
        uint256 until,
        address receiver,
        bool isGovernance
    ) internal {
        // @dev it's very unlikely some one will have 1/10**18 SOV staked in Vesting contract
        //		this check is a part of workaround for Vesting.withdrawTokens issue
        if (amount == 1 && _isVestingContract(msg.sender)) {
            return;
        }
        _validateWithdrawParams(msg.sender, amount, until);

        /// @dev Determine the receiver.
        if (receiver == address(0)) receiver = msg.sender;

        /// @dev Update the checkpoints.
        _decreaseDailyStake(until, amount);
        _decreaseUserStake(msg.sender, until, amount);
        if (_isVestingContract(msg.sender)) _decreaseVestingStake(until, amount);
        _decreaseDelegateStake(delegates[msg.sender][until], until, amount);

        /// @dev Early unstaking should be punished.
        if (block.timestamp < until && !allUnlocked && !isGovernance) {
            uint96 punishedAmount = _getPunishedAmount(amount, until);
            amount -= punishedAmount;

            /// @dev punishedAmount can be 0 if block.timestamp are very close to 'until'
            if (punishedAmount > 0) {
                require(address(feeSharing) != address(0), "FeeSharing address wasn't set"); // S08
                /// @dev Move punished amount to fee sharing.
                /// @dev Approve transfer here and let feeSharing do transfer and write checkpoint.
                SOVToken.approve(address(feeSharing), punishedAmount);
                feeSharing.transferTokens(address(SOVToken), punishedAmount);
            }
        }

        /// @dev transferFrom
        bool success = SOVToken.transfer(receiver, amount);
        require(success, "Token transfer failed"); // S09

        emit StakingWithdrawn(msg.sender, amount, until, receiver, isGovernance);
    }
```
</details>

---    

> ### _withdrawFromTeamVesting

Send user' staked tokens to a receiver.
This function is dedicated only for direct withdrawal from staking contract.
Currently only being used by cancelTeamVesting()
     *

```solidity
function _withdrawFromTeamVesting(uint96 amount, uint256 until, address receiver, struct StakingWithdrawModule.VestingConfig vestingConfig) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint96 | The number of tokens to withdraw. | 
| until | uint256 | The date until which the tokens were staked. | 
| receiver | address | The receiver of the tokens. If not specified, send to the msg.sender. | 
| vestingConfig | struct StakingWithdrawModule.VestingConfig | The vesting config. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _withdrawFromTeamVesting(
        uint96 amount,
        uint256 until,
        address receiver,
        VestingConfig memory vestingConfig
    ) internal {
        address vesting = vestingConfig.vestingAddress;

        until = _timestampToLockDate(until);
        _validateWithdrawParams(vesting, amount, until);

        /// @dev Update the checkpoints.
        _decreaseDailyStake(until, amount);
        _decreaseUserStake(vesting, until, amount);

        _decreaseVestingStake(until, amount);
        _decreaseDelegateStake(delegates[vesting][until], until, amount);

        /// @dev transferFrom
        bool success = SOVToken.transfer(receiver, amount);
        require(success, "Token transfer failed"); // S09

        emit StakingWithdrawn(vesting, amount, until, receiver, true);
    }
```
</details>

---    

> ### _withdrawNext

```solidity
function _withdrawNext(uint256 until, address receiver, bool isGovernance) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| until | uint256 |  | 
| receiver | address |  | 
| isGovernance | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _withdrawNext(
        uint256 until,
        address receiver,
        bool isGovernance
    ) internal {
        if (_isVestingContract(msg.sender)) {
            // nextLock needs to be adjusted to the next valid lock date to make sure we don't accidentally
            // withdraw stakes that are in the future and would get slashed (if until is not
            // a valid lock date). but until is already handled in the withdraw function
            uint256 nextLock = until.add(TWO_WEEKS);
            if (isGovernance || block.timestamp >= nextLock) {
                uint96 stakes = _getPriorUserStakeByDate(msg.sender, nextLock, block.number - 1);
                if (stakes > 0) {
                    _withdraw(stakes, nextLock, receiver, isGovernance);
                }
            }
        }
    }
```
</details>

---    

> ### getWithdrawAmounts

Get available and punished amount for withdrawing.

```solidity
function getWithdrawAmounts(uint96 amount, uint256 until) external view
returns(uint96, uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint96 | The number of tokens to withdraw. | 
| until | uint256 | The date until which the tokens were staked. Adjusted to the next valid lock date, if necessary. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getWithdrawAmounts(uint96 amount, uint256 until)
        external
        view
        returns (uint96, uint96)
    {
        until = _adjustDateForOrigin(until);
        _validateWithdrawParams(msg.sender, amount, until);
        uint96 punishedAmount = _getPunishedAmount(amount, until);
        return (amount - punishedAmount, punishedAmount);
    }
```
</details>

---    

> ### _getPunishedAmount

Get punished amount for withdrawing.

```solidity
function _getPunishedAmount(uint96 amount, uint256 until) internal view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint96 | The number of tokens to withdraw. | 
| until | uint256 | The date until which the tokens were staked. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getPunishedAmount(uint96 amount, uint256 until) internal view returns (uint96) {
        uint256 date = _timestampToLockDate(block.timestamp);
        uint96 weight = _computeWeightByDate(until, date); /// @dev (10 - 1) * WEIGHT_FACTOR
        weight = weight * weightScaling;
        return (amount * weight) / WEIGHT_FACTOR / 100;
    }
```
</details>

---    

> ### _validateWithdrawParams

Validate withdraw parameters.

```solidity
function _validateWithdrawParams(address account, uint96 amount, uint256 until) internal view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | Address to be validated. | 
| amount | uint96 | The number of tokens to withdraw. | 
| until | uint256 | The date until which the tokens were staked. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _validateWithdrawParams(
        address account,
        uint96 amount,
        uint256 until
    ) internal view {
        require(amount > 0, "Amount of tokens to withdraw must be > 0"); // S10
        uint96 balance = _getPriorUserStakeByDate(account, until, block.number - 1);
        require(amount <= balance, "Staking::withdraw: not enough balance"); // S11
    }
```
</details>

---    

> ### unlockAllTokens

Allow the owner to unlock all tokens in case the staking contract
is going to be replaced
Note: Not reversible on purpose. once unlocked, everything is unlocked.
The owner should not be able to just quickly unlock to withdraw his own
tokens and lock again.

```solidity
function unlockAllTokens() external nonpayable onlyOwner whenNotFrozen 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function unlockAllTokens() external onlyOwner whenNotFrozen {
        allUnlocked = true;
        emit TokensUnlocked(SOVToken.balanceOf(address(this)));
    }
```
</details>

---    

> ### setMaxVestingWithdrawIterations

set max withdraw iterations.
     *

```solidity
function setMaxVestingWithdrawIterations(uint256 newMaxIterations) external nonpayable onlyAuthorized whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newMaxIterations | uint256 | new max iterations value. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setMaxVestingWithdrawIterations(uint256 newMaxIterations)
        external
        onlyAuthorized
        whenNotFrozen
    {
        require(newMaxIterations > 0, "Invalid max iterations");
        emit MaxVestingWithdrawIterationsUpdated(maxVestingWithdrawIterations, newMaxIterations);
        maxVestingWithdrawIterations = newMaxIterations;
    }
```
</details>

---    

> ### governanceWithdrawVesting

Withdraw tokens for vesting contract.

```solidity
function governanceWithdrawVesting(address vesting, address receiver) public nonpayable onlyAuthorized whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vesting | address | The address of Vesting contract. | 
| receiver | address | The receiver of the tokens. If not specified, send to the msg.sender | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function governanceWithdrawVesting(address vesting, address receiver)
        public
        onlyAuthorized
        whenNotFrozen
    {
        vestingWhitelist[vesting] = true;
        ITeamVesting(vesting).governanceWithdrawTokens(receiver);
        vestingWhitelist[vesting] = false;

        emit VestingTokensWithdrawn(vesting, receiver);
    }
```
</details>

---    

> ### governanceWithdraw

Withdraw the given amount of tokens.

```solidity
function governanceWithdraw(uint96 amount, uint256 until, address receiver) external nonpayable whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint96 | The number of tokens to withdraw. | 
| until | uint256 | The date until which the tokens were staked. | 
| receiver | address | The receiver of the tokens. If not specified, send to the msg.sender | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function governanceWithdraw(
        uint96 amount,
        uint256 until,
        address receiver
    ) external whenNotFrozen {
        require(vestingWhitelist[msg.sender], "unauthorized"); // S07

        _notSameBlockAsStakingCheckpoint(until, msg.sender);

        _withdraw(amount, until, receiver, true);
        // @dev withdraws tokens for lock date 2 weeks later than given lock date if sender is a contract
        //		we don't need to check block.timestamp here
        _withdrawNext(until, receiver, true);
    }
```
</details>

---    

> ### getFunctionsList

⤾ overrides [IFunctionsList.getFunctionsList](IFunctionsList.md#getfunctionslist)

```solidity
function getFunctionsList() external pure
returns(bytes4[])
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getFunctionsList() external pure returns (bytes4[] memory) {
        bytes4[] memory functionsList = new bytes4[](7);
        functionsList[0] = this.withdraw.selector;
        functionsList[1] = this.cancelTeamVesting.selector;
        functionsList[2] = this.getWithdrawAmounts.selector;
        functionsList[3] = this.unlockAllTokens.selector;
        functionsList[4] = this.setMaxVestingWithdrawIterations.selector;
        functionsList[5] = this.governanceWithdraw.selector;
        functionsList[6] = this.governanceWithdrawVesting.selector;
        return functionsList;
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
