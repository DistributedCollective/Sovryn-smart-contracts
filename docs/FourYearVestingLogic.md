# Four Year Vesting Logic contract. (FourYearVestingLogic.sol)

View Source: [contracts/governance/Vesting/fouryear/FourYearVestingLogic.sol](../contracts/governance/Vesting/fouryear/FourYearVestingLogic.sol)

**↗ Extends: [IFourYearVesting](IFourYearVesting.md), [FourYearVestingStorage](FourYearVestingStorage.md), [ApprovalReceiver](ApprovalReceiver.md)**

**FourYearVestingLogic**

Staking, delegating and withdrawal functionality.

**Events**

```js
event TokensStaked(address indexed caller, uint256  amount);
event VotesDelegated(address indexed caller, address  delegatee);
event TokensWithdrawn(address indexed caller, address  receiver);
event DividendsCollected(address indexed caller, address  loanPoolToken, address  receiver, uint32  maxCheckpoints);
event MigratedToNewStakingContract(address indexed caller, address  newStakingContract);
event TokenOwnerChanged(address indexed newOwner, address indexed oldOwner);
```

## Modifiers

- [onlyOwners](#onlyowners)
- [onlyTokenOwner](#onlytokenowner)

### onlyOwners

Throws if called by any account other than the token owner or the contract owner.

```js
modifier onlyOwners() internal
```

### onlyTokenOwner

Throws if called by any account other than the token owner.

```js
modifier onlyTokenOwner() internal
```

## Functions

- [setMaxInterval(uint256 _interval)](#setmaxinterval)
- [stakeTokens(uint256 _amount, uint256 _restartStakeSchedule)](#staketokens)
- [stakeTokensWithApproval(address _sender, uint256 _amount, uint256 _restartStakeSchedule)](#staketokenswithapproval)
- [delegate(address _delegatee)](#delegate)
- [withdrawTokens(address receiver)](#withdrawtokens)
- [collectDividends(address _loanPoolToken, uint32 _maxCheckpoints, address _receiver)](#collectdividends)
- [changeTokenOwner(address _newTokenOwner)](#changetokenowner)
- [approveOwnershipTransfer()](#approveownershiptransfer)
- [setImpl(address _newImplementation)](#setimpl)
- [migrateToNewStakingContract()](#migratetonewstakingcontract)
- [extendStaking()](#extendstaking)
- [_stakeTokens(address _sender, uint256 _amount, uint256 _restartStakeSchedule)](#_staketokens)
- [_withdrawTokens(address receiver, bool isGovernance)](#_withdrawtokens)
- [_getToken()](#_gettoken)
- [_getSelectors()](#_getselectors)

---    

> ### setMaxInterval

Sets the max interval.

```solidity
function setMaxInterval(uint256 _interval) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _interval | uint256 | Max interval for which tokens scheduled shall be staked. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setMaxInterval(uint256 _interval) external onlyOwner {
        require(_interval.mod(FOUR_WEEKS) == 0, "invalid interval");
        maxInterval = _interval;
    }
```
</details>

---    

> ### stakeTokens

⤾ overrides [IFourYearVesting.stakeTokens](IFourYearVesting.md#staketokens)

Stakes tokens according to the vesting schedule.

```solidity
function stakeTokens(uint256 _amount, uint256 _restartStakeSchedule) external nonpayable
returns(lastSchedule uint256, remainingAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _amount | uint256 | The amount of tokens to stake. | 
| _restartStakeSchedule | uint256 | The time from which staking schedule restarts. The issue is that we can only stake tokens for a max duration. Thus, we need to restart from the lastSchedule. | 

**Returns**

lastSchedule The max duration for which tokens were staked.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function stakeTokens(uint256 _amount, uint256 _restartStakeSchedule)
        external
        returns (uint256 lastSchedule, uint256 remainingAmount)
    {
        (lastSchedule, remainingAmount) = _stakeTokens(msg.sender, _amount, _restartStakeSchedule);
    }
```
</details>

---    

> ### stakeTokensWithApproval

Stakes tokens according to the vesting schedule.

```solidity
function stakeTokensWithApproval(address _sender, uint256 _amount, uint256 _restartStakeSchedule) external nonpayable onlyThisContract 
returns(lastSchedule uint256, remainingAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sender | address | The sender of SOV.approveAndCall | 
| _amount | uint256 | The amount of tokens to stake. | 
| _restartStakeSchedule | uint256 | The time from which staking schedule restarts. The issue is that we can only stake tokens for a max duration. Thus, we need to restart from the lastSchedule. | 

**Returns**

lastSchedule The max duration for which tokens were staked.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function stakeTokensWithApproval(
        address _sender,
        uint256 _amount,
        uint256 _restartStakeSchedule
    ) external onlyThisContract returns (uint256 lastSchedule, uint256 remainingAmount) {
        (lastSchedule, remainingAmount) = _stakeTokens(_sender, _amount, _restartStakeSchedule);
    }
```
</details>

---    

> ### delegate

Delegate votes from `msg.sender` which are locked until lockDate
to `delegatee`.

```solidity
function delegate(address _delegatee) external nonpayable onlyTokenOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _delegatee | address | The address to delegate votes to. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function delegate(address _delegatee) external onlyTokenOwner {
        require(_delegatee != address(0), "delegatee address invalid");
        uint256 stakingEndDate = endDate;
        /// @dev Withdraw for each unlocked position.
        /// @dev Don't change FOUR_WEEKS to TWO_WEEKS, a lot of vestings already deployed with FOUR_WEEKS
        ///		workaround found, but it doesn't work with TWO_WEEKS
        for (uint256 i = startDate.add(cliff); i <= stakingEndDate; i += FOUR_WEEKS) {
            staking.delegate(_delegatee, i);
        }
        emit VotesDelegated(msg.sender, _delegatee);
    }
```
</details>

---    

> ### withdrawTokens

Withdraws unlocked tokens from the staking contract and
forwards them to an address specified by the token owner.

```solidity
function withdrawTokens(address receiver) external nonpayable onlyTokenOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address | The receiving address. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawTokens(address receiver) external onlyTokenOwner {
        _withdrawTokens(receiver, false);
    }
```
</details>

---    

> ### collectDividends

Collect dividends from fee sharing proxy.

```solidity
function collectDividends(address _loanPoolToken, uint32 _maxCheckpoints, address _receiver) external nonpayable onlyTokenOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _loanPoolToken | address | The loan pool token address. | 
| _maxCheckpoints | uint32 | Maximum number of checkpoints to be processed. | 
| _receiver | address | The receiver of tokens or msg.sender | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function collectDividends(
        address _loanPoolToken,
        uint32 _maxCheckpoints,
        address _receiver
    ) external onlyTokenOwner {
        require(_receiver != address(0), "receiver address invalid");

        /// @dev Invokes the fee sharing proxy.
        feeSharingProxy.withdraw(_loanPoolToken, _maxCheckpoints, _receiver);

        emit DividendsCollected(msg.sender, _loanPoolToken, _receiver, _maxCheckpoints);
    }
```
</details>

---    

> ### changeTokenOwner

Change token owner - only vesting owner is allowed to change.

```solidity
function changeTokenOwner(address _newTokenOwner) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newTokenOwner | address | Address of new token owner. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function changeTokenOwner(address _newTokenOwner) public onlyOwner {
        require(_newTokenOwner != address(0), "invalid new token owner address");
        require(_newTokenOwner != tokenOwner, "same owner not allowed");
        newTokenOwner = _newTokenOwner;
    }
```
</details>

---    

> ### approveOwnershipTransfer

Approve token owner change - only token Owner.

```solidity
function approveOwnershipTransfer() public nonpayable onlyTokenOwner 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function approveOwnershipTransfer() public onlyTokenOwner {
        require(newTokenOwner != address(0), "invalid address");
        tokenOwner = newTokenOwner;
        newTokenOwner = address(0);
        emit TokenOwnerChanged(tokenOwner, msg.sender);
    }
```
</details>

---    

> ### setImpl

Set address of the implementation - only Token Owner.

```solidity
function setImpl(address _newImplementation) public nonpayable onlyTokenOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newImplementation | address | Address of the new implementation. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setImpl(address _newImplementation) public onlyTokenOwner {
        require(_newImplementation != address(0), "invalid new implementation address");
        newImplementation = _newImplementation;
    }
```
</details>

---    

> ### migrateToNewStakingContract

Allows the owners to migrate the positions
to a new staking contract.

```solidity
function migrateToNewStakingContract() external nonpayable onlyOwners 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function migrateToNewStakingContract() external onlyOwners {
        staking.migrateToNewStakingContract();
        staking = Staking(staking.newStakingContract());
        emit MigratedToNewStakingContract(msg.sender, address(staking));
    }
```
</details>

---    

> ### extendStaking

Extends stakes(unlocked till timeDuration) for four year vesting contracts.

```solidity
function extendStaking() external nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function extendStaking() external {
        uint256 timeDuration = startDate.add(extendDurationFor);
        uint256[] memory dates;
        uint96[] memory stakes;
        (dates, stakes) = staking.getStakes(address(this));

        for (uint256 i = 0; i < dates.length; i++) {
            if ((dates[i] < block.timestamp) && (dates[i] <= timeDuration) && (stakes[i] > 0)) {
                staking.extendStakingDuration(dates[i], dates[i].add(156 weeks));
                endDate = dates[i].add(156 weeks);
            } else {
                break;
            }
        }
    }
```
</details>

---    

> ### _stakeTokens

Stakes tokens according to the vesting schedule. Low level function.

```solidity
function _stakeTokens(address _sender, uint256 _amount, uint256 _restartStakeSchedule) internal nonpayable
returns(lastSchedule uint256, remainingAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sender | address | The sender of tokens to stake. | 
| _amount | uint256 | The amount of tokens to stake. | 
| _restartStakeSchedule | uint256 | The time from which staking schedule restarts. The issue is that we can only stake tokens for a max duration. Thus, we need to restart from the lastSchedule. | 

**Returns**

lastSchedule The max duration for which tokens were staked.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _stakeTokens(
        address _sender,
        uint256 _amount,
        uint256 _restartStakeSchedule
    ) internal returns (uint256 lastSchedule, uint256 remainingAmount) {
        // Creating a new staking schedule for the same vesting contract is disallowed unlike normal vesting
        require(
            (startDate == 0) ||
                (startDate > 0 && remainingStakeAmount > 0 && _restartStakeSchedule > 0),
            "create new vesting address"
        );
        uint256 restartDate;
        uint256 relativeAmount;
        // Calling the _stakeTokens function first time for the vesting contract
        // Runs for maxInterval only (consider maxInterval = 18 * 4 = 72 weeks)
        if (startDate == 0 && _restartStakeSchedule == 0) {
            startDate = staking.timestampToLockDate(block.timestamp); // Set only once
            durationLeft = duration; // We do not touch duration and cliff as they are used throughout
            cliffAdded = cliff; // Hence, durationLeft and cliffAdded is created
        }
        // Calling the _stakeTokens second/third time - we start from the end of previous interval
        // and the remaining amount(amount left after tokens are staked in the previous interval)
        if (_restartStakeSchedule > 0) {
            require(
                _restartStakeSchedule == lastStakingSchedule && _amount == remainingStakeAmount,
                "invalid params"
            );
            restartDate = _restartStakeSchedule;
        } else {
            restartDate = startDate;
        }
        // Runs only once when the _stakeTokens is called for the first time
        if (endDate == 0) {
            endDate = staking.timestampToLockDate(block.timestamp.add(duration));
        }
        uint256 addedMaxInterval = restartDate.add(maxInterval); // run for maxInterval
        if (addedMaxInterval < endDate) {
            // Runs for max interval
            lastStakingSchedule = addedMaxInterval;
            relativeAmount = (_amount.mul(maxInterval)).div(durationLeft); // (_amount * 18) / 39
            durationLeft = durationLeft.sub(maxInterval); // durationLeft - 18 periods(72 weeks)
            remainingStakeAmount = _amount.sub(relativeAmount); // Amount left to be staked in subsequent intervals
        } else {
            // Normal run
            lastStakingSchedule = endDate; // if staking intervals left < 18 periods(72 weeks)
            remainingStakeAmount = 0;
            durationLeft = 0;
            relativeAmount = _amount; // Stake all amount left
        }

        /// @dev Transfer the tokens to this contract.
        bool success = SOV.transferFrom(_sender, address(this), relativeAmount);
        require(success, "transfer failed");

        /// @dev Allow the staking contract to access them.
        SOV.approve(address(staking), relativeAmount);

        staking.stakesBySchedule(
            relativeAmount,
            cliffAdded,
            duration.sub(durationLeft),
            FOUR_WEEKS,
            address(this),
            tokenOwner
        );
        if (durationLeft == 0) {
            // All tokens staked
            cliffAdded = 0;
        } else {
            cliffAdded = cliffAdded.add(maxInterval); // Add cliff to the end of previous maxInterval
        }

        emit TokensStaked(_sender, relativeAmount);
        return (lastStakingSchedule, remainingStakeAmount);
    }
```
</details>

---    

> ### _withdrawTokens

Withdraws tokens from the staking contract and forwards them
to an address specified by the token owner. Low level function.

```solidity
function _withdrawTokens(address receiver, bool isGovernance) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address | The receiving address. | 
| isGovernance | bool | Whether all tokens (true) or just unlocked tokens (false). | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _withdrawTokens(address receiver, bool isGovernance) internal {
        require(receiver != address(0), "receiver address invalid");

        uint96 stake;

        /// @dev Usually we just need to iterate over the possible dates until now.
        uint256 end;

        /// @dev In the unlikely case that all tokens have been unlocked early,
        ///   allow to withdraw all of them.
        if (staking.allUnlocked() || isGovernance) {
            end = endDate;
        } else {
            end = block.timestamp;
        }

        /// @dev Withdraw for each unlocked position.
        /// @dev Don't change FOUR_WEEKS to TWO_WEEKS, a lot of vestings already deployed with FOUR_WEEKS
        ///		workaround found, but it doesn't work with TWO_WEEKS
        /// @dev For four year vesting, withdrawal of stakes for the first year is not allowed. These
        /// stakes are extended for three years. In some cases the withdrawal may be allowed at a different
        /// time and hence we use extendDurationFor.
        for (uint256 i = startDate.add(extendDurationFor); i <= end; i += FOUR_WEEKS) {
            /// @dev Read amount to withdraw.
            stake = staking.getPriorUserStakeByDate(address(this), i, block.number.sub(1));

            /// @dev Withdraw if > 0
            if (stake > 0) {
                if (isGovernance) {
                    staking.governanceWithdraw(stake, i, receiver);
                } else {
                    staking.withdraw(stake, i, receiver);
                }
            }
        }

        emit TokensWithdrawn(msg.sender, receiver);
    }
```
</details>

---    

> ### _getToken

⤾ overrides [ApprovalReceiver._getToken](ApprovalReceiver.md#_gettoken)

Overrides default ApprovalReceiver._getToken function to
register SOV token on this contract.

```solidity
function _getToken() internal view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getToken() internal view returns (address) {
        return address(SOV);
    }
```
</details>

---    

> ### _getSelectors

⤾ overrides [ApprovalReceiver._getSelectors](ApprovalReceiver.md#_getselectors)

Overrides default ApprovalReceiver._getSelectors function to
register stakeTokensWithApproval selector on this contract.

```solidity
function _getSelectors() internal view
returns(bytes4[])
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getSelectors() internal view returns (bytes4[] memory) {
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = this.stakeTokensWithApproval.selector;
        return selectors;
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
