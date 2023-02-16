# Vesting Logic contract. (VestingLogic.sol)

View Source: [contracts/governance/Vesting/VestingLogic.sol](../contracts/governance/Vesting/VestingLogic.sol)

**↗ Extends: [IVesting](IVesting.md), [VestingStorage](VestingStorage.md), [ApprovalReceiver](ApprovalReceiver.md)**

**VestingLogic**

Staking, delegating and withdrawal functionality.

**Events**

```js
event TokensStaked(address indexed caller, uint256  amount);
event VotesDelegated(address indexed caller, address  delegatee);
event TokensWithdrawn(address indexed caller, address  receiver);
event DividendsCollected(address indexed caller, address  loanPoolToken, address  receiver, uint32  maxCheckpoints);
event MigratedToNewStakingContract(address indexed caller, address  newStakingContract);
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

- [stakeTokens(uint256 _amount)](#staketokens)
- [stakeTokensWithApproval(address _sender, uint256 _amount)](#staketokenswithapproval)
- [_stakeTokens(address _sender, uint256 _amount)](#_staketokens)
- [delegate(address _delegatee)](#delegate)
- [governanceWithdrawTokens(address receiver)](#governancewithdrawtokens)
- [withdrawTokens(address receiver)](#withdrawtokens)
- [_withdrawTokens(address receiver, bool isGovernance)](#_withdrawtokens)
- [collectDividends(address _loanPoolToken, uint32 _maxCheckpoints, address _receiver)](#collectdividends)
- [migrateToNewStakingContract()](#migratetonewstakingcontract)
- [_getToken()](#_gettoken)
- [_getSelectors()](#_getselectors)

---    

> ### stakeTokens

⤾ overrides [IVesting.stakeTokens](IVesting.md#staketokens)

Stakes tokens according to the vesting schedule.

```solidity
function stakeTokens(uint256 _amount) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _amount | uint256 | The amount of tokens to stake. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function stakeTokens(uint256 _amount) public {
        _stakeTokens(msg.sender, _amount);
    }
```
</details>

---    

> ### stakeTokensWithApproval

Stakes tokens according to the vesting schedule.

```solidity
function stakeTokensWithApproval(address _sender, uint256 _amount) public nonpayable onlyThisContract 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sender | address | The sender of SOV.approveAndCall | 
| _amount | uint256 | The amount of tokens to stake. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function stakeTokensWithApproval(address _sender, uint256 _amount) public onlyThisContract {
        _stakeTokens(_sender, _amount);
    }
```
</details>

---    

> ### _stakeTokens

Stakes tokens according to the vesting schedule. Low level function.

```solidity
function _stakeTokens(address _sender, uint256 _amount) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sender | address | The sender of tokens to stake. | 
| _amount | uint256 | The amount of tokens to stake. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _stakeTokens(address _sender, uint256 _amount) internal {
        /// @dev Maybe better to allow staking unil the cliff was reached.
        if (startDate == 0) {
            startDate = staking.timestampToLockDate(block.timestamp);
        }
        endDate = staking.timestampToLockDate(block.timestamp + duration);

        /// @dev Transfer the tokens to this contract.
        bool success = SOV.transferFrom(_sender, address(this), _amount);
        require(success);

        /// @dev Allow the staking contract to access them.
        SOV.approve(address(staking), _amount);

        staking.stakesBySchedule(_amount, cliff, duration, FOUR_WEEKS, address(this), tokenOwner);

        emit TokensStaked(_sender, _amount);
    }
```
</details>

---    

> ### delegate

Delegate votes from `msg.sender` which are locked until lockDate
to `delegatee`.

```solidity
function delegate(address _delegatee) public nonpayable onlyTokenOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _delegatee | address | The address to delegate votes to. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function delegate(address _delegatee) public onlyTokenOwner {
        require(_delegatee != address(0), "delegatee address invalid");

        /// @dev Withdraw for each unlocked position.
        /// @dev Don't change FOUR_WEEKS to TWO_WEEKS, a lot of vestings already deployed with FOUR_WEEKS
        ///		workaround found, but it doesn't work with TWO_WEEKS
        for (uint256 i = startDate + cliff; i <= endDate; i += FOUR_WEEKS) {
            staking.delegate(_delegatee, i);
        }
        emit VotesDelegated(msg.sender, _delegatee);
    }
```
</details>

---    

> ### governanceWithdrawTokens

Withdraws all tokens from the staking contract and
forwards them to an address specified by the token owner.

```solidity
function governanceWithdrawTokens(address receiver) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address | The receiving address. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function governanceWithdrawTokens(address receiver) public {
        require(msg.sender == address(staking), "unauthorized");

        _withdrawTokens(receiver, true);
    }
```
</details>

---    

> ### withdrawTokens

Withdraws unlocked tokens from the staking contract and
forwards them to an address specified by the token owner.

```solidity
function withdrawTokens(address receiver) public nonpayable onlyOwners 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address | The receiving address. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawTokens(address receiver) public onlyOwners {
        _withdrawTokens(receiver, false);
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
        for (uint256 i = startDate + cliff; i <= end; i += FOUR_WEEKS) {
            /// @dev Read amount to withdraw.
            stake = staking.getPriorUserStakeByDate(address(this), i, block.number - 1);

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

> ### collectDividends

Collect dividends from fee sharing proxy.

```solidity
function collectDividends(address _loanPoolToken, uint32 _maxCheckpoints, address _receiver) public nonpayable onlyOwners 
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
    ) public onlyOwners {
        require(_receiver != address(0), "receiver address invalid");

        /// @dev Invokes the fee sharing proxy.
        feeSharingProxy.withdraw(_loanPoolToken, _maxCheckpoints, _receiver);

        emit DividendsCollected(msg.sender, _loanPoolToken, _receiver, _maxCheckpoints);
    }
```
</details>

---    

> ### migrateToNewStakingContract

Allows the owners to migrate the positions
to a new staking contract.

```solidity
function migrateToNewStakingContract() public nonpayable onlyOwners 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function migrateToNewStakingContract() public onlyOwners {
        staking.migrateToNewStakingContract();
        staking = Staking(staking.newStakingContract());
        emit MigratedToNewStakingContract(msg.sender, address(staking));
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
