/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

import "./IERC20.sol";
import "./IWrbtcERC20.sol";
import "../core/objects/OrderStruct.sol";
import "../core/objects/LoanStruct.sol";
import "../core/objects/LoanParamsStruct.sol";
import "../core/objects/LoanInterestStruct.sol";
import "../core/objects/LenderInterestStruct.sol";
import "../connectors/loantoken/lib/MarginTradeStructHelpers.sol";

interface ISovryn {
    /// @notice Events from ModulesCommonEvents
    event ProtocolModuleContractReplaced(
        address indexed prevModuleContractAddress,
        address indexed newModuleContractAddress,
        bytes32 indexed module
    );

    /// @notice Events from ProtocolSettingsEvents
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
    event SetAdmin(address indexed sender, address indexed oldAdmin, address indexed newAdmin);
    event SetPauser(address indexed sender, address indexed oldPauser, address indexed newPauser);

    /// @notice Events from LoanSettingsEvents
    event LoanParamsSetup(
        bytes32 indexed id,
        address owner,
        address indexed loanToken,
        address indexed collateralToken,
        uint256 minInitialMargin,
        uint256 maintenanceMargin,
        uint256 maxLoanTerm
    );
    event LoanParamsIdSetup(bytes32 indexed id, address indexed owner);

    event LoanParamsDisabled(
        bytes32 indexed id,
        address owner,
        address indexed loanToken,
        address indexed collateralToken,
        uint256 minInitialMargin,
        uint256 maintenanceMargin,
        uint256 maxLoanTerm
    );
    event LoanParamsIdDisabled(bytes32 indexed id, address indexed owner);

    /// @notice Events from LoanOpeningsEvents
    event Borrow(
        address indexed user,
        address indexed lender,
        bytes32 indexed loanId,
        address loanToken,
        address collateralToken,
        uint256 newPrincipal,
        uint256 newCollateral,
        uint256 interestRate,
        uint256 interestDuration,
        uint256 collateralToLoanRate,
        uint256 currentMargin
    );

    event Trade(
        address indexed user,
        address indexed lender,
        bytes32 indexed loanId,
        address collateralToken,
        address loanToken,
        uint256 positionSize,
        uint256 borrowedAmount,
        uint256 interestRate,
        uint256 settlementDate,
        uint256 entryPrice, /// one unit of collateralToken, denominated in loanToken
        uint256 entryLeverage,
        uint256 currentLeverage
    );

    event DelegatedManagerSet(
        bytes32 indexed loanId,
        address indexed delegator,
        address indexed delegated,
        bool isActive
    );

    /// @notice Events from LoanMaintenanceEvents
    event DepositCollateral(bytes32 indexed loanId, uint256 depositAmount, uint256 rate);

    /// @notice Events from LoanClosingsEvents
    event CloseWithDeposit(
        address indexed user,
        address indexed lender,
        bytes32 indexed loanId,
        address closer,
        address loanToken,
        address collateralToken,
        uint256 repayAmount,
        uint256 collateralWithdrawAmount,
        uint256 collateralToLoanRate,
        uint256 currentMargin
    );

    event CloseWithSwap(
        address indexed user,
        address indexed lender,
        bytes32 indexed loanId,
        address collateralToken,
        address loanToken,
        address closer,
        uint256 positionCloseSize,
        uint256 loanCloseAmount,
        uint256 exitPrice, // one unit of collateralToken, denominated in loanToken
        uint256 currentLeverage
    );

    event Liquidate(
        address indexed user,
        address indexed liquidator,
        bytes32 indexed loanId,
        address lender,
        address loanToken,
        address collateralToken,
        uint256 repayAmount,
        uint256 collateralWithdrawAmount,
        uint256 collateralToLoanRate,
        uint256 currentMargin
    );

    event Rollover(
        address indexed user,
        address indexed lender,
        bytes32 indexed loanId,
        uint256 principal,
        uint256 collateral,
        uint256 endTimestamp,
        address rewardReceiver,
        uint256 reward
    );

