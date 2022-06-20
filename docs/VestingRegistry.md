# Vesting Registry contract.
 * (VestingRegistry.sol)

View Source: [contracts/governance/Vesting/VestingRegistry.sol](../contracts/governance/Vesting/VestingRegistry.sol)

**↗ Extends: [Ownable](Ownable.md)**

**VestingRegistry**

On January 25, 2020, Sovryn launched the Genesis Reservation system.
Sovryn community members who controlled a special NFT were granted access to
stake BTC or rBTC for cSOV tokens at a rate of 2500 satoshis per cSOV. Per
SIP-0003, up to 2,000,000 cSOV were made available in the Genesis event,
which will be redeemable on a 1:1 basis for cSOV, subject to approval by
existing SOV holders.
 * On 15 Feb 2021 Sovryn is taking another step in its journey to decentralized
financial sovereignty with the vote on SIP 0005. This proposal will enable
participants of the Genesis Reservation system to redeem their reserved cSOV
tokens for SOV. They will also have the choice to redeem cSOV for rBTC if
they decide to exit the system.
 * This contract deals with the vesting and redemption of cSOV tokens.

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
uint256 public constant FOUR_WEEKS;
uint256 public constant CSOV_VESTING_CLIFF;
uint256 public constant CSOV_VESTING_DURATION;
contract IVestingFactory public vestingFactory;
address public SOV;
address[] public CSOVtokens;
uint256 public priceSats;
address public staking;
address public feeSharingProxy;
address public vestingOwner;
mapping(address => mapping(uint256 => address)) public vestingContracts;
mapping(address => bool) public processedList;
mapping(address => bool) public blacklist;
mapping(address => uint256) public lockedAmount;
mapping(address => bool) public admins;

