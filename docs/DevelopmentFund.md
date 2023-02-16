# A holding contract for Sovryn Development Fund. (DevelopmentFund.sol)

View Source: [contracts/governance/Vesting/DevelopmentFund.sol](../contracts/governance/Vesting/DevelopmentFund.sol)

**DevelopmentFund**

You can use this contract for timed token release from Dev Fund.

**Enums**
### Status

```js
enum Status {
 Deployed,
 Active,
 Expired
}
```

## Contract Members
**Constants & Variables**

```js
contract IERC20 public SOV;
enum DevelopmentFund.Status public status;
address public lockedTokenOwner;
address public unlockedTokenOwner;
address public safeVault;
address public newLockedTokenOwner;
uint256 public lastReleaseTime;
uint256[] public releaseDuration;
uint256[] public releaseTokenAmount;

```

**Events**

```js
event DevelopmentFundActivated();
event DevelopmentFundExpired();
event NewLockedOwnerAdded(address indexed _initiator, address indexed _newLockedOwner);
event NewLockedOwnerApproved(address indexed _initiator, address indexed _oldLockedOwner, address indexed _newLockedOwner);
event UnlockedOwnerUpdated(address indexed _initiator, address indexed _newUnlockedOwner);
event TokenDeposit(address indexed _initiator, uint256  _amount);
event TokenReleaseChanged(address indexed _initiator, uint256  _releaseCount);
event LockedTokenTransferByUnlockedOwner(address indexed _initiator, address indexed _receiver, uint256  _amount);
event UnlockedTokenWithdrawalByUnlockedOwner(address indexed _initiator, uint256  _amount, uint256  _releaseCount);
event LockedTokenTransferByLockedOwner(address indexed _initiator, address indexed _receiver, uint256  _amount);
```

## Modifiers

