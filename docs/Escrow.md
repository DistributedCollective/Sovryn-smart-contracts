# A holding contract for Sovryn Ethereum Pool to accept SOV Token. (Escrow.sol)

View Source: [contracts/escrow/Escrow.sol](../contracts/escrow/Escrow.sol)

**↘ Derived Contracts: [EscrowReward](EscrowReward.md)**

**Escrow**

You can use this contract for deposit of SOV tokens for some time and withdraw later.

**Enums**
### Status

```js
enum Status {
 Deployed,
 Deposit,
 Holding,
 Withdraw,
 Expired
}
```

## Contract Members
**Constants & Variables**

```js
//public members
uint256 public totalDeposit;
uint256 public releaseTime;
uint256 public depositLimit;
contract IERC20 public SOV;
address public multisig;
enum Escrow.Status public status;

//internal members
mapping(address => uint256) internal userBalances;

```

**Events**

```js
event EscrowActivated();
event EscrowInHoldingState();
event EscrowInWithdrawState();
event EscrowFundExpired();
event NewMultisig(address indexed _initiator, address indexed _newMultisig);
event TokenReleaseUpdated(address indexed _initiator, uint256  _releaseTimestamp);
event TokenDepositLimitUpdated(address indexed _initiator, uint256  _depositLimit);
event TokenDeposit(address indexed _initiator, uint256  _amount);
event DepositLimitReached();
event TokenWithdrawByMultisig(address indexed _initiator, uint256  _amount);
event TokenDepositByMultisig(address indexed _initiator, uint256  _amount);
event TokenWithdraw(address indexed _initiator, uint256  _amount);
```

## Modifiers

