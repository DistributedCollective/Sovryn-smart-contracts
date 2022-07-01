# Origin investors claim vested cSOV tokens. (OriginInvestorsClaim.sol)

View Source: [contracts/governance/Vesting/OriginInvestorsClaim.sol](../contracts/governance/Vesting/OriginInvestorsClaim.sol)

**↗ Extends: [Ownable](Ownable.md)**

**OriginInvestorsClaim**

// TODO: fund this contract with a total amount of SOV needed to distribute.

## Contract Members
**Constants & Variables**

```js
uint256 public totalAmount;
uint256 public constant SOV_VESTING_CLIFF;
uint256 public kickoffTS;
uint256 public vestingTerm;
uint256 public investorsQty;
bool public investorsListInitialized;
contract VestingRegistry public vestingRegistry;
contract Staking public staking;
contract IERC20 public SOVToken;
mapping(address => bool) public admins;
mapping(address => uint256) public investorsAmountsList;

```

**Events**

```js
event AdminAdded(address  admin);
event AdminRemoved(address  admin);
event InvestorsAmountsListAppended(uint256  qty, uint256  amount);
event ClaimVested(address indexed investor, uint256  amount);
event ClaimTransferred(address indexed investor, uint256  amount);
event InvestorsAmountsListInitialized(uint256  qty, uint256  totalAmount);
```

## Modifiers

