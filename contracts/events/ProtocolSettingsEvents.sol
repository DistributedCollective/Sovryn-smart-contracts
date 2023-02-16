/**
 * Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "./ModulesCommonEvents.sol";
import "../interfaces/IERC20.sol";

/**
 * @title The Protocol Settings Events contract.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized
 * margin trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * This contract contains the events for protocol settings operations.
 * */
contract ProtocolSettingsEvents is ModulesCommonEvents {
    event SetPriceFeedContract(address indexed sender, address oldValue, address newValue);

    event SetSwapsImplContract(address indexed sender, address oldValue, address newValue);

    event SetLoanPool(
        address indexed sender,
        address indexed loanPool,
        address indexed underlying
    );

    event SetSupportedTokens(address indexed sender, address indexed token, bool isActive);

    event SetLendingFeePercent(address indexed sender, uint256 oldValue, uint256 newValue);

    event SetTradingFeePercent(address indexed sender, uint256 oldValue, uint256 newValue);

    event SetBorrowingFeePercent(address indexed sender, uint256 oldValue, uint256 newValue);

    event SetSwapExternalFeePercent(address indexed sender, uint256 oldValue, uint256 newValue);

    event SetAffiliateFeePercent(address indexed sender, uint256 oldValue, uint256 newValue);

    event SetAffiliateTradingTokenFeePercent(
        address indexed sender,
        uint256 oldValue,
        uint256 newValue
    );

    event SetLiquidationIncentivePercent(
        address indexed sender,
        uint256 oldValue,
        uint256 newValue
    );

    event SetMaxSwapSize(address indexed sender, uint256 oldValue, uint256 newValue);

    event SetFeesController(
        address indexed sender,
        address indexed oldController,
        address indexed newController
    );

    event SetWrbtcToken(
        address indexed sender,
        address indexed oldWethToken,
        address indexed newWethToken
    );

    event SetSovrynSwapContractRegistryAddress(
        address indexed sender,
        address indexed oldSovrynSwapContractRegistryAddress,
        address indexed newSovrynSwapContractRegistryAddress
    );

    event SetProtocolTokenAddress(
        address indexed sender,
        address indexed oldProtocolToken,
        address indexed newProtocolToken
    );

    event WithdrawFees(
        address indexed sender,
        address indexed token,
        address indexed receiver,
        uint256 lendingAmount,
        uint256 tradingAmount,
        uint256 borrowingAmount,
        uint256 wRBTCConverted
    );

    event WithdrawLendingFees(
        address indexed sender,
        address indexed token,
        address indexed receiver,
        uint256 amount
    );

    event WithdrawTradingFees(
        address indexed sender,
        address indexed token,
        address indexed receiver,
        uint256 amount
    );

    event WithdrawBorrowingFees(
        address indexed sender,
        address indexed token,
        address indexed receiver,
        uint256 amount
    );

    event SetRolloverBaseReward(address indexed sender, uint256 oldValue, uint256 newValue);

    event SetRebatePercent(
        address indexed sender,
        uint256 oldRebatePercent,
        uint256 newRebatePercent
    );

    event SetSpecialRebates(
        address indexed sender,
        address indexed sourceToken,
        address indexed destToken,
        uint256 oldSpecialRebatesPercent,
        uint256 newSpecialRebatesPercent
    );

    event SetProtocolAddress(
        address indexed sender,
        address indexed oldProtocol,
        address indexed newProtocol
    );

    event SetMinReferralsToPayoutAffiliates(
        address indexed sender,
        uint256 oldMinReferrals,
        uint256 newMinReferrals
    );

    event SetSOVTokenAddress(
        address indexed sender,
        address indexed oldTokenAddress,
        address indexed newTokenAddress
    );

    event SetLockedSOVAddress(
        address indexed sender,
        address indexed oldAddress,
        address indexed newAddress
    );

    event TogglePaused(address indexed sender, bool indexed oldFlag, bool indexed newFlag);

    event SetTradingRebateRewardsBasisPoint(
        address indexed sender,
        uint256 oldBasisPoint,
        uint256 newBasisPoint
    );

    event SetRolloverFlexFeePercent(
        address indexed sender,
        uint256 oldRolloverFlexFeePercent,
        uint256 newRolloverFlexFeePercent
    );

    event SetDefaultPathConversion(
        address indexed sender,
        address indexed sourceTokenAddress,
        address indexed destTokenAddress,
        IERC20[] defaultPath
    );

    event RemoveDefaultPathConversion(
        address indexed sender,
        address indexed sourceTokenAddress,
        address indexed destTokenAddress,
        IERC20[] defaultPath
    );
}