    event swapExcess(bool shouldRefund, uint256 amount, uint256 amountInRbtc, uint256 threshold);

    /// @notice Events from FeesEvents
    event PayLendingFee(address indexed payer, address indexed token, uint256 amount);

    event PayTradingFee(
        address indexed payer,
        address indexed token,
        bytes32 indexed loanId,
        uint256 amount
    );

    event PayBorrowingFee(
        address indexed payer,
        address indexed token,
        bytes32 indexed loanId,
        uint256 amount
    );

    event EarnReward(
        address indexed receiver,
        address indexed token,
        bytes32 indexed loanId,
        uint256 feeRebatePercent,
        uint256 amount,
        uint256 basisPoint
    );

    event EarnRewardFail(
        address indexed receiver,
        address indexed token,
        bytes32 indexed loanId,
        uint256 feeRebatePercent,
        uint256 amount,
        uint256 basisPoint
    );

    /// @notice Events from SwapsEvents
    event LoanSwap(
        bytes32 indexed loanId,
        address indexed sourceToken,
        address indexed destToken,
        address borrower,
        uint256 sourceAmount,
        uint256 destAmount
    );

    event ExternalSwap(
        address indexed user,
        address indexed sourceToken,
        address indexed destToken,
        uint256 sourceAmount,
        uint256 destAmount
    );

    /// @notice Events from AffiliatesEvents
    event SetAffiliatesReferrer(address indexed user, address indexed referrer);

    event SetAffiliatesReferrerFail(
        address indexed user,
        address indexed referrer,
        bool alreadySet,
        bool userNotFirstTrade
    );

    event SetUserNotFirstTradeFlag(address indexed user);

    event PayTradingFeeToAffiliate(
        address indexed referrer,
        address trader,
        address indexed token,
        bool indexed isHeld,
        uint256 tradingFeeTokenAmount,
        uint256 tokenBonusAmount,
        uint256 sovBonusAmount,
        uint256 sovBonusAmountPaid
    );

    event PayTradingFeeToAffiliateFail(
        address indexed referrer,
        address trader,
        address indexed token,
        uint256 tradingFeeTokenAmount,
        uint256 tokenBonusAmount,
        uint256 sovBonusAmount,
        uint256 sovBonusAmountTryingToPaid
    );

    event WithdrawAffiliatesReferrerTokenFees(
        address indexed referrer,
        address indexed receiver,
        address indexed tokenAddress,
        uint256 amount
    );

    /// Triggered whenever interest is paid to lender.
    event PayInterestTransfer(
        address indexed interestToken,
        address indexed lender,
        uint256 effectiveInterest
    );

    struct LoanReturnData {
        bytes32 loanId;
        address loanToken;
        address collateralToken;
        uint256 principal;
        uint256 collateral;
        uint256 interestOwedPerDay;
        uint256 interestDepositRemaining;
        uint256 startRate; // collateralToLoanRate
        uint256 startMargin;
        uint256 maintenanceMargin;
        uint256 currentMargin;
        uint256 maxLoanTerm;
        uint256 endTimestamp;
        uint256 maxLiquidatable;
        uint256 maxSeizable;
    }

    struct LoanReturnDataV2 {
        bytes32 loanId;
        address loanToken;
        address collateralToken;
        address borrower;
        uint256 principal;
        uint256 collateral;
        uint256 interestOwedPerDay;
        uint256 interestDepositRemaining;
        uint256 startRate; /// collateralToLoanRate
        uint256 startMargin;
        uint256 maintenanceMargin;
        uint256 currentMargin;
        uint256 maxLoanTerm;
        uint256 endTimestamp;
        uint256 maxLiquidatable;
        uint256 maxSeizable;
        uint256 creationTimestamp;
    }

    ////// Protocol //////
    function replaceContract(address target) external;
    function setTargets(string[] calldata sigsArr, address[] calldata targetsArr) external;
    function getTarget(string calldata sig) external view returns (address);