- [onlyLockedTokenOwner](#onlylockedtokenowner)
- [onlyUnlockedTokenOwner](#onlyunlockedtokenowner)
- [checkStatus](#checkstatus)

### onlyLockedTokenOwner

```js
modifier onlyLockedTokenOwner() internal
```

### onlyUnlockedTokenOwner

```js
modifier onlyUnlockedTokenOwner() internal
```

### checkStatus

```js
modifier checkStatus(enum DevelopmentFund.Status s) internal
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| s | enum DevelopmentFund.Status |  | 

## Functions

- [constructor(address _SOV, address _lockedTokenOwner, address _safeVault, address _unlockedTokenOwner, uint256 _lastReleaseTime, uint256[] _releaseDuration, uint256[] _releaseTokenAmount)](#constructor)
- [init()](#init)
- [updateLockedTokenOwner(address _newLockedTokenOwner)](#updatelockedtokenowner)
- [approveLockedTokenOwner()](#approvelockedtokenowner)
- [updateUnlockedTokenOwner(address _newUnlockedTokenOwner)](#updateunlockedtokenowner)
- [depositTokens(uint256 _amount)](#deposittokens)
- [changeTokenReleaseSchedule(uint256 _newLastReleaseTime, uint256[] _releaseDuration, uint256[] _releaseTokenAmount)](#changetokenreleaseschedule)
- [transferTokensByUnlockedTokenOwner()](#transfertokensbyunlockedtokenowner)
- [withdrawTokensByUnlockedTokenOwner(uint256 _amount)](#withdrawtokensbyunlockedtokenowner)
- [transferTokensByLockedTokenOwner(address _receiver)](#transfertokensbylockedtokenowner)
- [getReleaseDuration()](#getreleaseduration)
- [getReleaseTokenAmount()](#getreleasetokenamount)

---    

> ### constructor

Setup the required parameters.

```solidity
function (address _SOV, address _lockedTokenOwner, address _safeVault, address _unlockedTokenOwner, uint256 _lastReleaseTime, uint256[] _releaseDuration, uint256[] _releaseTokenAmount) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _SOV | address | The SOV token address. | 
| _lockedTokenOwner | address | The owner of the locked tokens & contract. | 
| _safeVault | address | The emergency wallet/contract to transfer token. | 
| _unlockedTokenOwner | address | The owner of the unlocked tokens. | 
| _lastReleaseTime | uint256 | If the last release time is to be changed, zero if no change required. | 
| _releaseDuration | uint256[] | The time duration between each release calculated from `lastReleaseTime` in seconds. | 
| _releaseTokenAmount | uint256[] | The amount of token to be released in each duration/interval. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor(
        address _SOV,
        address _lockedTokenOwner,
        address _safeVault,
        address _unlockedTokenOwner,
        uint256 _lastReleaseTime,
        uint256[] memory _releaseDuration,
        uint256[] memory _releaseTokenAmount
    ) public {
        require(_SOV != address(0), "Invalid SOV Address.");
        require(_lockedTokenOwner != address(0), "Locked token & contract owner address invalid.");
        require(_safeVault != address(0), "Safe Vault address invalid.");
        require(_unlockedTokenOwner != address(0), "Unlocked token address invalid.");

        SOV = IERC20(_SOV);
        lockedTokenOwner = _lockedTokenOwner;
        safeVault = _safeVault;
        unlockedTokenOwner = _unlockedTokenOwner;

        lastReleaseTime = _lastReleaseTime;
        /// If last release time passed is zero, then current time stamp will be used as the last release time.
        if (_lastReleaseTime == 0) {
            lastReleaseTime = block.timestamp;
        }

        /// Checking if the schedule duration and token allocation length matches.
        require(
            _releaseDuration.length == _releaseTokenAmount.length,
            "Release Schedule does not match."
        );

        /// Finally we update the token release schedule.
        releaseDuration = _releaseDuration;
        releaseTokenAmount = _releaseTokenAmount;
    }
```
</details>

---    

> ### init

This function is called once after deployment for token transfer based on schedule.

```solidity
function init() public nonpayable checkStatus 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function init() public checkStatus(Status.Deployed) {
        uint256[] memory _releaseTokenAmount = releaseTokenAmount;
        require(_releaseTokenAmount.length != 0, "Release Schedule not set.");

        /// Getting the current release schedule total token amount.
        uint256 _releaseTotalTokenAmount;
        for (uint256 amountIndex = 0; amountIndex < _releaseTokenAmount.length; amountIndex++) {
            _releaseTotalTokenAmount = _releaseTotalTokenAmount.add(
                _releaseTokenAmount[amountIndex]
            );
        }

        bool txStatus = SOV.transferFrom(msg.sender, address(this), _releaseTotalTokenAmount);
        require(txStatus, "Not enough token sent to change release schedule.");

        status = Status.Active;

        emit DevelopmentFundActivated();
    }
```
</details>

---    

> ### updateLockedTokenOwner

Update Locked Token Owner.

```solidity
function updateLockedTokenOwner(address _newLockedTokenOwner) public nonpayable onlyLockedTokenOwner checkStatus 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newLockedTokenOwner | address | The owner of the locked tokens & contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function updateLockedTokenOwner(address _newLockedTokenOwner)
        public
        onlyLockedTokenOwner
        checkStatus(Status.Active)
    {
        require(_newLockedTokenOwner != address(0), "New locked token owner address invalid.");

        newLockedTokenOwner = _newLockedTokenOwner;

        emit NewLockedOwnerAdded(msg.sender, _newLockedTokenOwner);
    }
```
</details>

---    

> ### approveLockedTokenOwner

Approve Locked Token Owner.

```solidity
function approveLockedTokenOwner() public nonpayable onlyUnlockedTokenOwner checkStatus 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function approveLockedTokenOwner() public onlyUnlockedTokenOwner checkStatus(Status.Active) {
        require(newLockedTokenOwner != address(0), "No new locked owner added.");

        emit NewLockedOwnerApproved(msg.sender, lockedTokenOwner, newLockedTokenOwner);

        lockedTokenOwner = newLockedTokenOwner;

        newLockedTokenOwner = address(0);
    }
```
</details>

---    

> ### updateUnlockedTokenOwner

Update Unlocked Token Owner.

```solidity
function updateUnlockedTokenOwner(address _newUnlockedTokenOwner) public nonpayable onlyLockedTokenOwner checkStatus 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newUnlockedTokenOwner | address | The new unlocked token owner. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function updateUnlockedTokenOwner(address _newUnlockedTokenOwner)
        public
        onlyLockedTokenOwner
        checkStatus(Status.Active)
    {
        require(_newUnlockedTokenOwner != address(0), "New unlocked token owner address invalid.");

        unlockedTokenOwner = _newUnlockedTokenOwner;

        emit UnlockedOwnerUpdated(msg.sender, _newUnlockedTokenOwner);
    }
```
</details>

---    

> ### depositTokens

Deposit tokens to this contract.

```solidity
function depositTokens(uint256 _amount) public nonpayable checkStatus 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _amount | uint256 | the amount of tokens deposited. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function depositTokens(uint256 _amount) public checkStatus(Status.Active) {
        require(_amount > 0, "Amount needs to be bigger than zero.");

        bool txStatus = SOV.transferFrom(msg.sender, address(this), _amount);
        require(txStatus, "Token transfer was not successful.");

        emit TokenDeposit(msg.sender, _amount);
    }
```
</details>

---    

> ### changeTokenReleaseSchedule

Change the Token release schedule. It creates a completely new schedule, and does not append on the previous one.

```solidity
function changeTokenReleaseSchedule(uint256 _newLastReleaseTime, uint256[] _releaseDuration, uint256[] _releaseTokenAmount) public nonpayable onlyLockedTokenOwner checkStatus 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newLastReleaseTime | uint256 | If the last release time is to be changed, zero if no change required. | 
| _releaseDuration | uint256[] | The time duration between each release calculated from `lastReleaseTime` in seconds. | 
| _releaseTokenAmount | uint256[] | The amount of token to be released in each duration/interval. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function changeTokenReleaseSchedule(
        uint256 _newLastReleaseTime,
        uint256[] memory _releaseDuration,
        uint256[] memory _releaseTokenAmount
    ) public onlyLockedTokenOwner checkStatus(Status.Active) {
        /// Checking if the schedule duration and token allocation length matches.
        require(
            _releaseDuration.length == _releaseTokenAmount.length,
            "Release Schedule does not match."
        );

        /// If the last release time has to be changed, then you can pass a new one here.
        /// Or else, the duration of release will be calculated based on this timestamp.
        /// Even a future timestamp can be mentioned here.
        if (_newLastReleaseTime != 0) {
            lastReleaseTime = _newLastReleaseTime;
        }

        /// Checking if the contract have enough token balance for the release.
        uint256 _releaseTotalTokenAmount;
        for (uint256 amountIndex = 0; amountIndex < _releaseTokenAmount.length; amountIndex++) {
            _releaseTotalTokenAmount = _releaseTotalTokenAmount.add(
                _releaseTokenAmount[amountIndex]
            );
        }

        /// Getting the current token balance of the contract.
        uint256 remainingTokens = SOV.balanceOf(address(this));

        /// If the token balance is not sufficient, then we transfer the change to contract.
        if (remainingTokens < _releaseTotalTokenAmount) {
            bool txStatus =
                SOV.transferFrom(
                    msg.sender,
                    address(this),
                    _releaseTotalTokenAmount.sub(remainingTokens)
                );
            require(txStatus, "Not enough token sent to change release schedule.");
        } else if (remainingTokens > _releaseTotalTokenAmount) {
            /// If there are more tokens than required, send the extra tokens back.
            bool txStatus =
                SOV.transfer(msg.sender, remainingTokens.sub(_releaseTotalTokenAmount));
            require(txStatus, "Token not received by the Locked Owner.");
        }

        /// Finally we update the token release schedule.
        releaseDuration = _releaseDuration;
        releaseTokenAmount = _releaseTokenAmount;

        emit TokenReleaseChanged(msg.sender, _releaseDuration.length);
    }
```
</details>

---    

> ### transferTokensByUnlockedTokenOwner

Transfers all of the remaining tokens in an emergency situation.

```solidity
function transferTokensByUnlockedTokenOwner() public nonpayable onlyUnlockedTokenOwner checkStatus 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function transferTokensByUnlockedTokenOwner()
        public
        onlyUnlockedTokenOwner
        checkStatus(Status.Active)
    {
        uint256 remainingTokens = SOV.balanceOf(address(this));
        bool txStatus = SOV.transfer(safeVault, remainingTokens);
        require(txStatus, "Token transfer was not successful. Check receiver address.");
        status = Status.Expired;

        emit LockedTokenTransferByUnlockedOwner(msg.sender, safeVault, remainingTokens);
        emit DevelopmentFundExpired();
    }
```
</details>

---    

> ### withdrawTokensByUnlockedTokenOwner

Withdraws all unlocked/released token.

```solidity
function withdrawTokensByUnlockedTokenOwner(uint256 _amount) public nonpayable onlyUnlockedTokenOwner checkStatus 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _amount | uint256 | The amount to be withdrawn. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawTokensByUnlockedTokenOwner(uint256 _amount)
        public
        onlyUnlockedTokenOwner
        checkStatus(Status.Active)
    {
        require(_amount > 0, "Zero can't be withdrawn.");

        uint256 count; /// To know how many elements to be removed from the release schedule.
        uint256 amount = _amount; /// To know the total amount to be transferred.
        uint256 newLastReleaseTimeMemory = lastReleaseTime; /// Better to use memory than storage.
        uint256 releaseLength = releaseDuration.length.sub(1); /// Also checks if there are any elements in the release schedule.

        /// Getting the amount of tokens, the number of releases and calculating the total duration.
        while (
            amount > 0 &&
            newLastReleaseTimeMemory.add(releaseDuration[releaseLength]) < block.timestamp
        ) {
            if (amount >= releaseTokenAmount[releaseLength]) {
                amount = amount.sub(releaseTokenAmount[releaseLength]);
                newLastReleaseTimeMemory = newLastReleaseTimeMemory.add(
                    releaseDuration[releaseLength]
                );
                count++;
            } else {
                /// This will be the last case, if correct amount is passed.
                releaseTokenAmount[releaseLength] = releaseTokenAmount[releaseLength].sub(amount);
                amount = 0;
            }
            releaseLength--;
        }

        /// Checking to see if atleast a single schedule was reached or not.
        require(count > 0 || amount == 0, "No release schedule reached.");

        /// If locked token owner tries to send a higher amount that schedule
        uint256 value = _amount.sub(amount);

        /// Now clearing up the release schedule.
        releaseDuration.length -= count;
        releaseTokenAmount.length -= count;

        /// Updating the last release time.
        lastReleaseTime = newLastReleaseTimeMemory;

        /// Sending the amount to unlocked token owner.
        bool txStatus = SOV.transfer(msg.sender, value);
        require(txStatus, "Token transfer was not successful. Check receiver address.");

        emit UnlockedTokenWithdrawalByUnlockedOwner(msg.sender, value, count);
    }
```
</details>

---    

> ### transferTokensByLockedTokenOwner

Transfers all of the remaining tokens by the owner maybe for an upgrade.

```solidity
function transferTokensByLockedTokenOwner(address _receiver) public nonpayable onlyLockedTokenOwner checkStatus 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _receiver | address | The address which receives this token transfer. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function transferTokensByLockedTokenOwner(address _receiver)
        public
        onlyLockedTokenOwner
        checkStatus(Status.Active)
    {
        uint256 remainingTokens = SOV.balanceOf(address(this));
        bool txStatus = SOV.transfer(_receiver, remainingTokens);
        require(txStatus, "Token transfer was not successful. Check receiver address.");
        status = Status.Expired;

        emit LockedTokenTransferByLockedOwner(msg.sender, _receiver, remainingTokens);
        emit DevelopmentFundExpired();
    }
```
</details>

---    

> ### getReleaseDuration

Function to read the current token release duration.

```solidity
function getReleaseDuration() public view
returns(_releaseTokenDuration uint256[])
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getReleaseDuration() public view returns (uint256[] memory _releaseTokenDuration) {
        return releaseDuration;
    }
```
</details>

---    

> ### getReleaseTokenAmount

Function to read the current token release amount.

```solidity
function getReleaseTokenAmount() public view
returns(_currentReleaseTokenAmount uint256[])
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getReleaseTokenAmount()
        public
        view
        returns (uint256[] memory _currentReleaseTokenAmount)
    {
        return releaseTokenAmount;
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