```

**Events**

```js
event CSOVReImburse(address  from, uint256  CSOVamount, uint256  reImburseAmount);
event CSOVTokensExchanged(address indexed caller, uint256  amount);
event SOVTransferred(address indexed receiver, uint256  amount);
event VestingCreated(address indexed tokenOwner, address  vesting, uint256  cliff, uint256  duration, uint256  amount);
event TeamVestingCreated(address indexed tokenOwner, address  vesting, uint256  cliff, uint256  duration, uint256  amount);
event TokensStaked(address indexed vesting, uint256  amount);
event AdminAdded(address  admin);
event AdminRemoved(address  admin);
```

## Modifiers

- [onlyAuthorized](#onlyauthorized)
- [isNotProcessed](#isnotprocessed)
- [isNotBlacklisted](#isnotblacklisted)

### onlyAuthorized

Throws if called by any account other than the owner or admin.
TODO: This ACL logic should be available on OpenZeppeling Ownable.sol
or on our own overriding sovrynOwnable. This same logic is repeated
on OriginInvestorsClaim.sol, TokenSender.sol and VestingRegistry2.sol

```js
modifier onlyAuthorized() internal
```

### isNotProcessed

```js
modifier isNotProcessed() internal
```

### isNotBlacklisted

```js
modifier isNotBlacklisted() internal
```

## Functions

- [constructor(address _vestingFactory, address _SOV, address[] _CSOVtokens, uint256 _priceSats, address _staking, address _feeSharingProxy, address _vestingOwner)](#constructor)
- [addAdmin(address _admin)](#addadmin)
- [removeAdmin(address _admin)](#removeadmin)
- [reImburse()](#reimburse)
- [budget()](#budget)
- [deposit()](#deposit)
- [withdrawAll(address payable to)](#withdrawall)
- [setVestingFactory(address _vestingFactory)](#setvestingfactory)
- [_setVestingFactory(address _vestingFactory)](#_setvestingfactory)
- [setCSOVtokens(address[] _CSOVtokens)](#setcsovtokens)
- [_setCSOVtokens(address[] _CSOVtokens)](#_setcsovtokens)
- [setBlacklistFlag(address _account, bool _blacklisted)](#setblacklistflag)
- [setLockedAmount(address _account, uint256 _amount)](#setlockedamount)
- [transferSOV(address _receiver, uint256 _amount)](#transfersov)
- [exchangeAllCSOV()](#exchangeallcsov)
- [_createVestingForCSOV(uint256 _amount)](#_createvestingforcsov)
- [_validateCSOV(address _CSOV)](#_validatecsov)
- [createVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration)](#createvesting)
- [createTeamVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration)](#createteamvesting)
- [stakeTokens(address _vesting, uint256 _amount)](#staketokens)
- [getVesting(address _tokenOwner)](#getvesting)
- [getTeamVesting(address _tokenOwner)](#getteamvesting)
- [_getOrCreateVesting(address _tokenOwner, uint256 _cliff, uint256 _duration)](#_getorcreatevesting)
- [_getOrCreateTeamVesting(address _tokenOwner, uint256 _cliff, uint256 _duration)](#_getorcreateteamvesting)

---    

> ### constructor

Contract deployment settings.

```solidity
function (address _vestingFactory, address _SOV, address[] _CSOVtokens, uint256 _priceSats, address _staking, address _feeSharingProxy, address _vestingOwner) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vestingFactory | address | The address of vesting factory contract. | 
| _SOV | address | The SOV token address. | 
| _CSOVtokens | address[] | The array of cSOV tokens. | 
| _priceSats | uint256 | The price of cSOV tokens in satoshis. | 
| _staking | address | The address of staking contract. | 
| _feeSharingProxy | address | The address of fee sharing proxy contract. | 
| _vestingOwner | address | The address of an owner of vesting contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor(
        address _vestingFactory,
        address _SOV,
        address[] memory _CSOVtokens,
        uint256 _priceSats,
        address _staking,
        address _feeSharingProxy,
        address _vestingOwner
    ) public {
        require(_SOV != address(0), "SOV address invalid");
        require(_staking != address(0), "staking address invalid");
        require(_feeSharingProxy != address(0), "feeSharingProxy address invalid");
        require(_vestingOwner != address(0), "vestingOwner address invalid");

        _setVestingFactory(_vestingFactory);
        _setCSOVtokens(_CSOVtokens);

        SOV = _SOV;
        priceSats = _priceSats;
        staking = _staking;
        feeSharingProxy = _feeSharingProxy;
        vestingOwner = _vestingOwner;
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

> ### reImburse

cSOV payout to sender with rBTC currency.
1.- Check holder cSOV balance by adding up every cSOV token balance.
2.- ReImburse rBTC if funds available.
3.- And store holder address in processedList.

```solidity
function reImburse() public nonpayable isNotProcessed isNotBlacklisted 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function reImburse() public isNotProcessed isNotBlacklisted {
        uint256 CSOVAmountWei = 0;
        for (uint256 i = 0; i < CSOVtokens.length; i++) {
            address CSOV = CSOVtokens[i];
            uint256 balance = IERC20(CSOV).balanceOf(msg.sender);
            CSOVAmountWei = CSOVAmountWei.add(balance);
        }

        require(CSOVAmountWei > lockedAmount[msg.sender], "holder has no CSOV");
        CSOVAmountWei -= lockedAmount[msg.sender];
        processedList[msg.sender] = true;

        /**
         * @dev Found and fixed the SIP-0007 bug on VestingRegistry::reImburse formula.
         * More details at Documenting Code issues at point 11 in
         * https://docs.google.com/document/d/10idTD1K6JvoBmtPKGuJ2Ub_mMh6qTLLlTP693GQKMyU/
         * Previous buggy code: uint256 reImburseAmount = (CSOVAmountWei.mul(priceSats)).div(10**10);
         * */
        uint256 reImburseAmount = (CSOVAmountWei.mul(priceSats)).div(10**8);
        require(address(this).balance >= reImburseAmount, "Not enough funds to reimburse");
        msg.sender.transfer(reImburseAmount);

        emit CSOVReImburse(msg.sender, CSOVAmountWei, reImburseAmount);
    }
```
</details>

---    

> ### budget

Get contract balance.

```solidity
function budget() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function budget() external view returns (uint256) {
        uint256 SCBudget = address(this).balance;
        return SCBudget;
    }
```
</details>

---    

> ### deposit

Deposit function to receiving value (rBTC).

```solidity
function deposit() public payable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function deposit() public payable {}
```
</details>

---    

> ### withdrawAll

Send all contract balance to an account.

```solidity
function withdrawAll(address payable to) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| to | address payable | The account address to send the balance to. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawAll(address payable to) public onlyOwner {
        to.transfer(address(this).balance);
    }
```
</details>

---    

> ### setVestingFactory

Sets vesting factory address. High level endpoint.

```solidity
function setVestingFactory(address _vestingFactory) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vestingFactory | address | The address of vesting factory contract.      * | 

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

Sets vesting factory address. Low level core function.

```solidity
function _setVestingFactory(address _vestingFactory) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vestingFactory | address | The address of vesting factory contract. | 

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

> ### setCSOVtokens

Sets cSOV tokens array. High level endpoint.

```solidity
function setCSOVtokens(address[] _CSOVtokens) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _CSOVtokens | address[] | The array of cSOV tokens. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setCSOVtokens(address[] memory _CSOVtokens) public onlyOwner {
        _setCSOVtokens(_CSOVtokens);
    }
```
</details>

---    

> ### _setCSOVtokens

Sets cSOV tokens array by looping through input. Low level function.

```solidity
function _setCSOVtokens(address[] _CSOVtokens) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _CSOVtokens | address[] | The array of cSOV tokens. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _setCSOVtokens(address[] memory _CSOVtokens) internal {
        for (uint256 i = 0; i < _CSOVtokens.length; i++) {
            require(_CSOVtokens[i] != address(0), "CSOV address invalid");
        }
        CSOVtokens = _CSOVtokens;
    }
```
</details>

---    

> ### setBlacklistFlag

Set blacklist flag (true/false).

```solidity
function setBlacklistFlag(address _account, bool _blacklisted) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _account | address | The address to be blacklisted. | 
| _blacklisted | bool | The flag to add/remove to/from a blacklist. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setBlacklistFlag(address _account, bool _blacklisted) public onlyOwner {
        require(_account != address(0), "account address invalid");

        blacklist[_account] = _blacklisted;
    }
```
</details>

---    

> ### setLockedAmount

Set amount to be subtracted from user token balance.

```solidity
function setLockedAmount(address _account, uint256 _amount) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _account | address | The address with locked amount. | 
| _amount | uint256 | The amount to be locked. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setLockedAmount(address _account, uint256 _amount) public onlyOwner {
        require(_account != address(0), "account address invalid");
        require(_amount != 0, "amount invalid");

        lockedAmount[_account] = _amount;
    }
```
</details>

---    

> ### transferSOV

Transfer SOV tokens to given address.
     *

```solidity
function transferSOV(address _receiver, uint256 _amount) public nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _receiver | address | The address of the SOV receiver. | 
| _amount | uint256 | The amount to be transferred. | 

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

> ### exchangeAllCSOV

Exchange cSOV to SOV with 1:1 rate

```solidity
function exchangeAllCSOV() public nonpayable isNotProcessed isNotBlacklisted 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function exchangeAllCSOV() public isNotProcessed isNotBlacklisted {
        processedList[msg.sender] = true;

        uint256 amount = 0;
        for (uint256 i = 0; i < CSOVtokens.length; i++) {
            address CSOV = CSOVtokens[i];
            uint256 balance = IERC20(CSOV).balanceOf(msg.sender);
            amount += balance;
        }

        require(amount > lockedAmount[msg.sender], "amount invalid");
        amount -= lockedAmount[msg.sender];

        _createVestingForCSOV(amount);
    }
```
</details>

---    

> ### _createVestingForCSOV

cSOV tokens are moved and staked on Vesting contract.

```solidity
function _createVestingForCSOV(uint256 _amount) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _amount | uint256 | The amount of tokens to be vested. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _createVestingForCSOV(uint256 _amount) internal {
        address vesting =
            _getOrCreateVesting(msg.sender, CSOV_VESTING_CLIFF, CSOV_VESTING_DURATION);

        IERC20(SOV).approve(vesting, _amount);
        IVesting(vesting).stakeTokens(_amount);

        emit CSOVTokensExchanged(msg.sender, _amount);
    }
```
</details>

---    

> ### _validateCSOV

Check a token address is among the cSOV token addresses.

```solidity
function _validateCSOV(address _CSOV) internal view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _CSOV | address | The cSOV token address. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _validateCSOV(address _CSOV) internal view {
        bool isValid = false;
        for (uint256 i = 0; i < CSOVtokens.length; i++) {
            if (_CSOV == CSOVtokens[i]) {
                isValid = true;
                break;
            }
        }
        require(isValid, "wrong CSOV address");
    }
```
</details>

---    

> ### createVesting

Create Vesting contract.

```solidity
function createVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration) public nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address | The owner of the tokens. | 
| _amount | uint256 | The amount to be staked. | 
| _cliff | uint256 | The time interval to the first withdraw in seconds. | 
| _duration | uint256 | The total duration in seconds. | 

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