    ////// ADMIN FUNCTIONS //////
    function setSovrynProtocolAddress(address newProtocolAddress) external;
    function setSOVTokenAddress(address newSovTokenAddress) external;
    function setLockedSOVAddress(address newSOVLockedAddress) external;
    function setMinReferralsToPayoutAffiliates(uint256 newMinReferrals) external;
    function setPriceFeedContract(address newContract) external;
    function setSwapsImplContract(address newContract) external;
    function setLoanPool(address[] calldata pools, address[] calldata assets) external;
    function setSupportedTokens(address[] calldata addrs, bool[] calldata toggles) external;
    function setLendingFeePercent(uint256 newValue) external;
    function setTradingFeePercent(uint256 newValue) external;
    function setBorrowingFeePercent(uint256 newValue) external;
    function setSwapExternalFeePercent(uint256 newValue) external;
    function setAffiliateFeePercent(uint256 newValue) external;
    function setAffiliateTradingTokenFeePercent(uint256 newValue) external;
    function setLiquidationIncentivePercent(uint256 newAmount) external;
    function setMaxDisagreement(uint256 newAmount) external;
    function setSourceBuffer(uint256 newAmount) external;
    function setMaxSwapSize(uint256 newAmount) external;
    function setFeesController(address newController) external;
    function setWrbtcToken(address wrbtcTokenAddress) external;
    function setSovrynSwapContractRegistryAddress(address registryAddress) external;
    function setProtocolTokenAddress(address _protocolTokenAddress) external;
    function setRolloverBaseReward(uint256 transactionCost) external;
    function setRebatePercent(uint256 rebatePercent) external;
    function setSpecialRebates(
        address sourceToken,
        address destToken,
        uint256 specialRebatesPercent
    ) external;
    function setTradingRebateRewardsBasisPoint(uint256 newBasisPoint) external;
    function setRolloverFlexFeePercent(uint256 newRolloverFlexFeePercent) external;
    function setDefaultPathConversion(IERC20[] calldata defaultPath) external;
    function setAdmin(address newAdmin) external;
    function setPauser(address newPauser) external;
    function togglePaused(bool paused) external;
    function transferOwnership(address newOwner) external;

    ////// Protocol Settings //////
    function withdrawFees(
        address[] calldata tokens,
        address receiver
    ) external returns (uint256 totalWRBTCWithdrawn);

    function withdrawLendingFees(
        address token,
        address receiver,
        uint256 amount
    ) external returns (bool);

    function withdrawTradingFees(
        address token,
        address receiver,
        uint256 amount
    ) external returns (bool);

    function withdrawBorrowingFees(
        address token,
        address receiver,
        uint256 amount
    ) external returns (bool);

    function withdrawProtocolToken(
        address receiver,
        uint256 amount
    ) external returns (address, bool);

    function depositProtocolToken(uint256 amount) external;

    function getLoanPoolsList(
        uint256 start,
        uint256 count
    ) external view returns (bytes32[] memory);

    function isLoanPool(address loanPool) external view returns (bool);

    function getSpecialRebates(
        address sourceToken,
        address destToken
    ) external view returns (uint256 specialRebatesPercent);

    function isProtocolPaused() external view returns (bool);

    ////// SwapsImplSovrynSwapModule //////
    function getSovrynSwapNetworkContract(
        address sovrynSwapRegistryAddress
    ) external view returns (address);

    function getContractHexName(string calldata source) external pure returns (bytes32 result);

    function swapsImplExpectedRate(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount
    ) external view returns (uint256);

    function swapsImplExpectedReturn(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount
    ) external view returns (uint256 expectedReturn);

    ////// Loan Settings //////
    function setupLoanParams(
        LoanParamsStruct.LoanParams[] calldata loanParamsList
    ) external returns (bytes32[] memory loanParamsIdList);

    function disableLoanParams(bytes32[] calldata loanParamsIdList) external;

