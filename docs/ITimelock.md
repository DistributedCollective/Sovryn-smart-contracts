# ITimelock.sol

View Source: [contracts/governance/Timelock.sol](../contracts/governance/Timelock.sol)

**↗ Extends: [ErrorDecoder](ErrorDecoder.md), [ITimelock](ITimelock.md)**
**↘ Derived Contracts: [ITimelock](ITimelock.md), [Timelock](Timelock.md)**

**ITimelock**

## Contract Members
**Constants & Variables**

```js
uint256 public constant GRACE_PERIOD;
uint256 public constant MINIMUM_DELAY;
uint256 public constant MAXIMUM_DELAY;
address public admin;
address public pendingAdmin;
uint256 public delay;
mapping(bytes32 => bool) public queuedTransactions;

```

**Events**

```js
event NewAdmin(address indexed newAdmin);
event NewPendingAdmin(address indexed newPendingAdmin);
event NewDelay(uint256 indexed newDelay);
event CancelTransaction(bytes32 indexed txHash, address indexed target, uint256  value, string  signature, bytes  data, uint256  eta);
event ExecuteTransaction(bytes32 indexed txHash, address indexed target, uint256  value, string  signature, bytes  data, uint256  eta);
event QueueTransaction(bytes32 indexed txHash, address indexed target, uint256  value, string  signature, bytes  data, uint256  eta);
```

## Functions