Create Team Vesting contract.

```solidity
function createTeamVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration) public nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address | The owner of the tokens. | 
| _amount | uint256 | The amount to be staked. | 
| _cliff | uint256 | The time interval to the first withdraw in seconds. | 
| _duration | uint256 | The total duration in seconds. | 

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

Stake tokens according to the vesting schedule.

```solidity
function stakeTokens(address _vesting, uint256 _amount) public nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vesting | address | The address of Vesting contract. | 
| _amount | uint256 | The amount of tokens to stake. | 

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

Query the vesting contract for an account.

```solidity
function getVesting(address _tokenOwner) public view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address | The owner of the tokens. | 

**Returns**

The vesting contract address for the given token owner.

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

Query the team vesting contract for an account.

```solidity
function getTeamVesting(address _tokenOwner) public view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address | The owner of the tokens. | 

**Returns**

The team vesting contract address for the given token owner.

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

If not exists, deploy a vesting contract through factory.

```solidity
function _getOrCreateVesting(address _tokenOwner, uint256 _cliff, uint256 _duration) internal nonpayable
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address | The owner of the tokens. | 
| _cliff | uint256 | The time interval to the first withdraw in seconds. | 
| _duration | uint256 | The total duration in seconds. | 

**Returns**

The vesting contract address for the given token owner
whether it existed previously or not.

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
            /// @dev TODO: Owner of OwnerVesting contracts - the same address as tokenOwner.
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

If not exists, deploy a team vesting contract through factory.

```solidity
function _getOrCreateTeamVesting(address _tokenOwner, uint256 _cliff, uint256 _duration) internal nonpayable
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address | The owner of the tokens. | 
| _cliff | uint256 | The time interval to the first withdraw in seconds. | 
| _duration | uint256 | The total duration in seconds. | 

**Returns**

The team vesting contract address for the given token owner
whether it existed previously or not.

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
