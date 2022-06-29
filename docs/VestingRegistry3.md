# VestingRegistry3.sol

View Source: [contracts/governance/Vesting/VestingRegistry3.sol](../contracts/governance/Vesting/VestingRegistry3.sol)

**↗ Extends: [Ownable](Ownable.md)**

**VestingRegistry3**

**Enums**
### VestingType

```js
enum VestingType {
 TeamVesting,
 Vesting
}
```

## Contract Members
**Constants & Variables**

```js
contract IVestingFactory public vestingFactory;
address public SOV;
address public staking;
address public feeSharingProxy;
address public vestingOwner;
mapping(address => mapping(uint256 => address)) public vestingContracts;
mapping(address => bool) public admins;

```

**Events**

```js
event SOVTransferred(address indexed receiver, uint256  amount);
event VestingCreated(address indexed tokenOwner, address  vesting, uint256  cliff, uint256  duration, uint256  amount);
event TeamVestingCreated(address indexed tokenOwner, address  vesting, uint256  cliff, uint256  duration, uint256  amount);
event TokensStaked(address indexed vesting, uint256  amount);
event AdminAdded(address  admin);
event AdminRemoved(address  admin);
```

## Modifiers

- [onlyAuthorized](#onlyauthorized)

### onlyAuthorized

Throws if called by any account other than the owner or admin.

```js
modifier onlyAuthorized() internal
```

## Functions

- [constructor(address _vestingFactory, address _SOV, address _staking, address _feeSharingProxy, address _vestingOwner)](#constructor)
- [addAdmin(address _admin)](#addadmin)
- [removeAdmin(address _admin)](#removeadmin)
- [setVestingFactory(address _vestingFactory)](#setvestingfactory)
- [_setVestingFactory(address _vestingFactory)](#_setvestingfactory)
- [transferSOV(address _receiver, uint256 _amount)](#transfersov)
- [createVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration)](#createvesting)
- [createTeamVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration)](#createteamvesting)
- [stakeTokens(address _vesting, uint256 _amount)](#staketokens)
- [getVesting(address _tokenOwner)](#getvesting)
- [getTeamVesting(address _tokenOwner)](#getteamvesting)
- [_getOrCreateVesting(address _tokenOwner, uint256 _cliff, uint256 _duration)](#_getorcreatevesting)
- [_getOrCreateTeamVesting(address _tokenOwner, uint256 _cliff, uint256 _duration)](#_getorcreateteamvesting)

---    

> ### constructor

```solidity
function (address _vestingFactory, address _SOV, address _staking, address _feeSharingProxy, address _vestingOwner) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vestingFactory | address |  | 
| _SOV | address |  | 
| _staking | address |  | 
| _feeSharingProxy | address |  | 
| _vestingOwner | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor(
        address _vestingFactory,
        address _SOV,
        address _staking,
        address _feeSharingProxy,
        address _vestingOwner
    ) public {
        require(_SOV != address(0), "SOV address invalid");
        require(_staking != address(0), "staking address invalid");
        require(_feeSharingProxy != address(0), "feeSharingProxy address invalid");
        require(_vestingOwner != address(0), "vestingOwner address invalid");

        _setVestingFactory(_vestingFactory);

        SOV = _SOV;
        staking = _staking;
        feeSharingProxy = _feeSharingProxy;
        vestingOwner = _vestingOwner;
    }
```
</details>

---    

> ### addAdmin

```solidity
function addAdmin(address _admin) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _admin | address |  | 

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

```solidity
function removeAdmin(address _admin) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _admin | address |  | 

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

> ### setVestingFactory

sets vesting factory address

```solidity
function setVestingFactory(address _vestingFactory) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vestingFactory | address | the address of vesting factory contract | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setVestingFactory(address _vestingFactory) public onlyOwner {
        _setVestingFactory(_vestingFactory);
    }
```
</details>

---    

> ### _setVestingFactory

```solidity
function _setVestingFactory(address _vestingFactory) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vestingFactory | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _setVestingFactory(address _vestingFactory) internal {
        require(_vestingFactory != address(0), "vestingFactory address invalid");
        vestingFactory = IVestingFactory(_vestingFactory);
    }
```
</details>

---    

> ### transferSOV

transfers SOV tokens to given address

```solidity
function transferSOV(address _receiver, uint256 _amount) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _receiver | address | the address of the SOV receiver | 
| _amount | uint256 | the amount to be transferred | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function transferSOV(address _receiver, uint256 _amount) public onlyOwner {
        require(_receiver != address(0), "receiver address invalid");
        require(_amount != 0, "amount invalid");

        IERC20(SOV).transfer(_receiver, _amount);
        emit SOVTransferred(_receiver, _amount);
    }
```
</details>

---    

> ### createVesting

creates Vesting contract

```solidity
function createVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration) public nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address | the owner of the tokens | 
| _amount | uint256 | the amount to be staked | 
| _cliff | uint256 | the cliff in seconds | 
| _duration | uint256 | the total duration in seconds | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function createVesting(
        address _tokenOwner,
        uint256 _amount,
        uint256 _cliff,
        uint256 _duration
    ) public onlyAuthorized {
        address vesting = _getOrCreateVesting(_tokenOwner, _cliff, _duration);
        emit VestingCreated(_tokenOwner, vesting, _cliff, _duration, _amount);
    }
```
</details>

---    

> ### createTeamVesting

creates Team Vesting contract

```solidity
function createTeamVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration) public nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address | the owner of the tokens | 
| _amount | uint256 | the amount to be staked | 
| _cliff | uint256 | the cliff in seconds | 
| _duration | uint256 | the total duration in seconds | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function createTeamVesting(
        address _tokenOwner,
        uint256 _amount,
        uint256 _cliff,
        uint256 _duration
    ) public onlyAuthorized {
        address vesting = _getOrCreateTeamVesting(_tokenOwner, _cliff, _duration);
        emit TeamVestingCreated(_tokenOwner, vesting, _cliff, _duration, _amount);
    }
```
</details>

---    

> ### stakeTokens

stakes tokens according to the vesting schedule

```solidity
function stakeTokens(address _vesting, uint256 _amount) public nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vesting | address | the address of Vesting contract | 
| _amount | uint256 | the amount of tokens to stake | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function stakeTokens(address _vesting, uint256 _amount) public onlyAuthorized {
        require(_vesting != address(0), "vesting address invalid");
        require(_amount > 0, "amount invalid");

        IERC20(SOV).approve(_vesting, _amount);
        IVesting(_vesting).stakeTokens(_amount);
        emit TokensStaked(_vesting, _amount);
    }
```
</details>

---    

> ### getVesting

returns vesting contract address for the given token owner

```solidity
function getVesting(address _tokenOwner) public view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address | the owner of the tokens | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getVesting(address _tokenOwner) public view returns (address) {
        return vestingContracts[_tokenOwner][uint256(VestingType.Vesting)];
    }
```
</details>

---    

> ### getTeamVesting

returns team vesting contract address for the given token owner

```solidity
function getTeamVesting(address _tokenOwner) public view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address | the owner of the tokens | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getTeamVesting(address _tokenOwner) public view returns (address) {
        return vestingContracts[_tokenOwner][uint256(VestingType.TeamVesting)];
    }
```
</details>

---    

> ### _getOrCreateVesting

```solidity
function _getOrCreateVesting(address _tokenOwner, uint256 _cliff, uint256 _duration) internal nonpayable
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address |  | 
| _cliff | uint256 |  | 
| _duration | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getOrCreateVesting(
        address _tokenOwner,
        uint256 _cliff,
        uint256 _duration
    ) internal returns (address) {
        uint256 type_ = uint256(VestingType.Vesting);
        if (vestingContracts[_tokenOwner][type_] == address(0)) {
            //TODO Owner of OwnerVesting contracts - the same address as tokenOwner
            address vesting =
                vestingFactory.deployVesting(
                    SOV,
                    staking,
                    _tokenOwner,
                    _cliff,
                    _duration,
                    feeSharingProxy,
                    _tokenOwner
                );
            vestingContracts[_tokenOwner][type_] = vesting;
        }
        return vestingContracts[_tokenOwner][type_];
    }
```
</details>

---    

> ### _getOrCreateTeamVesting

```solidity
function _getOrCreateTeamVesting(address _tokenOwner, uint256 _cliff, uint256 _duration) internal nonpayable
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address |  | 
| _cliff | uint256 |  | 
| _duration | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getOrCreateTeamVesting(
        address _tokenOwner,
        uint256 _cliff,
        uint256 _duration
    ) internal returns (address) {
        uint256 type_ = uint256(VestingType.TeamVesting);
        if (vestingContracts[_tokenOwner][type_] == address(0)) {
            address vesting =
                vestingFactory.deployTeamVesting(
                    SOV,
                    staking,
                    _tokenOwner,
                    _cliff,
                    _duration,
                    feeSharingProxy,
                    vestingOwner
                );
            vestingContracts[_tokenOwner][type_] = vesting;
        }
        return vestingContracts[_tokenOwner][type_];
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