- [onlyMultisig](#onlymultisig)
- [checkStatus](#checkstatus)
- [checkRelease](#checkrelease)

### onlyMultisig

```js
modifier onlyMultisig() internal
```

### checkStatus

```js
modifier checkStatus(enum Escrow.Status s) internal
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| s | enum Escrow.Status |  | 

### checkRelease

```js
modifier checkRelease() internal
```

## Functions

- [constructor(address _SOV, address _multisig, uint256 _releaseTime, uint256 _depositLimit)](#constructor)
- [init()](#init)
- [updateMultisig(address _newMultisig)](#updatemultisig)
- [updateReleaseTimestamp(uint256 _newReleaseTime)](#updatereleasetimestamp)
- [updateDepositLimit(uint256 _newDepositLimit)](#updatedepositlimit)
- [depositTokens(uint256 _amount)](#deposittokens)
- [changeStateToHolding()](#changestatetoholding)
- [withdrawTokensByMultisig(address _receiverAddress)](#withdrawtokensbymultisig)
- [depositTokensByMultisig(uint256 _amount)](#deposittokensbymultisig)
- [withdrawTokens()](#withdrawtokens)
- [getUserBalance(address _addr)](#getuserbalance)

---    

> ### constructor

Setup the required parameters.

```solidity
function (address _SOV, address _multisig, uint256 _releaseTime, uint256 _depositLimit) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _SOV | address | The SOV token address. | 
| _multisig | address | The owner of the tokens & contract. | 
| _releaseTime | uint256 | The token release time, zero if undecided. | 
| _depositLimit | uint256 | The amount of tokens we will be accepting. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor(
        address _SOV,
        address _multisig,
        uint256 _releaseTime,
        uint256 _depositLimit
    ) public {
        require(_SOV != address(0), "Invalid SOV Address.");
        require(_multisig != address(0), "Invalid Multisig Address.");

        SOV = IERC20(_SOV);
        multisig = _multisig;

        emit NewMultisig(msg.sender, _multisig);

        releaseTime = _releaseTime;
        depositLimit = _depositLimit;

        status = Status.Deployed;
    }
```
</details>

---    

> ### init

This function is called once after deployment for starting the deposit action.

```solidity
function init() external nonpayable onlyMultisig checkStatus 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function init() external onlyMultisig checkStatus(Status.Deployed) {
        status = Status.Deposit;

        emit EscrowActivated();
    }
```
</details>

---    

> ### updateMultisig

Update Multisig.

```solidity
function updateMultisig(address _newMultisig) external nonpayable onlyMultisig 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newMultisig | address | The new owner of the tokens & contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function updateMultisig(address _newMultisig) external onlyMultisig {
        require(_newMultisig != address(0), "New Multisig address invalid.");

        multisig = _newMultisig;

        emit NewMultisig(msg.sender, _newMultisig);
    }
```
</details>

---    

> ### updateReleaseTimestamp

Update Release Timestamp.

```solidity
function updateReleaseTimestamp(uint256 _newReleaseTime) external nonpayable onlyMultisig 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newReleaseTime | uint256 | The new release timestamp for token release. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function updateReleaseTimestamp(uint256 _newReleaseTime) external onlyMultisig {
        releaseTime = _newReleaseTime;

        emit TokenReleaseUpdated(msg.sender, _newReleaseTime);
    }
```
</details>

---    

> ### updateDepositLimit

Update Deposit Limit.

```solidity
function updateDepositLimit(uint256 _newDepositLimit) external nonpayable onlyMultisig 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newDepositLimit | uint256 | The new deposit limit. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function updateDepositLimit(uint256 _newDepositLimit) external onlyMultisig {
        require(
            _newDepositLimit >= totalDeposit,
            "Deposit already higher than the limit trying to be set."
        );
        depositLimit = _newDepositLimit;

        emit TokenDepositLimitUpdated(msg.sender, _newDepositLimit);
    }
```
</details>

---    

> ### depositTokens

Deposit tokens to this contract by User.

```solidity
function depositTokens(uint256 _amount) external nonpayable checkStatus 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _amount | uint256 | the amount of tokens deposited. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function depositTokens(uint256 _amount) external checkStatus(Status.Deposit) {
        require(_amount > 0, "Amount needs to be bigger than zero.");
        uint256 amount = _amount;

        if (totalDeposit.add(_amount) >= depositLimit) {
            amount = depositLimit.sub(totalDeposit);
            emit DepositLimitReached();
        }

        bool txStatus = SOV.transferFrom(msg.sender, address(this), amount);
        require(txStatus, "Token transfer was not successful.");

        userBalances[msg.sender] = userBalances[msg.sender].add(amount);
        totalDeposit = totalDeposit.add(amount);

        emit TokenDeposit(msg.sender, amount);
    }
```
</details>

---    

> ### changeStateToHolding

Update contract state to Holding.

```solidity
function changeStateToHolding() external nonpayable onlyMultisig checkStatus 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function changeStateToHolding() external onlyMultisig checkStatus(Status.Deposit) {
        status = Status.Holding;

        emit EscrowInHoldingState();
    }
```
</details>

---    

> ### withdrawTokensByMultisig

Withdraws all token from the contract by Multisig.

```solidity
function withdrawTokensByMultisig(address _receiverAddress) external nonpayable onlyMultisig checkStatus 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _receiverAddress | address | The address where the tokens has to be transferred. Zero address if the withdraw is to be done in Multisig. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawTokensByMultisig(address _receiverAddress)
        external
        onlyMultisig
        checkStatus(Status.Holding)
    {
        address receiverAddress = msg.sender;
        if (_receiverAddress != address(0)) {
            receiverAddress = _receiverAddress;
        }

        uint256 value = SOV.balanceOf(address(this));
        /// Sending the amount to multisig.
        bool txStatus = SOV.transfer(receiverAddress, value);
        require(txStatus, "Token transfer was not successful. Check receiver address.");

        emit TokenWithdrawByMultisig(msg.sender, value);
    }
```
</details>

---    

> ### depositTokensByMultisig

Deposit tokens to this contract by the Multisig.

```solidity
function depositTokensByMultisig(uint256 _amount) external nonpayable onlyMultisig checkStatus 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _amount | uint256 | the amount of tokens deposited. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function depositTokensByMultisig(uint256 _amount)
        external
        onlyMultisig
        checkStatus(Status.Holding)
    {
        require(_amount > 0, "Amount needs to be bigger than zero.");

        bool txStatus = SOV.transferFrom(msg.sender, address(this), _amount);
        require(txStatus, "Token transfer was not successful.");

        emit TokenDepositByMultisig(msg.sender, _amount);

        if (SOV.balanceOf(address(this)) >= totalDeposit) {
            status = Status.Withdraw;
            emit EscrowInWithdrawState();
        }
    }
```
</details>

---    

> ### withdrawTokens

Withdraws token from the contract by User.

```solidity
function withdrawTokens() public nonpayable checkRelease checkStatus 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawTokens() public checkRelease checkStatus(Status.Withdraw) {
        uint256 amount = userBalances[msg.sender];
        userBalances[msg.sender] = 0;
        bool txStatus = SOV.transfer(msg.sender, amount);
        require(txStatus, "Token transfer was not successful. Check receiver address.");

        emit TokenWithdraw(msg.sender, amount);
    }
```
</details>

---    

> ### getUserBalance

Function to read the current token balance of a particular user.

```solidity
function getUserBalance(address _addr) external view
returns(balance uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _addr | address |  | 

**Returns**

_addr The user address whose balance has to be checked.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getUserBalance(address _addr) external view returns (uint256 balance) {
        return userBalances[_addr];
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