- [delay()](#delay)
- [GRACE_PERIOD()](#grace_period)
- [acceptAdmin()](#acceptadmin)
- [queuedTransactions(bytes32 hash)](#queuedtransactions)
- [queueTransaction(address target, uint256 value, string signature, bytes data, uint256 eta)](#queuetransaction)
- [cancelTransaction(address target, uint256 value, string signature, bytes data, uint256 eta)](#canceltransaction)
- [executeTransaction(address target, uint256 value, string signature, bytes data, uint256 eta)](#executetransaction)
- [constructor(address admin_, uint256 delay_)](#constructor)
- [constructor()](#constructor)
- [setDelay(uint256 delay_)](#setdelay)
- [acceptAdmin()](#acceptadmin)
- [setPendingAdmin(address pendingAdmin_)](#setpendingadmin)
- [queueTransaction(address target, uint256 value, string signature, bytes data, uint256 eta)](#queuetransaction)
- [cancelTransaction(address target, uint256 value, string signature, bytes data, uint256 eta)](#canceltransaction)
- [executeTransaction(address target, uint256 value, string signature, bytes data, uint256 eta)](#executetransaction)
- [getBlockTimestamp()](#getblocktimestamp)

---    

> ### delay

```solidity
function delay() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function delay() external view returns (uint256);
```
</details>

---    

> ### GRACE_PERIOD

```solidity
function GRACE_PERIOD() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function GRACE_PERIOD() external view returns (uint256);
```
</details>

---    

> ### acceptAdmin

⤿ Overridden Implementation(s): [ITimelock.acceptAdmin](ITimelock.md#acceptadmin),[Timelock.acceptAdmin](Timelock.md#acceptadmin)

```solidity
function acceptAdmin() external nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function acceptAdmin() external;
```
</details>

---    

> ### queuedTransactions

```solidity
function queuedTransactions(bytes32 hash) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| hash | bytes32 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function queuedTransactions(bytes32 hash) external view returns (bool);
```
</details>

---    

> ### queueTransaction

⤿ Overridden Implementation(s): [ITimelock.queueTransaction](ITimelock.md#queuetransaction),[Timelock.queueTransaction](Timelock.md#queuetransaction)

```solidity
function queueTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) external nonpayable
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address |  | 
| value | uint256 |  | 
| signature | string |  | 
| data | bytes |  | 
| eta | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function queueTransaction(
        address target,
        uint256 value,
        string calldata signature,
        bytes calldata data,
        uint256 eta
    ) external returns (bytes32);
```
</details>

---    

> ### cancelTransaction

⤿ Overridden Implementation(s): [ITimelock.cancelTransaction](ITimelock.md#canceltransaction),[Timelock.cancelTransaction](Timelock.md#canceltransaction)

```solidity
function cancelTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address |  | 
| value | uint256 |  | 
| signature | string |  | 
| data | bytes |  | 
| eta | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function cancelTransaction(
        address target,
        uint256 value,
        string calldata signature,
        bytes calldata data,
        uint256 eta
    ) external;
```
</details>

---    

> ### executeTransaction

⤿ Overridden Implementation(s): [ITimelock.executeTransaction](ITimelock.md#executetransaction),[Timelock.executeTransaction](Timelock.md#executetransaction)

```solidity
function executeTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) external payable
returns(bytes)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address |  | 
| value | uint256 |  | 
| signature | string |  | 
| data | bytes |  | 
| eta | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function executeTransaction(
        address target,
        uint256 value,
        string calldata signature,
        bytes calldata data,
        uint256 eta
    ) external payable returns (bytes memory);
```
</details>

---    

> ### constructor

Function called on instance deployment of the contract.

```solidity
function (address admin_, uint256 delay_) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| admin_ | address | Governance contract address. | 
| delay_ | uint256 | Time to wait for queued transactions to be executed. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
tor(address admin_, uint256 delay_) public {
        require(
            delay_ >= MINIMUM_DELAY,
            "Timelock::constructor: Delay must exceed minimum delay."
        );
        require(
            delay_ <= MAXIMUM_DELAY,
            "Timelock::setDelay: Delay must not exceed maximum delay."
        );

        admin = admin_;
        delay = delay_;
    }

    /*
```
</details>

---    

> ### constructor

Fallback function is to react to receiving value (rBTC).

```solidity
function () external payable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
() external payable {}

    /*
```
</details>

---    

> ### setDelay

Set a new delay when executing the contract calls.

```solidity
function setDelay(uint256 delay_) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| delay_ | uint256 | The amount of time to wait until execution. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 setDelay(uint256 delay_) public {
        require(msg.sender == address(this), "Timelock::setDelay: Call must come from Timelock.");
        require(delay_ >= MINIMUM_DELAY, "Timelock::setDelay: Delay must exceed minimum delay.");
        require(
            delay_ <= MAXIMUM_DELAY,
            "Timelock::setDelay: Delay must not exceed maximum delay."
        );
        delay = delay_;

        emit NewDelay(delay);
    }

    /*
```
</details>

---    

> ### acceptAdmin

⤾ overrides [ITimelock.acceptAdmin](ITimelock.md#acceptadmin)

Accept a new admin for the timelock.

```solidity
function acceptAdmin() public nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 acceptAdmin() public {
        require(
            msg.sender == pendingAdmin,
            "Timelock::acceptAdmin: Call must come from pendingAdmin."
        );
        admin = msg.sender;
        pendingAdmin = address(0);

        emit NewAdmin(admin);
    }

    /*
```
</details>

---    

> ### setPendingAdmin

Set a new pending admin for the timelock.

```solidity
function setPendingAdmin(address pendingAdmin_) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| pendingAdmin_ | address | The new pending admin address. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 setPendingAdmin(address pendingAdmin_) public {
        require(
            msg.sender == address(this),
            "Timelock::setPendingAdmin: Call must come from Timelock."
        );
        pendingAdmin = pendingAdmin_;

        emit NewPendingAdmin(pendingAdmin);
    }

    /*
```
</details>

---    

> ### queueTransaction

⤾ overrides [ITimelock.queueTransaction](ITimelock.md#queuetransaction)

Queue a new transaction from the governance contract.

```solidity
function queueTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) public nonpayable
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address | The contract to call. | 
| value | uint256 | The amount to send in the transaction. | 
| signature | string | The stanndard representation of the function called. | 
| data | bytes | The ethereum transaction input data payload. | 
| eta | uint256 | Estimated Time of Accomplishment. The timestamp that the proposal will be available for execution, set once the vote succeeds. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 queueTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) public returns (bytes32) {
        require(msg.sender == admin, "Timelock::queueTransaction: Call must come from admin.");
        require(
            eta >= getBlockTimestamp().add(delay),
            "Timelock::queueTransaction: Estimated execution block must satisfy delay."
        );

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        queuedTransactions[txHash] = true;

        emit QueueTransaction(txHash, target, value, signature, data, eta);
        return txHash;
    }

    /*
```
</details>

---    

> ### cancelTransaction

⤾ overrides [ITimelock.cancelTransaction](ITimelock.md#canceltransaction)

Cancel a transaction.

```solidity
function cancelTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address | The contract to call. | 
| value | uint256 | The amount to send in the transaction. | 
| signature | string | The stanndard representation of the function called. | 
| data | bytes | The ethereum transaction input data payload. | 
| eta | uint256 | Estimated Time of Accomplishment. The timestamp that the proposal will be available for execution, set once the vote succeeds. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 cancelTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) public {
        require(msg.sender == admin, "Timelock::cancelTransaction: Call must come from admin.");

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        queuedTransactions[txHash] = false;

        emit CancelTransaction(txHash, target, value, signature, data, eta);
    }

    /*
```
</details>

---    

> ### executeTransaction

⤾ overrides [ITimelock.executeTransaction](ITimelock.md#executetransaction)

Executes a previously queued transaction from the governance.

```solidity
function executeTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) public payable
returns(bytes)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address | The contract to call. | 
| value | uint256 | The amount to send in the transaction. | 
| signature | string | The stanndard representation of the function called. | 
| data | bytes | The ethereum transaction input data payload. | 
| eta | uint256 | Estimated Time of Accomplishment. The timestamp that the proposal will be available for execution, set once the vote succeeds. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 executeTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) public payable returns (bytes memory) {
        require(msg.sender == admin, "Timelock::executeTransaction: Call must come from admin.");

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        require(
            queuedTransactions[txHash],
            "Timelock::executeTransaction: Transaction hasn't been queued."
        );
        require(
            getBlockTimestamp() >= eta,
            "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
        );
        require(
            getBlockTimestamp() <= eta.add(GRACE_PERIOD),
            "Timelock::executeTransaction: Transaction is stale."
        );

        queuedTransactions[txHash] = false;

        bytes memory callData;

        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        }

        // solium-disable-next-line security/no-call-value
        (bool success, bytes memory returnData) = target.call.value(value)(callData);
        if (!success) {
            if (returnData.length <= ERROR_MESSAGE_SHIFT) {
                revert("Timelock::executeTransaction: Transaction execution reverted.");
            } else {
                revert(_addErrorMessage("Timelock::executeTransaction: ", string(returnData)));
            }
        }

        emit ExecuteTransaction(txHash, target, value, signature, data, eta);

        return returnData;
    }

    /*
```
</details>

---    

> ### getBlockTimestamp

A function used to get the current Block Timestamp.

```solidity
function getBlockTimestamp() internal view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 getBlockTimestamp() internal view returns (uint256) {
        // solium-disable-next-line security/no-block-members
        return block.timestamp;
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
