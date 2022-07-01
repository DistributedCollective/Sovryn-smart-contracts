# Sovryn Reward Token. (SVR.sol)

View Source: [contracts/governance/Vesting/SVR.sol](../contracts/governance/Vesting/SVR.sol)

**↗ Extends: [ERC20](ERC20.md), [ERC20Detailed](ERC20Detailed.md), [Ownable](Ownable.md), [SafeMath96](SafeMath96.md), [ApprovalReceiver](ApprovalReceiver.md)**

**SVR**

The RSOV token (Sovryn Vesting Reward Token) goal is to allow users to get
rewards through the generation of protocol fees. The mint function accepts
SOV tokens and mints the same amount of RSOV tokens. When burning RSOV
tokens, the user gets 1/14th of the tokens sent back to him and the rest
get staked in the user’s behalf with a schedule of 4 weeks cliff and period
1 year duration.

## Contract Members
**Constants & Variables**

```js
//internal members
string internal constant NAME;
string internal constant SYMBOL;
uint8 internal constant DECIMALS;
uint256 internal constant FOUR_WEEKS;
uint256 internal constant YEAR;
uint96 internal constant DIRECT_TRANSFER_PART;

//public members
contract IERC20_ public SOV;
contract IStaking public staking;

```

**Events**

```js
event Mint(address indexed sender, uint256  amount);
event Burn(address indexed sender, uint256  amount);
```

## Functions

- [constructor(address _SOV, address _staking)](#constructor)
- [mint(uint96 _amount)](#mint)
- [mintWithApproval(address _sender, uint96 _amount)](#mintwithapproval)
- [_mintTo(address _sender, uint96 _amount)](#_mintto)
- [burn(uint96 _amount)](#burn)
- [_getToken()](#_gettoken)
- [_getSelectors()](#_getselectors)

---    

> ### constructor

Create reward token RSOV.

```solidity
function (address _SOV, address _staking) public nonpayable ERC20Detailed 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _SOV | address | The SOV token address. | 
| _staking | address | The staking contract address. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nstructor(address _SOV, address _staking) public ERC20Detailed(NAME, SYMBOL, DECIMALS) {
        require(_SOV != address(0), "SVR::SOV address invalid");
        require(_staking != address(0), "SVR::staking address invalid");

        SOV = IERC20_(_SOV);
        staking = IStaking(_staking);
    }

```
</details>

---    

> ### mint

Hold SOV tokens and mint the respective amount of SVR tokens.

```solidity
function mint(uint96 _amount) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _amount | uint96 | The amount of tokens to be mint. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction mint(uint96 _amount) public {
        _mintTo(msg.sender, _amount);
    }

```
</details>

---    

> ### mintWithApproval

Hold SOV tokens and mint the respective amount of SVR tokens.

```solidity
function mintWithApproval(address _sender, uint96 _amount) public nonpayable onlyThisContract 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sender | address | The sender of SOV.approveAndCall | 
| _amount | uint96 | The amount of tokens to be mint. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction mintWithApproval(address _sender, uint96 _amount) public onlyThisContract {
        _mintTo(_sender, _amount);
    }

```
</details>

---    

> ### _mintTo

The actual minting process, holding SOV and minting RSOV tokens.

```solidity
function _mintTo(address _sender, uint96 _amount) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sender | address | The recipient of the minted tokens. | 
| _amount | uint96 | The amount of tokens to be minted. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction _mintTo(address _sender, uint96 _amount) internal {
        require(_amount > 0, "SVR::mint: amount invalid");

        /// @notice Holds SOV tokens.
        bool success = SOV.transferFrom(_sender, address(this), _amount);
        require(success);

        /// @notice Mints SVR tokens.
        /// @dev uses openzeppelin/ERC20.sol internal _mint function
        _mint(_sender, _amount);

        emit Mint(_sender, _amount);
    }

```
</details>

---    

> ### burn

burns SVR tokens and stakes the respective amount SOV tokens in the user's behalf

```solidity
function burn(uint96 _amount) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _amount | uint96 | the amount of tokens to be burnt | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction burn(uint96 _amount) public {
        require(_amount > 0, "SVR:: burn: amount invalid");

        /// @notice Burns RSOV tokens.
        _burn(msg.sender, _amount);

        /// @notice Transfer 1/14 of amount directly to the user.
        /// If amount is too small it won't be transferred.
        uint96 transferAmount = _amount / DIRECT_TRANSFER_PART;
        if (transferAmount > 0) {
            SOV.transfer(msg.sender, transferAmount);
            _amount -= transferAmount;
        }

        /// @notice Stakes SOV tokens in the user's behalf.
        SOV.approve(address(staking), _amount);

        staking.stakesBySchedule(_amount, FOUR_WEEKS, YEAR, FOUR_WEEKS, msg.sender, msg.sender);

        emit Burn(msg.sender, _amount);
    }

```
</details>

---    

> ### _getToken

⤾ overrides [ApprovalReceiver._getToken](ApprovalReceiver.md#_gettoken)

Override default ApprovalReceiver._getToken function to
register SOV token on this contract.

```solidity
function _getToken() internal view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction _getToken() internal view returns (address) {
        return address(SOV);
    }

```
</details>

---    

> ### _getSelectors

⤾ overrides [ApprovalReceiver._getSelectors](ApprovalReceiver.md#_getselectors)

Override default ApprovalReceiver._getSelectors function to
register mintWithApproval selector on this contract.

```solidity
function _getSelectors() internal view
returns(bytes4[])
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction _getSelectors() internal view returns (bytes4[] memory) {
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = this.mintWithApproval.selector;
        return selectors;
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