    function getLoanParams(
        bytes32[] calldata loanParamsIdList
    ) external view returns (LoanParamsStruct.LoanParams[] memory loanParamsList);

    function getLoanParamsList(
        address owner,
        uint256 start,
        uint256 count
    ) external view returns (bytes32[] memory loanParamsList);

    function getTotalPrincipal(address lender, address loanToken) external view returns (uint256);

    function minInitialMargin(bytes32 loanParamsId) external view returns (uint256);

    ////// Loan Openings //////
    function borrowOrTradeFromPool(
        bytes32 loanParamsId,
        bytes32 loanId, // if 0, start a new loan
        bool isTorqueLoan,
        uint256 initialMargin,
        MarginTradeStructHelpers.SentAddresses calldata sentAddresses,
        // lender: must match loan if loanId provided
        // borrower: must match loan if loanId provided
        // receiver: receiver of funds (address(0) assumes borrower address)
        // manager: delegated manager of loan unless address(0)
        MarginTradeStructHelpers.SentAmounts calldata sentValues,
        // newRate: new loan interest rate
        // newPrincipal: new loan size (borrowAmount + any borrowed interest)
        // torqueInterest: new amount of interest to escrow for Torque loan (determines initial loan length)
        // loanTokenReceived: total loanToken deposit (amount not sent to borrower in the case of Torque loans)
        // collateralTokenReceived: total collateralToken deposit
        bytes calldata loanDataBytes
    ) external payable returns (uint256 newPrincipal, uint256 newCollateral);

    function setDelegatedManager(bytes32 loanId, address delegated, bool toggle) external;

    function getEstimatedMarginExposure(
        address loanToken,
        address collateralToken,
        uint256 loanTokenSent,
        uint256 collateralTokenSent,
        uint256 interestRate,
        uint256 newPrincipal
    ) external view returns (uint256);

    function getRequiredCollateral(
        address loanToken,
        address collateralToken,
        uint256 newPrincipal,
        uint256 marginAmount,
        bool isTorqueLoan
    ) external view returns (uint256 collateralAmountRequired);

    function getBorrowAmount(
        address loanToken,
        address collateralToken,
        uint256 collateralTokenAmount,
        uint256 marginAmount,
        bool isTorqueLoan
    ) external view returns (uint256 borrowAmount);

    ////// Loan Closings //////
    function liquidate(
        bytes32 loanId,
        address receiver,
        uint256 closeAmount // denominated in loanToken
    )
        external
        payable
        returns (uint256 loanCloseAmount, uint256 seizedAmount, address seizedToken);

    function rollover(bytes32 loanId, bytes calldata loanDataBytes) external;

    function closeWithDeposit(
        bytes32 loanId,
        address receiver,
        uint256 depositAmount // denominated in loanToken
    )
        external
        payable
        returns (uint256 loanCloseAmount, uint256 withdrawAmount, address withdrawToken);

    function closeWithSwap(
        bytes32 loanId,
        address receiver,
        uint256 swapAmount, // denominated in collateralToken
        bool returnTokenIsCollateral, // true: withdraws collateralToken, false: withdraws loanToken
        bytes calldata loanDataBytes
    ) external returns (uint256 loanCloseAmount, uint256 withdrawAmount, address withdrawToken);

    ////// Loan Maintenance //////
    function depositCollateral(
        bytes32 loanId,
        uint256 depositAmount // must match msg.value if ether is sent
    ) external payable;

    function withdrawCollateral(
        bytes32 loanId,
        address receiver,
        uint256 withdrawAmount
    ) external returns (uint256 actualWithdrawAmount);

    function withdrawAccruedInterest(address loanToken) external;

    function getLenderInterestData(
        address lender,
        address loanToken
    )
        external
        view
        returns (
            uint256 interestPaid,
            uint256 interestPaidDate,
            uint256 interestOwedPerDay,
            uint256 interestUnPaid,
            uint256 interestFeePercent,
            uint256 principalTotal
        );

