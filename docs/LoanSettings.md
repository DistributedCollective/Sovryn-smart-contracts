# Loan Settings contract.
 * (LoanSettings.sol)

View Source: [contracts/modules/LoanSettings.sol](../contracts/modules/LoanSettings.sol)

**↗ Extends: [State](State.md), [LoanSettingsEvents](LoanSettingsEvents.md), [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)**

**LoanSettings**

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
 * This contract contains functions to get and set loan parameters.

## Functions

- [constructor()](#constructor)
- [constructor()](#constructor)
- [initialize(address target)](#initialize)
- [setupLoanParams(struct LoanParamsStruct.LoanParams[] loanParamsList)](#setuploanparams)
- [disableLoanParams(bytes32[] loanParamsIdList)](#disableloanparams)
- [getLoanParams(bytes32[] loanParamsIdList)](#getloanparams)
- [getLoanParamsList(address owner, uint256 start, uint256 count)](#getloanparamslist)
- [getTotalPrincipal(address lender, address loanToken)](#gettotalprincipal)
- [_setupLoanParams(struct LoanParamsStruct.LoanParams loanParamsLocal)](#_setuploanparams)
- [minInitialMargin(bytes32 loanParamsId)](#mininitialmargin)

---    

> ### constructor

Empty public constructor.

```solidity
function () public nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor() public {}
```
</details>

---    

> ### constructor

Fallback function is to react to receiving value (rBTC).

```solidity
function () external nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function() external {
        revert("LoanSettings - fallback not allowed");
    }
```
</details>

---    

> ### initialize

Set function selectors on target contract.
     *

```solidity
function initialize(address target) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address | The address of the target contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function initialize(address target) external onlyOwner {
        address prevModuleContractAddress = logicTargets[this.setupLoanParams.selector];
        _setTarget(this.setupLoanParams.selector, target);
        _setTarget(this.disableLoanParams.selector, target);
        _setTarget(this.getLoanParams.selector, target);
        _setTarget(this.getLoanParamsList.selector, target);
        _setTarget(this.getTotalPrincipal.selector, target);
        _setTarget(this.minInitialMargin.selector, target);
        emit ProtocolModuleContractReplaced(prevModuleContractAddress, target, "LoanSettings");
    }
```
</details>

---    

> ### setupLoanParams

Setup loan parameters, by looping every loan
and populating its parameters.
     *

```solidity
function setupLoanParams(struct LoanParamsStruct.LoanParams[] loanParamsList) external nonpayable whenNotPaused 
returns(loanParamsIdList bytes32[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsList | struct LoanParamsStruct.LoanParams[] | The array of loan parameters.      * | 

**Returns**

loanParamsIdList The array of loan parameters IDs.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setupLoanParams(LoanParams[] calldata loanParamsList)
        external
        whenNotPaused
        returns (bytes32[] memory loanParamsIdList)
    {
        loanParamsIdList = new bytes32[](loanParamsList.length);
        for (uint256 i = 0; i < loanParamsList.length; i++) {
            loanParamsIdList[i] = _setupLoanParams(loanParamsList[i]);
        }
    }
```
</details>

---    

> ### disableLoanParams

Deactivate LoanParams for future loans. Active loans
using it are unaffected.
     *

```solidity
function disableLoanParams(bytes32[] loanParamsIdList) external nonpayable whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsIdList | bytes32[] | The array of loan parameters IDs to deactivate. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function disableLoanParams(bytes32[] calldata loanParamsIdList) external whenNotPaused {
        for (uint256 i = 0; i < loanParamsIdList.length; i++) {
            require(msg.sender == loanParams[loanParamsIdList[i]].owner, "unauthorized owner");
            loanParams[loanParamsIdList[i]].active = false;

            LoanParams memory loanParamsLocal = loanParams[loanParamsIdList[i]];
            emit LoanParamsDisabled(
                loanParamsLocal.id,
                loanParamsLocal.owner,
                loanParamsLocal.loanToken,
                loanParamsLocal.collateralToken,
                loanParamsLocal.minInitialMargin,
                loanParamsLocal.maintenanceMargin,
                loanParamsLocal.maxLoanTerm
            );
            emit LoanParamsIdDisabled(loanParamsLocal.id, loanParamsLocal.owner);
        }
    }
```
</details>

---    

> ### getLoanParams

Get loan parameters for every matching IDs.
     *

```solidity
function getLoanParams(bytes32[] loanParamsIdList) public view
returns(loanParamsList struct LoanParamsStruct.LoanParams[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsIdList | bytes32[] | The array of loan parameters IDs to match.      * | 

**Returns**

loanParamsList The result array of loan parameters.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLoanParams(bytes32[] memory loanParamsIdList)
        public
        view
        returns (LoanParams[] memory loanParamsList)
    {
        loanParamsList = new LoanParams[](loanParamsIdList.length);
        uint256 itemCount;

        for (uint256 i = 0; i < loanParamsIdList.length; i++) {
            LoanParams memory loanParamsLocal = loanParams[loanParamsIdList[i]];
            if (loanParamsLocal.id == 0) {
                continue;
            }
            loanParamsList[itemCount] = loanParamsLocal;
            itemCount++;
        }

        if (itemCount < loanParamsList.length) {
            assembly {
                mstore(loanParamsList, itemCount)
            }
        }
    }
```
</details>

---    

> ### getLoanParamsList

Get loan parameters for an owner and a given page
defined by an offset and a limit.
     *

```solidity
function getLoanParamsList(address owner, uint256 start, uint256 count) external view
returns(loanParamsList bytes32[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| owner | address | The address of the loan owner. | 
| start | uint256 | The page offset. | 
| count | uint256 | The page limit.      * | 

**Returns**

loanParamsList The result array of loan parameters.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLoanParamsList(
        address owner,
        uint256 start,
        uint256 count
    ) external view returns (bytes32[] memory loanParamsList) {
        EnumerableBytes32Set.Bytes32Set storage set = userLoanParamSets[owner];
        uint256 end = start.add(count).min256(set.length());
        if (start >= end) {
            return loanParamsList;
        }

        loanParamsList = new bytes32[](count);
        uint256 itemCount;
        for (uint256 i = end - start; i > 0; i--) {
            if (itemCount == count) {
                break;
            }
            loanParamsList[itemCount] = set.get(i + start - 1);
            itemCount++;
        }

        if (itemCount < count) {
            assembly {
                mstore(loanParamsList, itemCount)
            }
        }
    }
```
</details>

---    

> ### getTotalPrincipal

Get the total principal of the loans by a lender.
     *

```solidity
function getTotalPrincipal(address lender, address loanToken) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lender | address | The address of the lender. | 
| loanToken | address | The address of the token instance.      * | 

**Returns**

The total principal of the loans.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getTotalPrincipal(address lender, address loanToken) external view returns (uint256) {
        return lenderInterest[lender][loanToken].principalTotal;
    }
```
</details>

---    

> ### _setupLoanParams

Setup a loan parameters.
     *

```solidity
function _setupLoanParams(struct LoanParamsStruct.LoanParams loanParamsLocal) internal nonpayable
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsLocal | struct LoanParamsStruct.LoanParams | The loan parameters.      * | 

**Returns**

loanParamsId The loan parameters ID.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _setupLoanParams(LoanParams memory loanParamsLocal) internal returns (bytes32) {
        bytes32 loanParamsId =
            keccak256(
                abi.encodePacked(
                    loanParamsLocal.loanToken,
                    loanParamsLocal.collateralToken,
                    loanParamsLocal.minInitialMargin,
                    loanParamsLocal.maintenanceMargin,
                    loanParamsLocal.maxLoanTerm,
                    block.timestamp
                )
            );
        require(loanParams[loanParamsId].id == 0, "loanParams exists");

        require(
            loanParamsLocal.loanToken != address(0) &&
                loanParamsLocal.collateralToken != address(0) &&
                loanParamsLocal.minInitialMargin > loanParamsLocal.maintenanceMargin &&
                (loanParamsLocal.maxLoanTerm == 0 || loanParamsLocal.maxLoanTerm > 3600), /// A defined maxLoanTerm has to be greater than one hour.
            "invalid params"
        );

        loanParamsLocal.id = loanParamsId;
        loanParamsLocal.active = true;
        loanParamsLocal.owner = msg.sender;

        loanParams[loanParamsId] = loanParamsLocal;
        userLoanParamSets[msg.sender].addBytes32(loanParamsId);

        emit LoanParamsSetup(
            loanParamsId,
            loanParamsLocal.owner,
            loanParamsLocal.loanToken,
            loanParamsLocal.collateralToken,
            loanParamsLocal.minInitialMargin,
            loanParamsLocal.maintenanceMargin,
            loanParamsLocal.maxLoanTerm
        );
        emit LoanParamsIdSetup(loanParamsId, loanParamsLocal.owner);

        return loanParamsId;
    }
```
</details>

---    

> ### minInitialMargin

```solidity
function minInitialMargin(bytes32 loanParamsId) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanParamsId | bytes32 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function minInitialMargin(bytes32 loanParamsId) external view returns (uint256) {
        return loanParams[loanParamsId].minInitialMargin;
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