- [onlyAuthorized](#onlyauthorized)
- [onlyWhitelisted](#onlywhitelisted)
- [notInitialized](#notinitialized)
- [initialized](#initialized)

### onlyAuthorized

Throws if called by any account other than the owner or admin.

```js
modifier onlyAuthorized() internal
```

### onlyWhitelisted

Throws if called by any account not whitelisted.

```js
modifier onlyWhitelisted() internal
```

### notInitialized

Throws if called w/ an initialized investors list.

```js
modifier notInitialized() internal
```

### initialized

Throws if called w/ an uninitialized investors list.

```js
modifier initialized() internal
```

## Functions

- [constructor(address vestingRegistryAddress)](#constructor)
- [addAdmin(address _admin)](#addadmin)
- [removeAdmin(address _admin)](#removeadmin)
- [authorizedBalanceWithdraw(address toAddress)](#authorizedbalancewithdraw)
- [setInvestorsAmountsListInitialized()](#setinvestorsamountslistinitialized)
- [appendInvestorsAmountsList(address[] investors, uint256[] claimAmounts)](#appendinvestorsamountslist)
- [claim()](#claim)
- [createVesting()](#createvesting)
- [transfer()](#transfer)

---    

> ### constructor

Contract deployment requires one parameter:

```solidity
function (address vestingRegistryAddress) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vestingRegistryAddress | address | The vestingRegistry contract instance address. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor(address vestingRegistryAddress) public {
        vestingRegistry = VestingRegistry(vestingRegistryAddress);
        staking = Staking(vestingRegistry.staking());
        kickoffTS = staking.kickoffTS();
        SOVToken = staking.SOVToken();
        vestingTerm = kickoffTS + SOV_VESTING_CLIFF;
    }
```
</details>

---    

> ### addAdmin

Add account to ACL.

```solidity
function addAdmin(address _admin) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _admin | address | The addresses of the account to grant permissions. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addAdmin(address _admin) public onlyOwner {
        admins[_admin] = true;
        emit AdminAdded(_admin);
    }
```
</details>

---    

> ### removeAdmin

Remove account from ACL.

```solidity
function removeAdmin(address _admin) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _admin | address | The addresses of the account to revoke permissions. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeAdmin(address _admin) public onlyOwner {
        admins[_admin] = false;
        emit AdminRemoved(_admin);
    }
```
</details>

---    

> ### authorizedBalanceWithdraw

In case we have unclaimed tokens or in emergency case
this function transfers all SOV tokens to a given address.

```solidity
function authorizedBalanceWithdraw(address toAddress) public nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| toAddress | address | The recipient address of all this contract tokens. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function authorizedBalanceWithdraw(address toAddress) public onlyAuthorized {
        require(
            SOVToken.transfer(toAddress, SOVToken.balanceOf(address(this))),
            "OriginInvestorsClaim::authorizedTransferBalance: transfer failed"
        );
    }
```
</details>

---    

> ### setInvestorsAmountsListInitialized

Should be called after the investors list setup completed.
This function checks whether the SOV token balance of the contract is
enough and sets status list to initialized.

```solidity
function setInvestorsAmountsListInitialized() public nonpayable onlyAuthorized notInitialized 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setInvestorsAmountsListInitialized() public onlyAuthorized notInitialized {
        require(
            SOVToken.balanceOf(address(this)) >= totalAmount,
            "OriginInvestorsClaim::setInvestorsAmountsList: the contract is not enough financed"
        );

        investorsListInitialized = true;

        emit InvestorsAmountsListInitialized(investorsQty, totalAmount);
    }
```
</details>

---    

> ### appendInvestorsAmountsList

The contract should be approved or transferred necessary
amount of SOV prior to calling the function.

```solidity
function appendInvestorsAmountsList(address[] investors, uint256[] claimAmounts) external nonpayable onlyAuthorized notInitialized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| investors | address[] | The list of investors addresses to add to the list. Duplicates will be skipped. | 
| claimAmounts | uint256[] | The list of amounts for investors investors[i] will receive claimAmounts[i] of SOV. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function appendInvestorsAmountsList(
        address[] calldata investors,
        uint256[] calldata claimAmounts
    ) external onlyAuthorized notInitialized {
        uint256 subQty;
        uint256 sumAmount;
        require(
            investors.length == claimAmounts.length,
            "OriginInvestorsClaim::appendInvestorsAmountsList: investors.length != claimAmounts.length"
        );

        for (uint256 i = 0; i < investors.length; i++) {
            if (investorsAmountsList[investors[i]] == 0) {
                investorsAmountsList[investors[i]] = claimAmounts[i];
                sumAmount = sumAmount.add(claimAmounts[i]);
            } else {
                subQty = subQty.add(1);
            }
        }

        investorsQty = investorsQty.add(investors.length.sub(subQty));
        totalAmount = totalAmount.add(sumAmount);
        emit InvestorsAmountsListAppended(investors.length.sub(subQty), sumAmount);
    }
```
</details>

---    

> ### claim

Claim tokens from this contract.
If vestingTerm is not yet achieved a vesting is created.
Otherwise tokens are tranferred.

```solidity
function claim() external nonpayable onlyWhitelisted initialized 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function claim() external onlyWhitelisted initialized {
        if (now < vestingTerm) {
            createVesting();
        } else {
            transfer();
        }
    }
```
</details>

---    

> ### createVesting

Transfer tokens from this contract to a vestingRegistry contract.
Sender is removed from investor list and all its unvested tokens
are sent to vesting contract.

```solidity
function createVesting() internal nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function createVesting() internal {
        uint256 cliff = vestingTerm.sub(now);
        uint256 duration = cliff;
        uint256 amount = investorsAmountsList[msg.sender];
        address vestingContractAddress;

        vestingContractAddress = vestingRegistry.getVesting(msg.sender);
        require(
            vestingContractAddress == address(0),
            "OriginInvestorsClaim::withdraw: the claimer has an active vesting contract"
        );

        delete investorsAmountsList[msg.sender];

        vestingRegistry.createVesting(msg.sender, amount, cliff, duration);
        vestingContractAddress = vestingRegistry.getVesting(msg.sender);
        require(
            SOVToken.transfer(address(vestingRegistry), amount),
            "OriginInvestorsClaim::withdraw: SOV transfer failed"
        );
        vestingRegistry.stakeTokens(vestingContractAddress, amount);

        emit ClaimVested(msg.sender, amount);
    }
```
</details>

---    

> ### transfer

Transfer tokens from this contract to the sender.
Sender is removed from investor list and all its unvested tokens
are sent to its account.

```solidity
function transfer() internal nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function transfer() internal {
        uint256 amount = investorsAmountsList[msg.sender];

        delete investorsAmountsList[msg.sender];

        /**
         * @dev Withdraw only for those claiming after the cliff, i.e. without vesting contracts.
         * Those with vestingContracts should withdraw using Vesting.withdrawTokens
         * from Vesting (VestingLogic) contract.
         * */
        require(
            SOVToken.transfer(msg.sender, amount),
            "OriginInvestorsClaim::withdraw: SOV transfer failed"
        );

        emit ClaimTransferred(msg.sender, amount);
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