    function getLoanInterestData(
        bytes32 loanId
    )
        external
        view
        returns (
            address loanToken,
            uint256 interestOwedPerDay,
            uint256 interestDepositTotal,
            uint256 interestDepositRemaining
        );

    function getUserLoans(
        address user,
        uint256 start,
        uint256 count,
        uint256 loanType,
        bool isLender,
        bool unsafeOnly
    ) external view returns (LoanReturnData[] memory loansData);

    function getUserLoansV2(
        address user,
        uint256 start,
        uint256 count,
        uint256 loanType,
        bool isLender,
        bool unsafeOnly
    ) external view returns (LoanReturnDataV2[] memory loansDataV2);

    function getLoan(bytes32 loanId) external view returns (LoanReturnData memory loanData);

    function getLoanV2(bytes32 loanId) external view returns (LoanReturnDataV2 memory loanDataV2);

    function getActiveLoans(
        uint256 start,
        uint256 count,
        bool unsafeOnly
    ) external view returns (LoanReturnData[] memory loansData);

    function getActiveLoansV2(
        uint256 start,
        uint256 count,
        bool unsafeOnly
    ) external view returns (LoanReturnDataV2[] memory loansDataV2);

    function extendLoanDuration(
        bytes32 loanId,
        uint256 depositAmount,
        bool useCollateral,
        bytes calldata /// loanDataBytes, for future use.
    ) external returns (uint256 secondsExtended);

    function reduceLoanDuration(
        bytes32 loanId,
        address receiver,
        uint256 withdrawAmount
    ) external returns (uint256 secondsReduced);

