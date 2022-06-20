# VestingCreator.sol

View Source: [contracts/governance/Vesting/VestingCreator.sol](../contracts/governance/Vesting/VestingCreator.sol)

**↗ Extends: [AdminRole](AdminRole.md)**

**VestingCreator**

## Structs
### VestingData

```js
struct VestingData {
 uint256 amount,
 uint256 cliff,
 uint256 duration,
 bool governanceControl,
 address tokenOwner,
 uint256 vestingCreationType
}
```

## Contract Members
**Constants & Variables**

```js
//internal members
bool internal vestingCreated;

//public members
uint256 public constant TWO_WEEKS;
contract IERC20 public SOV;
contract VestingRegistryLogic public vestingRegistryLogic;
struct VestingCreator.VestingData[] public vestingDataList;

```

**Events**

```js
event SOVTransferred(address indexed receiver, uint256  amount);
event TokensStaked(address indexed vesting, address indexed tokenOwner, uint256  amount);
event VestingDataRemoved(address indexed caller, address indexed tokenOwner);
event DataCleared(address indexed caller);
```

## Functions

- [constructor(address _SOV, address _vestingRegistryProxy)](#constructor)
- [transferSOV(address _receiver, uint256 _amount)](#transfersov)
- [addVestings(address[] _tokenOwners, uint256[] _amounts, uint256[] _cliffs, uint256[] _durations, bool[] _governanceControls, uint256[] _vestingCreationTypes)](#addvestings)
- [processNextVesting()](#processnextvesting)
- [processVestingCreation()](#processvestingcreation)
- [processStaking()](#processstaking)
- [removeNextVesting()](#removenextvesting)
- [clearVestingDataList()](#clearvestingdatalist)
- [getVestingAddress()](#getvestingaddress)
- [getVestingPeriod()](#getvestingperiod)
- [getUnprocessedCount()](#getunprocessedcount)
- [getUnprocessedAmount()](#getunprocessedamount)
- [isEnoughBalance()](#isenoughbalance)
- [getMissingBalance()](#getmissingbalance)
- [_createAndGetVesting(struct VestingCreator.VestingData vestingData)](#_createandgetvesting)
- [_getVesting(address _tokenOwner, uint256 _cliff, uint256 _duration, bool _governanceControl, uint256 _vestingCreationType)](#_getvesting)

---    

> ### constructor

```solidity
function (address _SOV, address _vestingRegistryProxy) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _SOV | address |  | 
| _vestingRegistryProxy | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor(address _SOV, address _vestingRegistryProxy) public {
        require(_SOV != address(0), "SOV address invalid");
        require(_vestingRegistryProxy != address(0), "Vesting registry address invalid");

        SOV = IERC20(_SOV);
        vestingRegistryLogic = VestingRegistryLogic(_vestingRegistryProxy);
    }
```
</details>

---    

> ### transferSOV

transfers SOV tokens to given address

```solidity
function transferSOV(address _receiver, uint256 _amount) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _receiver | address | the address of the SOV receiver | 
| _amount | uint256 | the amount to be transferred | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function transferSOV(address _receiver, uint256 _amount) external onlyOwner {
        require(_amount != 0, "amount invalid");
        require(SOV.transfer(_receiver, _amount), "transfer failed");
        emit SOVTransferred(_receiver, _amount);
    }
```
</details>

---    

> ### addVestings

adds vestings to be processed to the list

```solidity
function addVestings(address[] _tokenOwners, uint256[] _amounts, uint256[] _cliffs, uint256[] _durations, bool[] _governanceControls, uint256[] _vestingCreationTypes) external nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwners | address[] |  | 
| _amounts | uint256[] |  | 
| _cliffs | uint256[] |  | 
| _durations | uint256[] |  | 
| _governanceControls | bool[] |  | 
| _vestingCreationTypes | uint256[] |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addVestings(
        address[] calldata _tokenOwners,
        uint256[] calldata _amounts,
        uint256[] calldata _cliffs,
        uint256[] calldata _durations,
        bool[] calldata _governanceControls,
        uint256[] calldata _vestingCreationTypes
    ) external onlyAuthorized {
        require(
            _tokenOwners.length == _amounts.length &&
                _tokenOwners.length == _cliffs.length &&
                _tokenOwners.length == _durations.length &&
                _tokenOwners.length == _governanceControls.length,
            "arrays mismatch"
        );

        for (uint256 i = 0; i < _tokenOwners.length; i++) {
            require(
                _durations[i] >= _cliffs[i],
                "duration must be bigger than or equal to the cliff"
            );
            require(_amounts[i] > 0, "vesting amount cannot be 0");
            require(_tokenOwners[i] != address(0), "token owner cannot be 0 address");
            require(_cliffs[i].mod(TWO_WEEKS) == 0, "cliffs should have intervals of two weeks");
            require(
                _durations[i].mod(TWO_WEEKS) == 0,
                "durations should have intervals of two weeks"
            );
            VestingData memory vestingData =
                VestingData({
                    amount: _amounts[i],
                    cliff: _cliffs[i],
                    duration: _durations[i],
                    governanceControl: _governanceControls[i],
                    tokenOwner: _tokenOwners[i],
                    vestingCreationType: _vestingCreationTypes[i]
                });
            vestingDataList.push(vestingData);
        }
    }
```
</details>

---    

> ### processNextVesting

Creates vesting contract and stakes tokens

```solidity
function processNextVesting() external nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function processNextVesting() external {
        processVestingCreation();
        processStaking();
    }
```
</details>

---    

> ### processVestingCreation

Creates vesting contract without staking any tokens

```solidity
function processVestingCreation() public nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function processVestingCreation() public {
        require(!vestingCreated, "staking not done for the previous vesting");
        if (vestingDataList.length > 0) {
            VestingData storage vestingData = vestingDataList[vestingDataList.length - 1];
            _createAndGetVesting(vestingData);
            vestingCreated = true;
        }
    }
```
</details>

---    

> ### processStaking

Staking vested tokens

```solidity
function processStaking() public nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function processStaking() public {
        require(vestingCreated, "cannot stake without vesting creation");
        if (vestingDataList.length > 0) {
            VestingData storage vestingData = vestingDataList[vestingDataList.length - 1];
            address vestingAddress =
                _getVesting(
                    vestingData.tokenOwner,
                    vestingData.cliff,
                    vestingData.duration,
                    vestingData.governanceControl,
                    vestingData.vestingCreationType
                );
            if (vestingAddress != address(0)) {
                VestingLogic vesting = VestingLogic(vestingAddress);
                require(SOV.approve(address(vesting), vestingData.amount), "Approve failed");
                vesting.stakeTokens(vestingData.amount);
                emit TokensStaked(vestingAddress, vestingData.tokenOwner, vestingData.amount);
                address tokenOwnerDetails = vestingData.tokenOwner;
                vestingDataList.pop();
                emit VestingDataRemoved(msg.sender, tokenOwnerDetails);
            }
        }
        vestingCreated = false;
    }
```
</details>

---    

> ### removeNextVesting

removes next vesting data from the list

```solidity
function removeNextVesting() external nonpayable onlyAuthorized 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeNextVesting() external onlyAuthorized {
        address tokenOwnerDetails;
        if (vestingDataList.length > 0) {
            VestingData storage vestingData = vestingDataList[vestingDataList.length - 1];
            tokenOwnerDetails = vestingData.tokenOwner;
            vestingDataList.pop();
            emit VestingDataRemoved(msg.sender, tokenOwnerDetails);
        }
    }
```
</details>

---    

> ### clearVestingDataList

removes all data about unprocessed vestings to be processed

```solidity
function clearVestingDataList() public nonpayable onlyAuthorized 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function clearVestingDataList() public onlyAuthorized {
        delete vestingDataList;
        emit DataCleared(msg.sender);
    }
```
</details>

---    

> ### getVestingAddress

returns address after vesting creation

```solidity
function getVestingAddress() external view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getVestingAddress() external view returns (address) {
        return
            _getVesting(
                vestingDataList[vestingDataList.length - 1].tokenOwner,
                vestingDataList[vestingDataList.length - 1].cliff,
                vestingDataList[vestingDataList.length - 1].duration,
                vestingDataList[vestingDataList.length - 1].governanceControl,
                vestingDataList[vestingDataList.length - 1].vestingCreationType
            );
    }
```
</details>

---    

> ### getVestingPeriod

returns period i.e. ((duration - cliff) / 4 WEEKS)

```solidity
function getVestingPeriod() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getVestingPeriod() external view returns (uint256) {
        uint256 duration = vestingDataList[vestingDataList.length - 1].duration;
        uint256 cliff = vestingDataList[vestingDataList.length - 1].cliff;
        uint256 fourWeeks = TWO_WEEKS.mul(2);
        uint256 period = duration.sub(cliff).div(fourWeeks);
        return period;
    }
```
</details>

---    

> ### getUnprocessedCount

returns count of vestings to be processed

```solidity
function getUnprocessedCount() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getUnprocessedCount() external view returns (uint256) {
        return vestingDataList.length;
    }
```
</details>

---    

> ### getUnprocessedAmount

returns total amount of vestings to be processed

```solidity
function getUnprocessedAmount() public view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getUnprocessedAmount() public view returns (uint256) {
        uint256 amount = 0;
        uint256 length = vestingDataList.length;
        for (uint256 i = 0; i < length; i++) {
            amount = amount.add(vestingDataList[i].amount);
        }
        return amount;
    }
```
</details>

---    

> ### isEnoughBalance

checks if contract balance is enough to process all vestings

```solidity
function isEnoughBalance() public view
returns(bool)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function isEnoughBalance() public view returns (bool) {
        return SOV.balanceOf(address(this)) >= getUnprocessedAmount();
    }
```
</details>

---    

> ### getMissingBalance

returns missed balance to process all vestings

```solidity
function getMissingBalance() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getMissingBalance() external view returns (uint256) {
        if (isEnoughBalance()) {
            return 0;
        }
        return getUnprocessedAmount() - SOV.balanceOf(address(this));
    }
```
</details>

---    

> ### _createAndGetVesting

creates TeamVesting or Vesting contract

```solidity
function _createAndGetVesting(struct VestingCreator.VestingData vestingData) internal nonpayable
returns(vesting address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vestingData | struct VestingCreator.VestingData |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _createAndGetVesting(VestingData memory vestingData)
        internal
        returns (address vesting)
    {
        if (vestingData.governanceControl) {
            vestingRegistryLogic.createTeamVesting(
                vestingData.tokenOwner,
                vestingData.amount,
                vestingData.cliff,
                vestingData.duration,
                vestingData.vestingCreationType
            );
        } else {
            vestingRegistryLogic.createVestingAddr(
                vestingData.tokenOwner,
                vestingData.amount,
                vestingData.cliff,
                vestingData.duration,
                vestingData.vestingCreationType
            );
        }
        return
            _getVesting(
                vestingData.tokenOwner,
                vestingData.cliff,
                vestingData.duration,
                vestingData.governanceControl,
                vestingData.vestingCreationType
            );
    }
```
</details>

---    

> ### _getVesting

returns an address of TeamVesting or Vesting contract (depends on a governance control)

```solidity
function _getVesting(address _tokenOwner, uint256 _cliff, uint256 _duration, bool _governanceControl, uint256 _vestingCreationType) internal view
returns(vestingAddress address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address |  | 
| _cliff | uint256 |  | 
| _duration | uint256 |  | 
| _governanceControl | bool |  | 
| _vestingCreationType | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getVesting(
        address _tokenOwner,
        uint256 _cliff,
        uint256 _duration,
        bool _governanceControl,
        uint256 _vestingCreationType
    ) internal view returns (address vestingAddress) {
        if (_governanceControl) {
            vestingAddress = vestingRegistryLogic.getTeamVesting(
                _tokenOwner,
                _cliff,
                _duration,
                _vestingCreationType
            );
        } else {
            vestingAddress = vestingRegistryLogic.getVestingAddr(
                _tokenOwner,
                _cliff,
                _duration,
                _vestingCreationType
            );
        }
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
