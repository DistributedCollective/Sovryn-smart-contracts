/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0. 
 */

 /** 
  * @author Denis Savelev
  */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../core/State.sol";
//import "../events/LoanSettingsEvents.sol";
import "../mixins/EnumerableBytes32Set.sol";
//import "../mixins/VaultController.sol";
import "../openzeppelin/SafeERC20.sol";

contract Affiliates is State { 

    //TODO: add events
    //AUDIT: add verification user != referrer?
    //AUDIT: add affiliates 'API' functions to ./interfaces/ISovryn.sol?

    /*
    Module: Affiliate upgradable
    Storage: from State, functions called from Protocol by delegatecall
    */

    using SafeERC20 for IERC20;
    using EnumerableBytes32Set for EnumerableBytes32Set.Bytes32Set;

    constructor() public {}

    function()
        external
    {
        revert("Affiliates - fallback not allowed");
    }

    function initialize(
        address target)
        external
        onlyOwner
    {
        _setTarget(this.setAffiliatesUserReferrer.selector, target);
        _setTarget(this.getUserNotFirstTradeFlag.selector, target);
        _setTarget(this.getAffiliatesReferrerBalances.selector, target);
        _setTarget(this.getAffiliatesReferrerTokenBalance.selector, target);
        _setTarget(this.payTradingFeeToAffiliatesReferrer.selector, target);
        _setTarget(this.getAffiliatesReferrerTokensList.selector, target);
        _setTarget(this.payTradingFeeToAffiliatesReferrer.selector, target);
        _setTarget(this.withdrawAffiliatesReferrerTokenFees.selector, target);
    }
    //TODO: verify all external and public functions registered
    //TODO: move to a separate events storage? (best practice? why?)

    struct SetAffiliatesReferrerResult {
        bool success;
        bool alreadySet;
        bool userNotFirstTradeFlag;
    }

    event SetAffiliatesReferrer(address indexed user, address indexed affiliate);
    event SetAffiliatesReferrerFail(address indexed user, address indexed affiliate, bool alreadySet, bool userNotFirstTrade);

        // only callable by loan pools
    modifier onlyCalledFromLoanPools() {
        require(loanPoolToUnderlying[msg.sender] != address(0), "Affiliates: not authorized");
        _;
    }

    function setAffiliatesUserReferrer(address user, address referrer) external onlyCalledFromLoanPools {
        SetAffiliatesReferrerResult memory result;
        result.userNotFirstTradeFlag = getUserNotFirstTradeFlag(user);
        result.alreadySet = affiliatesUserReferrer[user] == address(0) ? false : true;
        result.success = !(result.userNotFirstTradeFlag || result.alreadySet);
        if(result.success) {
            affiliatesUserReferrer[user] = referrer;
            emit SetAffiliatesReferrer(user, referrer);
        } else {
            emit SetAffiliatesReferrerFail(user, referrer, result.alreadySet, result.userNotFirstTradeFlag);
        }
    }
    function getUserNotFirstTradeFlag(address user) public view returns (bool) { //getter adds future proof
        return userNotFirstTradeFlag[user];
    }

    function setUserNotFirstTradeFlag(address user) external onlyCalledFromLoanPools {
        if(userNotFirstTradeFlag[user] == false) //for readability
            userNotFirstTradeFlag[user] = true;
        //TODO: event
    }

    /*TODO: remove
    function setAffiliatesUserReferrer(address user, address referrer) external onlyCalledFromLoanPools {
        if(referrer != address(0) && getUserNotFirstTradeFlag(user)) {
            affiliatesUserReferrer[user] = referrer;
            //TODO: event
        }
    }*/

    //If need to allow an owner to nullify a referrer for some reason
    /*
    function affiliatesRemoveUserReferrer(address user, address referrer) external onlyOwner {
        if(referrer != address(0) && getUserNotFirstTradeFlag[user]) {
            delete affiliatesUserReferrer[user];
            //TODO: event with reason of removing referrer
        }
    }
    */

    // calculate affiliates trading fee amount
    function _getReferrerTradingFee(
        uint256 feeTokenAmount)
        internal
        view
        returns (uint256)
    {
        return feeTokenAmount
            .mul(_getAffiliatesTradingFeePercent())
            .div(10**20);
    }

    function _getAffiliatesTradingFeePercent() internal view returns(uint256){
        return affiliateFeePercent;
    }
  
  /**
  * @param tradingFeeTokenBaseAmount total trading fee amount
  */
    function payTradingFeeToAffiliatesReferrer(
        address referrer,
        address token,
        uint256 tradingFeeTokenBaseAmount)
        external 
        returns (uint256 referrerTradingFee) 
    {
        if(tradingFeeTokenBaseAmount > 0)
        {
            referrerTradingFee = _getReferrerTradingFee(tradingFeeTokenBaseAmount);
            affiliatesReferrerBalances[referrer][token] = 
                affiliatesReferrerBalances[referrer][token].add(referrerTradingFee);
        }
        return referrerTradingFee;
    }

    function withdrawAffiliatesReferrerTokenFees(address referrer, address token, uint256 amount) external {
        uint256 referrerTokenBalance = affiliatesReferrerBalances[referrer][token];
        uint256 withdrawAmount = referrerTokenBalance > amount ? amount : referrerTokenBalance;
        require(withdrawAmount > 0, "Affiliates: cannot withdraw zero amount");

        if(referrerTokenBalance == 0) { 
          _removeAffiliatesReferrerToken(referrer, token);
        }
        require(referrerTokenBalance > 0, "Affiliates: referrer cannot withdraw: zero balance");

        uint256 newReferrerTokenBalance = referrerTokenBalance.sub(withdrawAmount);
        if(newReferrerTokenBalance == 0) {
            _removeAffiliatesReferrerToken(referrer, token);
        } else {
            affiliatesReferrerBalances[referrer][token] = newReferrerTokenBalance;
        }

        IERC20(token).safeTransfer(
            referrer,
            withdrawAmount
        );
        
    }

    function _removeAffiliatesReferrerToken(address referrer, address token) internal {
        delete affiliatesReferrerBalances[referrer][token];
        affiliatesReferrerTokensList[referrer].remove(token);
    }
    
    function getAffiliatesReferrerBalances(address referrer) external view returns (address[] memory referrerTokensList, uint256[] memory referrerTokensBalances) {
        referrerTokensList = getAffiliatesReferrerTokensList(referrer);
        referrerTokensBalances = new uint256[](referrerTokensList.length);
        for(uint256 i; i < referrerTokensList.length; i++) {
            referrerTokensBalances[i] = getAffiliatesReferrerTokenBalance(referrer, referrerTokensList[i]);
        }
        return(referrerTokensList, referrerTokensBalances);
    }

    function getAffiliatesReferrerTokensList(address referrer) public view returns (address[] memory tokensList) {
        tokensList = affiliatesReferrerTokensList[referrer].enumerate();
        return tokensList;
    }

    function getAffiliatesReferrerTokenBalance(address referrer, address token) public view returns (uint256){
        //TODO: remove: return IERC20(token).balanceOf(referrer); - this is withdrawn balance
        return affiliatesReferrerBalances[referrer][token];
    }
   
}