    ////// Swaps External //////
    function swapExternal(
        address sourceToken,
        address destToken,
        address receiver,
        address returnToSender,
        uint256 sourceTokenAmount,
        uint256 requiredDestTokenAmount,
        uint256 minReturn,
        bytes calldata swapData
    ) external returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed);

    function getSwapExpectedReturn(
        address sourceToken,
        address destToken,
        uint256 sourceTokenAmount
    ) external view returns (uint256);

    function checkPriceDivergence(
        address sourceToken,
        address destToken,
        uint256 sourceTokenAmount,
        uint256 minReturn
    ) external view;

    ////// Affiliates Module //////
    function getUserNotFirstTradeFlag(address user) external view returns (bool);
    function setUserNotFirstTradeFlag(address user) external;
    function payTradingFeeToAffiliatesReferrer(
        address referrer,
        address trader,
        address token,
        uint256 tradingFeeTokenBaseAmount
    ) external returns (uint256 affiliatesBonusSOVAmount, uint256 affiliatesBonusTokenAmount);
    function setAffiliatesReferrer(address user, address referrer) external; //onlyCallableByLoanPools
    function getReferralsList(address referrer) external view returns (address[] memory refList);
    function getAffiliatesReferrerBalances(
        address referrer
    )
        external
        view
        returns (address[] memory referrerTokensList, uint256[] memory referrerTokensBalances);
    function getAffiliatesReferrerTokensList(
        address referrer
    ) external view returns (address[] memory tokensList);
    function getAffiliatesReferrerTokenBalance(
        address referrer,
        address token
    ) external view returns (uint256);
    function withdrawAffiliatesReferrerTokenFees(
        address token,
        address receiver,
        uint256 amount
    ) external;
    function withdrawAllAffiliatesReferrerTokenFees(address receiver) external;

    ////// Getters //////
    function getProtocolAddress() external view returns (address);
    function getSovTokenAddress() external view returns (address);
    function getLockedSOVAddress() external view returns (address);
    function getFeeRebatePercent() external view returns (uint256);
    function getMinReferralsToPayout() external view returns (uint256);
    function getAffiliatesUserReferrer(address user) external view returns (address referrer);
    function getAffiliateRewardsHeld(address referrer) external view returns (uint256);
    function getAffiliateTradingTokenFeePercent()
        external
        view
        returns (uint256 affiliateTradingTokenFeePercent);
    function getAffiliatesTokenRewardsValueInRbtc(
        address referrer
    ) external view returns (uint256);
    function getSwapExternalFeePercent() external view returns (uint256);
    function getTradingRebateRewardsBasisPoint() external view returns (uint256);
    function getDedicatedSOVRebate() external view returns (uint256);
    function getDefaultPathConversion(
        address sourceTokenAddress,
        address destTokenAddress
    ) external view returns (IERC20[] memory);
    function checkCloseWithDepositIsTinyPosition(
        bytes32 loanId,
        uint256 depositAmount
    ) external view returns (bool isTinyPosition, uint256 tinyPositionAmount);
    function getAdmin() external view returns (address);
    function getPauser() external view returns (address);
    function supportedTokens(address token) external view returns (bool);
    function sovrynSwapContractRegistryAddress() external view returns (address);
    function priceFeeds() external view returns (address);
    function swapsImpl() external view returns (address);
    function logicTargets(bytes4 sig) external view returns (address);
    function loans(bytes32 loanId) external view returns (LoanStruct.Loan memory);
    function loanParams(
        bytes32 loanParamsId
    ) external view returns (LoanParamsStruct.LoanParams memory);
    function lenderOrders(
        address lender,
        bytes32 orderParamsId
    ) external view returns (OrderStruct.Order memory);
    function borrowerOrders(
        address borrower,
        bytes32 orderParamsId
    ) external view returns (OrderStruct.Order memory);
    function delegatedManagers(bytes32 loanId, address manager) external view returns (bool);
    function lenderInterest(
        address lender,
        address token
    ) external view returns (LenderInterestStruct.LenderInterest memory);
    function loanInterest(
        bytes32 loanId
    ) external view returns (LoanInterestStruct.LoanInterest memory);
    function feesController() external view returns (address);
    function lendingFeePercent() external view returns (uint256);
    function lendingFeeTokensHeld(address token) external view returns (uint256);
    function lendingFeeTokensPaid(address token) external view returns (uint256);
    function tradingFeePercent() external view returns (uint256);
    function tradingFeeTokensHeld(address token) external view returns (uint256);
    function tradingFeeTokensPaid(address token) external view returns (uint256);
    function borrowingFeePercent() external view returns (uint256);
    function borrowingFeeTokensHeld(address token) external view returns (uint256);
    function borrowingFeeTokensPaid(address token) external view returns (uint256);
    function protocolTokenHeld() external view returns (uint256);
    function protocolTokenPaid() external view returns (uint256);
    function affiliateFeePercent() external view returns (uint256);
    function liquidationIncentivePercent() external view returns (uint256);
    function loanPoolToUnderlying(address loanPool) external view returns (address);
    function underlyingToLoanPool(address underlying) external view returns (address);
    function maxDisagreement() external view returns (uint256);
    function sourceBuffer() external view returns (uint256);
    function maxSwapSize() external view returns (uint256);
    function borrowerNonce(address borrower) external view returns (uint256);
    function rolloverBaseReward() external view returns (uint256);
    function rolloverFlexFeePercent() external view returns (uint256);
    function wrbtcToken() external view returns (IWrbtcERC20);
    function protocolTokenAddress() external view returns (address);
    function userNotFirstTradeFlag(address user) external view returns (bool);
    function affiliatesReferrerBalances(
        address referrer,
        address token
    ) external view returns (uint256);
    function specialRebates(
        address sourceToken,
        address destToken
    ) external view returns (uint256);
    function pause() external view returns (bool);
    function owner() external view returns (address);
    function lockedSOVAddress(address newSOVLockedAddress) external;
    function feeRebatePercent() external view returns (uint256);
    function protocolAddress() external view returns (address);

    ////// Remove Default Path //////
    function removeDefaultPathConversion(
        address sourceTokenAddress,
        address destTokenAddress
    ) external;
}
