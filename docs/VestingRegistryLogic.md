# VestingRegistryLogic.sol

View Source: [contracts/governance/Vesting/VestingRegistryLogic.sol](../contracts/governance/Vesting/VestingRegistryLogic.sol)

**↗ Extends: [VestingRegistryStorage](VestingRegistryStorage.md)**

**VestingRegistryLogic**

**Events**

```js
event SOVTransferred(address indexed receiver, uint256  amount);
event VestingCreated(address indexed tokenOwner, address  vesting, uint256  cliff, uint256  duration, uint256  amount, uint256  vestingCreationType);
event TeamVestingCreated(address indexed tokenOwner, address  vesting, uint256  cliff, uint256  duration, uint256  amount, uint256  vestingCreationType);
event TokensStaked(address indexed vesting, uint256  amount);
```

## Functions

- [initialize(address _vestingFactory, address _SOV, address _staking, address _feeSharingProxy, address _vestingOwner, address _lockedSOV, address[] _vestingRegistries)](#initialize)
- [setVestingFactory(address _vestingFactory)](#setvestingfactory)
- [_setVestingFactory(address _vestingFactory)](#_setvestingfactory)
- [transferSOV(address _receiver, uint256 _amount)](#transfersov)
- [addDeployedVestings(address[] _tokenOwners, uint256[] _vestingCreationTypes)](#adddeployedvestings)
- [addFourYearVestings(address[] _tokenOwners, address[] _vestingAddresses)](#addfouryearvestings)
- [createVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration)](#createvesting)
- [createVestingAddr(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration, uint256 _vestingCreationType)](#createvestingaddr)
- [createTeamVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration, uint256 _vestingCreationType)](#createteamvesting)
- [stakeTokens(address _vesting, uint256 _amount)](#staketokens)
- [getVesting(address _tokenOwner)](#getvesting)
- [getVestingAddr(address _tokenOwner, uint256 _cliff, uint256 _duration, uint256 _vestingCreationType)](#getvestingaddr)
- [getTeamVesting(address _tokenOwner, uint256 _cliff, uint256 _duration, uint256 _vestingCreationType)](#getteamvesting)
- [_getOrCreateVesting(address _tokenOwner, uint256 _cliff, uint256 _duration, uint256 _type, uint256 _vestingCreationType)](#_getorcreatevesting)
- [_addDeployedVestings(address _tokenOwner, uint256 _vestingCreationType)](#_adddeployedvestings)
- [getVestingsOf(address _tokenOwner)](#getvestingsof)
- [getVestingDetails(address _vestingAddress)](#getvestingdetails)
- [isVestingAdress(address _vestingAddress)](#isvestingadress)

---    

> ### initialize

Replace constructor with initialize function for Upgradable Contracts
This function will be called only once by the owner

```solidity
function initialize(address _vestingFactory, address _SOV, address _staking, address _feeSharingProxy, address _vestingOwner, address _lockedSOV, address[] _vestingRegistries) external nonpayable onlyOwner initializer 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vestingFactory | address |  | 
| _SOV | address |  | 
| _staking | address |  | 
| _feeSharingProxy | address |  | 
| _vestingOwner | address |  | 
| _lockedSOV | address |  | 
| _vestingRegistries | address[] |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function initialize(
        address _vestingFactory,
        address _SOV,
        address _staking,
        address _feeSharingProxy,
        address _vestingOwner,
        address _lockedSOV,
        address[] calldata _vestingRegistries
    ) external onlyOwner initializer {
        require(_SOV != address(0), "SOV address invalid");
        require(_staking != address(0), "staking address invalid");
        require(_feeSharingProxy != address(0), "feeSharingProxy address invalid");
        require(_vestingOwner != address(0), "vestingOwner address invalid");
        require(_lockedSOV != address(0), "LockedSOV address invalid");

        _setVestingFactory(_vestingFactory);
        SOV = _SOV;
        staking = _staking;
        feeSharingProxy = _feeSharingProxy;
        vestingOwner = _vestingOwner;
        lockedSOV = LockedSOV(_lockedSOV);
        for (uint256 i = 0; i < _vestingRegistries.length; i++) {
            require(_vestingRegistries[i] != address(0), "Vesting registry address invalid");
            vestingRegistries.push(IVestingRegistry(_vestingRegistries[i]));
        }
    }
```
</details>

---    

> ### setVestingFactory

sets vesting factory address

```solidity
function setVestingFactory(address _vestingFactory) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vestingFactory | address | the address of vesting factory contract | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setVestingFactory(address _vestingFactory) external onlyOwner {
        _setVestingFactory(_vestingFactory);
    }
```
</details>

---    

> ### _setVestingFactory

Internal function that sets vesting factory address

```solidity
function _setVestingFactory(address _vestingFactory) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vestingFactory | address | the address of vesting factory contract | 

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
        require(_receiver != address(0), "receiver address invalid");
        require(_amount != 0, "amount invalid");
        require(IERC20(SOV).transfer(_receiver, _amount), "transfer failed");
        emit SOVTransferred(_receiver, _amount);
    }
```
</details>

---    

> ### addDeployedVestings

adds vestings that were deployed in previous vesting registries

```solidity
function addDeployedVestings(address[] _tokenOwners, uint256[] _vestingCreationTypes) external nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwners | address[] |  | 
| _vestingCreationTypes | uint256[] |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addDeployedVestings(
        address[] calldata _tokenOwners,
        uint256[] calldata _vestingCreationTypes
    ) external onlyAuthorized {
        for (uint256 i = 0; i < _tokenOwners.length; i++) {
            require(_tokenOwners[i] != address(0), "token owner cannot be 0 address");
            require(_vestingCreationTypes[i] > 0, "vesting creation type must be greater than 0");
            _addDeployedVestings(_tokenOwners[i], _vestingCreationTypes[i]);
        }
    }
```
</details>

---    

> ### addFourYearVestings

adds four year vestings to vesting registry logic

```solidity
function addFourYearVestings(address[] _tokenOwners, address[] _vestingAddresses) external nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwners | address[] | array of token owners | 
| _vestingAddresses | address[] | array of vesting addresses | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addFourYearVestings(
        address[] calldata _tokenOwners,
        address[] calldata _vestingAddresses
    ) external onlyAuthorized {
        require(_tokenOwners.length == _vestingAddresses.length, "arrays mismatch");
        uint256 vestingCreationType = 4;
        uint256 cliff = 4 weeks;
        uint256 duration = 156 weeks;
        for (uint256 i = 0; i < _tokenOwners.length; i++) {
            require(!isVesting[_vestingAddresses[i]], "vesting exists");
            require(_tokenOwners[i] != address(0), "token owner cannot be 0 address");
            require(_vestingAddresses[i] != address(0), "vesting cannot be 0 address");
            uint256 uid =
                uint256(
                    keccak256(
                        abi.encodePacked(
                            _tokenOwners[i],
                            uint256(VestingType.Vesting),
                            cliff,
                            duration,
                            vestingCreationType
                        )
                    )
                );
            vestings[uid] = Vesting(
                uint256(VestingType.Vesting),
                vestingCreationType,
                _vestingAddresses[i]
            );
            vestingsOf[_tokenOwners[i]].push(uid);
            isVesting[_vestingAddresses[i]] = true;
        }
    }
```
</details>

---    

> ### createVesting

creates Vesting contract

```solidity
function createVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration) external nonpayable onlyAuthorized 
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
    ) external onlyAuthorized {
        createVestingAddr(_tokenOwner, _amount, _cliff, _duration, 3);
    }
```
</details>

---    

> ### createVestingAddr

creates Vesting contract

```solidity
function createVestingAddr(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration, uint256 _vestingCreationType) public nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address | the owner of the tokens | 
| _amount | uint256 | the amount to be staked | 
| _cliff | uint256 | the cliff in seconds | 
| _duration | uint256 | the total duration in seconds | 
| _vestingCreationType | uint256 | the type of vesting created(e.g. Origin, Bug Bounty etc.) | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function createVestingAddr(
        address _tokenOwner,
        uint256 _amount,
        uint256 _cliff,
        uint256 _duration,
        uint256 _vestingCreationType
    ) public onlyAuthorized {
        address vesting =
            _getOrCreateVesting(
                _tokenOwner,
                _cliff,
                _duration,
                uint256(VestingType.Vesting),
                _vestingCreationType
            );
        emit VestingCreated(
            _tokenOwner,
            vesting,
            _cliff,
            _duration,
            _amount,
            _vestingCreationType
        );
    }
```
</details>

---    

> ### createTeamVesting

creates Team Vesting contract

```solidity
function createTeamVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration, uint256 _vestingCreationType) external nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address | the owner of the tokens | 
| _amount | uint256 | the amount to be staked | 
| _cliff | uint256 | the cliff in seconds | 
| _duration | uint256 | the total duration in seconds | 
| _vestingCreationType | uint256 | the type of vesting created(e.g. Origin, Bug Bounty etc.) | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function createTeamVesting(
        address _tokenOwner,
        uint256 _amount,
        uint256 _cliff,
        uint256 _duration,
        uint256 _vestingCreationType
    ) external onlyAuthorized {
        address vesting =
            _getOrCreateVesting(
                _tokenOwner,
                _cliff,
                _duration,
                uint256(VestingType.TeamVesting),
                _vestingCreationType
            );
        emit TeamVestingCreated(
            _tokenOwner,
            vesting,
            _cliff,
            _duration,
            _amount,
            _vestingCreationType
        );
    }
```
</details>

---    

> ### stakeTokens

stakes tokens according to the vesting schedule

```solidity
function stakeTokens(address _vesting, uint256 _amount) external nonpayable onlyAuthorized 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vesting | address | the address of Vesting contract | 
| _amount | uint256 | the amount of tokens to stake | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function stakeTokens(address _vesting, uint256 _amount) external onlyAuthorized {
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
        return getVestingAddr(_tokenOwner, lockedSOV.cliff(), lockedSOV.duration(), 3);
    }
```
</details>

---    

> ### getVestingAddr

public function that returns vesting contract address for the given token owner, cliff, duration

```solidity
function getVestingAddr(address _tokenOwner, uint256 _cliff, uint256 _duration, uint256 _vestingCreationType) public view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address |  | 
| _cliff | uint256 |  | 
| _duration | uint256 |  | 
| _vestingCreationType | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getVestingAddr(
        address _tokenOwner,
        uint256 _cliff,
        uint256 _duration,
        uint256 _vestingCreationType
    ) public view returns (address) {
        uint256 type_ = uint256(VestingType.Vesting);
        uint256 uid =
            uint256(
                keccak256(
                    abi.encodePacked(_tokenOwner, type_, _cliff, _duration, _vestingCreationType)
                )
            );
        return vestings[uid].vestingAddress;
    }
```
</details>

---    

> ### getTeamVesting

returns team vesting contract address for the given token owner, cliff, duration

```solidity
function getTeamVesting(address _tokenOwner, uint256 _cliff, uint256 _duration, uint256 _vestingCreationType) public view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address |  | 
| _cliff | uint256 |  | 
| _duration | uint256 |  | 
| _vestingCreationType | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getTeamVesting(
        address _tokenOwner,
        uint256 _cliff,
        uint256 _duration,
        uint256 _vestingCreationType
    ) public view returns (address) {
        uint256 type_ = uint256(VestingType.TeamVesting);
        uint256 uid =
            uint256(
                keccak256(
                    abi.encodePacked(_tokenOwner, type_, _cliff, _duration, _vestingCreationType)
                )
            );
        return vestings[uid].vestingAddress;
    }
```
</details>

---    

> ### _getOrCreateVesting

Internal function to deploy Vesting/Team Vesting contract

```solidity
function _getOrCreateVesting(address _tokenOwner, uint256 _cliff, uint256 _duration, uint256 _type, uint256 _vestingCreationType) internal nonpayable
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address | the owner of the tokens | 
| _cliff | uint256 | the cliff in seconds | 
| _duration | uint256 | the total duration in seconds | 
| _type | uint256 | the type of vesting | 
| _vestingCreationType | uint256 | the type of vesting created(e.g. Origin, Bug Bounty etc.) | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getOrCreateVesting(
        address _tokenOwner,
        uint256 _cliff,
        uint256 _duration,
        uint256 _type,
        uint256 _vestingCreationType
    ) internal returns (address) {
        address vesting;
        uint256 uid =
            uint256(
                keccak256(
                    abi.encodePacked(_tokenOwner, _type, _cliff, _duration, _vestingCreationType)
                )
            );
        if (vestings[uid].vestingAddress == address(0)) {
            if (_type == 1) {
                vesting = vestingFactory.deployVesting(
                    SOV,
                    staking,
                    _tokenOwner,
                    _cliff,
                    _duration,
                    feeSharingProxy,
                    _tokenOwner
                );
            } else {
                vesting = vestingFactory.deployTeamVesting(
                    SOV,
                    staking,
                    _tokenOwner,
                    _cliff,
                    _duration,
                    feeSharingProxy,
                    vestingOwner
                );
            }
            vestings[uid] = Vesting(_type, _vestingCreationType, vesting);
            vestingsOf[_tokenOwner].push(uid);
            isVesting[vesting] = true;
        }
        return vestings[uid].vestingAddress;
    }
```
</details>

---    

> ### _addDeployedVestings

stores the addresses of Vesting contracts from all three previous versions of Vesting Registry

```solidity
function _addDeployedVestings(address _tokenOwner, uint256 _vestingCreationType) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address |  | 
| _vestingCreationType | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _addDeployedVestings(address _tokenOwner, uint256 _vestingCreationType) internal {
        uint256 uid;
        uint256 i = _vestingCreationType - 1;

        address vestingAddress = vestingRegistries[i].getVesting(_tokenOwner);
        if (vestingAddress != address(0)) {
            VestingLogic vesting = VestingLogic(vestingAddress);
            uid = uint256(
                keccak256(
                    abi.encodePacked(
                        _tokenOwner,
                        uint256(VestingType.Vesting),
                        vesting.cliff(),
                        vesting.duration(),
                        _vestingCreationType
                    )
                )
            );
            vestings[uid] = Vesting(
                uint256(VestingType.Vesting),
                _vestingCreationType,
                vestingAddress
            );
            vestingsOf[_tokenOwner].push(uid);
            isVesting[vestingAddress] = true;
        }

        address teamVestingAddress = vestingRegistries[i].getTeamVesting(_tokenOwner);
        if (teamVestingAddress != address(0)) {
            VestingLogic vesting = VestingLogic(teamVestingAddress);
            uid = uint256(
                keccak256(
                    abi.encodePacked(
                        _tokenOwner,
                        uint256(VestingType.TeamVesting),
                        vesting.cliff(),
                        vesting.duration(),
                        _vestingCreationType
                    )
                )
            );
            vestings[uid] = Vesting(
                uint256(VestingType.TeamVesting),
                _vestingCreationType,
                teamVestingAddress
            );
            vestingsOf[_tokenOwner].push(uid);
            isVesting[teamVestingAddress] = true;
        }
    }
```
</details>

---    

> ### getVestingsOf

returns all vesting details for the given token owner

```solidity
function getVestingsOf(address _tokenOwner) external view
returns(struct VestingRegistryStorage.Vesting[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getVestingsOf(address _tokenOwner) external view returns (Vesting[] memory) {
        uint256[] memory vestingIds = vestingsOf[_tokenOwner];
        uint256 length = vestingIds.length;
        Vesting[] memory _vestings = new Vesting[](vestingIds.length);
        for (uint256 i = 0; i < length; i++) {
            _vestings[i] = vestings[vestingIds[i]];
        }
        return _vestings;
    }
```
</details>

---    

> ### getVestingDetails

returns cliff and duration for Vesting & TeamVesting contracts

```solidity
function getVestingDetails(address _vestingAddress) external view
returns(cliff uint256, duration uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vestingAddress | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getVestingDetails(address _vestingAddress)
        external
        view
        returns (uint256 cliff, uint256 duration)
    {
        VestingLogic vesting = VestingLogic(_vestingAddress);
        return (vesting.cliff(), vesting.duration());
    }
```
</details>

---    

> ### isVestingAdress

returns if the address is a vesting address

```solidity
function isVestingAdress(address _vestingAddress) external view
returns(isVestingAddr bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vestingAddress | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function isVestingAdress(address _vestingAddress) external view returns (bool isVestingAddr) {
        return isVesting[_vestingAddress];
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
