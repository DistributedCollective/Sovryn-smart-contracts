# Swaps Implementation Sovryn contract.
 * (SwapsImplSovrynSwap.sol)

View Source: [contracts/swaps/connectors/SwapsImplSovrynSwap.sol](../contracts/swaps/connectors/SwapsImplSovrynSwap.sol)

**↗ Extends: [State](State.md), [ISwapsImpl](ISwapsImpl.md)**

**SwapsImplSovrynSwap**

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
 * This contract contains the implementation of swap process and rate
calculations for Sovryn network.

## Functions

- [getContractHexName(string source)](#getcontracthexname)
- [getSovrynSwapNetworkContract(address sovrynSwapRegistryAddress)](#getsovrynswapnetworkcontract)
- [internalSwap(address sourceTokenAddress, address destTokenAddress, address receiverAddress, address returnToSenderAddress, uint256 minSourceTokenAmount, uint256 maxSourceTokenAmount, uint256 requiredDestTokenAmount)](#internalswap)
- [allowTransfer(uint256 tokenAmount, address tokenAddress, address sovrynSwapNetwork)](#allowtransfer)
- [estimateSourceTokenAmount(address sourceTokenAddress, address destTokenAddress, uint256 requiredDestTokenAmount, uint256 maxSourceTokenAmount)](#estimatesourcetokenamount)
- [internalExpectedRate(address sourceTokenAddress, address destTokenAddress, uint256 sourceTokenAmount, address sovrynSwapContractRegistryAddress)](#internalexpectedrate)
- [internalExpectedReturn(address sourceTokenAddress, address destTokenAddress, uint256 sourceTokenAmount, address sovrynSwapContractRegistryAddress)](#internalexpectedreturn)

---    

> ### getContractHexName

```solidity
function getContractHexName(string source) public pure
returns(result bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| source | string | The name of the contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getContractHexName(string memory source) public pure returns (bytes32 result) {
        assembly {
            result := mload(add(source, 32))
        }
    }
```
</details>

---    

> ### getSovrynSwapNetworkContract

```solidity
function getSovrynSwapNetworkContract(address sovrynSwapRegistryAddress) public view
returns(contract ISovrynSwapNetwork)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sovrynSwapRegistryAddress | address | The address of the registry. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getSovrynSwapNetworkContract(address sovrynSwapRegistryAddress)
        public
        view
        returns (ISovrynSwapNetwork)
    {
        /// State variable sovrynSwapContractRegistryAddress is part of
        /// State.sol and set in ProtocolSettings.sol and this function
        /// needs to work without delegate call as well -> therefore pass it.
        IContractRegistry contractRegistry = IContractRegistry(sovrynSwapRegistryAddress);
        return
            ISovrynSwapNetwork(
                contractRegistry.addressOf(getContractHexName("SovrynSwapNetwork"))
            );
    }
```
</details>

---    

> ### internalSwap

⤾ overrides [ISwapsImpl.internalSwap](ISwapsImpl.md#internalswap)

```solidity
function internalSwap(address sourceTokenAddress, address destTokenAddress, address receiverAddress, address returnToSenderAddress, uint256 minSourceTokenAmount, uint256 maxSourceTokenAmount, uint256 requiredDestTokenAmount) public payable
returns(destTokenAmountReceived uint256, sourceTokenAmountUsed uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceTokenAddress | address | The address of the source tokens. | 
| destTokenAddress | address | The address of the destination tokens. | 
| receiverAddress | address | The address who will received the swap token results | 
| returnToSenderAddress | address | The address to return unspent tokens to (when called by the protocol, it's always the protocol contract). | 
| minSourceTokenAmount | uint256 | The minimum amount of source tokens to swapped (only considered if requiredDestTokens == 0). | 
| maxSourceTokenAmount | uint256 | The maximum amount of source tokens to swapped. | 
| requiredDestTokenAmount | uint256 | The required amount of destination tokens. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function internalSwap(
        address sourceTokenAddress,
        address destTokenAddress,
        address receiverAddress,
        address returnToSenderAddress,
        uint256 minSourceTokenAmount,
        uint256 maxSourceTokenAmount,
        uint256 requiredDestTokenAmount
    ) public payable returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed) {
        require(sourceTokenAddress != destTokenAddress, "source == dest");
        require(
            supportedTokens[sourceTokenAddress] && supportedTokens[destTokenAddress],
            "invalid tokens"
        );

        ISovrynSwapNetwork sovrynSwapNetwork =
            getSovrynSwapNetworkContract(sovrynSwapContractRegistryAddress);
        IERC20[] memory path =
            sovrynSwapNetwork.conversionPath(IERC20(sourceTokenAddress), IERC20(destTokenAddress));

        uint256 minReturn = 0;
        sourceTokenAmountUsed = minSourceTokenAmount;

        /// If the required amount of destination tokens is passed, we need to
        /// calculate the estimated amount of source tokens regardless of the
        /// minimum source token amount (name is misleading).
        if (requiredDestTokenAmount > 0) {
            sourceTokenAmountUsed = estimateSourceTokenAmount(
                sourceTokenAddress,
                destTokenAddress,
                requiredDestTokenAmount,
                maxSourceTokenAmount
            );
            /// sovrynSwapNetwork.rateByPath does not return a rate, but instead the amount of destination tokens returned.
            require(
                sovrynSwapNetwork.rateByPath(path, sourceTokenAmountUsed) >=
                    requiredDestTokenAmount,
                "insufficient source tokens provided."
            );
            minReturn = requiredDestTokenAmount;
        } else if (sourceTokenAmountUsed > 0) {
            /// For some reason the Sovryn swap network tends to return a bit less than the expected rate.
            minReturn = sovrynSwapNetwork.rateByPath(path, sourceTokenAmountUsed).mul(995).div(
                1000
            );
        }

        require(sourceTokenAmountUsed > 0, "cannot swap 0 tokens");

        allowTransfer(sourceTokenAmountUsed, sourceTokenAddress, address(sovrynSwapNetwork));

        /// @dev Note: the kyber connector uses .call() to interact with kyber
        /// to avoid bubbling up. here we allow bubbling up.
        destTokenAmountReceived = sovrynSwapNetwork.convertByPath(
            path,
            sourceTokenAmountUsed,
            minReturn,
            receiverAddress,
            address(0),
            0
        );

        /// If the sender is not the protocol (calling with delegatecall),
        /// return the remainder to the specified address.
        /// @dev Note: for the case that the swap is used without the
        /// protocol. Not sure if it should, though. needs to be discussed.
        if (returnToSenderAddress != address(this)) {
            if (sourceTokenAmountUsed < maxSourceTokenAmount) {
                /// Send unused source token back.
                IERC20(sourceTokenAddress).safeTransfer(
                    returnToSenderAddress,
                    maxSourceTokenAmount - sourceTokenAmountUsed
                );
            }
        }
    }
```
</details>

---    

> ### allowTransfer

Check whether the existing allowance suffices to transfer
  the needed amount of tokens.
  If not, allows the transfer of an arbitrary amount of tokens.
     *

```solidity
function allowTransfer(uint256 tokenAmount, address tokenAddress, address sovrynSwapNetwork) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| tokenAmount | uint256 | The amount to transfer. | 
| tokenAddress | address | The address of the token to transfer. | 
| sovrynSwapNetwork | address | The address of the sovrynSwap network contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function allowTransfer(
        uint256 tokenAmount,
        address tokenAddress,
        address sovrynSwapNetwork
    ) internal {
        uint256 tempAllowance = IERC20(tokenAddress).allowance(address(this), sovrynSwapNetwork);
        if (tempAllowance < tokenAmount) {
            IERC20(tokenAddress).safeApprove(sovrynSwapNetwork, uint256(-1));
        }
    }
```
</details>

---    

> ### estimateSourceTokenAmount

Calculate the number of source tokens to provide in order to
  obtain the required destination amount.
     *

```solidity
function estimateSourceTokenAmount(address sourceTokenAddress, address destTokenAddress, uint256 requiredDestTokenAmount, uint256 maxSourceTokenAmount) internal view
returns(estimatedSourceAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceTokenAddress | address | The address of the source token address. | 
| destTokenAddress | address | The address of the destination token address. | 
| requiredDestTokenAmount | uint256 | The number of destination tokens needed. | 
| maxSourceTokenAmount | uint256 | The maximum number of source tokens to spend.      * | 

**Returns**

The estimated amount of source tokens needed.
  Minimum: minSourceTokenAmount, maximum: maxSourceTokenAmount

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function estimateSourceTokenAmount(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 requiredDestTokenAmount,
        uint256 maxSourceTokenAmount
    ) internal view returns (uint256 estimatedSourceAmount) {
        uint256 sourceToDestPrecision =
            IPriceFeeds(priceFeeds).queryPrecision(sourceTokenAddress, destTokenAddress);
        if (sourceToDestPrecision == 0) return maxSourceTokenAmount;

        /// Compute the expected rate for the maxSourceTokenAmount -> if spending less, we can't get a worse rate.
        uint256 expectedRate =
            internalExpectedRate(
                sourceTokenAddress,
                destTokenAddress,
                maxSourceTokenAmount,
                sovrynSwapContractRegistryAddress
            );

        /// Compute the source tokens needed to get the required amount with the worst case rate.
        estimatedSourceAmount = requiredDestTokenAmount.mul(sourceToDestPrecision).div(
            expectedRate
        );

        /// If the actual rate is exactly the same as the worst case rate, we get rounding issues. So, add a small buffer.
        /// buffer = min(estimatedSourceAmount/1000 , sourceBuffer) with sourceBuffer = 10000
        uint256 buffer = estimatedSourceAmount.div(1000);
        if (buffer > sourceBuffer) buffer = sourceBuffer;
        estimatedSourceAmount = estimatedSourceAmount.add(buffer);

        /// Never spend more than the maximum.
        if (estimatedSourceAmount == 0 || estimatedSourceAmount > maxSourceTokenAmount)
            return maxSourceTokenAmount;
    }
```
</details>

---    

> ### internalExpectedRate

⤾ overrides [ISwapsImpl.internalExpectedRate](ISwapsImpl.md#internalexpectedrate)

Get the expected rate for 1 source token when exchanging the
  given amount of source tokens.
     *

```solidity
function internalExpectedRate(address sourceTokenAddress, address destTokenAddress, uint256 sourceTokenAmount, address sovrynSwapContractRegistryAddress) public view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceTokenAddress | address | The address of the source token contract. | 
| destTokenAddress | address | The address of the destination token contract. | 
| sourceTokenAmount | uint256 | The amount of source tokens to get the rate for. | 
| sovrynSwapContractRegistryAddress | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function internalExpectedRate(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount,
        address sovrynSwapContractRegistryAddress
    ) public view returns (uint256) {
        ISovrynSwapNetwork sovrynSwapNetwork =
            getSovrynSwapNetworkContract(sovrynSwapContractRegistryAddress);
        IERC20[] memory path =
            sovrynSwapNetwork.conversionPath(IERC20(sourceTokenAddress), IERC20(destTokenAddress));
        /// Is returning the total amount of destination tokens.
        uint256 expectedReturn = sovrynSwapNetwork.rateByPath(path, sourceTokenAmount);

        /// Return the rate for 1 token with 18 decimals.
        return expectedReturn.mul(10**18).div(sourceTokenAmount);
    }
```
</details>

---    

> ### internalExpectedReturn

⤾ overrides [ISwapsImpl.internalExpectedReturn](ISwapsImpl.md#internalexpectedreturn)

Get the expected return amount when exchanging the given
  amount of source tokens.
     *

```solidity
function internalExpectedReturn(address sourceTokenAddress, address destTokenAddress, uint256 sourceTokenAmount, address sovrynSwapContractRegistryAddress) public view
returns(expectedReturn uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceTokenAddress | address | The address of the source token contract. | 
| destTokenAddress | address | The address of the destination token contract. | 
| sourceTokenAmount | uint256 | The amount of source tokens to get the return for. | 
| sovrynSwapContractRegistryAddress | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function internalExpectedReturn(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount,
        address sovrynSwapContractRegistryAddress
    ) public view returns (uint256 expectedReturn) {
        ISovrynSwapNetwork sovrynSwapNetwork =
            getSovrynSwapNetworkContract(sovrynSwapContractRegistryAddress);
        IERC20[] memory path =
            sovrynSwapNetwork.conversionPath(IERC20(sourceTokenAddress), IERC20(destTokenAddress));
        /// Is returning the total amount of destination tokens.
        expectedReturn = sovrynSwapNetwork.rateByPath(path, sourceTokenAmount);
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
