/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "./AdvancedTokenStorage.sol";


contract LoanToken is AdvancedTokenStorage {

    // It is important to maintain the variables order so the delegate calls can access sovrynContractAddress and wethTokenAddress
    address public sovrynContractAddress;
    address public wethTokenAddress;
    address internal target_;

    constructor(
        address _newTarget,
        address _sovrynContractAddress,
        address _wethTokenAddress)
        public
    {
        _setTarget(_newTarget);
        _setSovrynContractAddress(_sovrynContractAddress);
        _setWethTokenAddress(_wethTokenAddress);
    }

    function()
        external
        payable
    {
        if (gasleft() <= 2300) {
            return;
        }

        address target = target_;
        bytes memory data = msg.data;
        assembly {
            let result := delegatecall(gas, target, add(data, 0x20), mload(data), 0, 0)
            let size := returndatasize
            let ptr := mload(0x40)
            returndatacopy(ptr, 0, size)
            switch result
            case 0 { revert(ptr, size) }
            default { return(ptr, size) }
        }
    }

    function setTarget(
        address _newTarget)
        public
        onlyOwner
    {
        _setTarget(_newTarget);
    }

    function _setTarget(
        address _newTarget)
        internal
    {
        require(Address.isContract(_newTarget), "target not a contract");
        target_ = _newTarget;
    }

    function _setSovrynContractAddress(
        address _sovrynContractAddress)
        internal
    {
        require(Address.isContract(_sovrynContractAddress), "sovryn not a contract");
        sovrynContractAddress = _sovrynContractAddress;
    }

    function _setWethTokenAddress(
        address _wethTokenAddress)
        internal
    {
        require(Address.isContract(_wethTokenAddress), "weth not a contract");
        wethTokenAddress = _wethTokenAddress;
    }
    
    function initialize(
        address _loanTokenAddress,
        string memory _name,
        string memory _symbol)
        public
        onlyOwner
    {
        loanTokenAddress = _loanTokenAddress;

        name = _name;
        symbol = _symbol;
        decimals = IERC20(loanTokenAddress).decimals();

        initialPrice = 10**18; // starting price of 1
    }
}
