/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;
import "../core/State.sol";
import "../events/LoanOpeningsEvents.sol";
import "../events/LoanMaintenanceEvents.sol";
import "../mixins/VaultController.sol";
import "../mixins/InterestUser.sol";
import "../mixins/LiquidationHelper.sol";
import "../swaps/SwapsUser.sol";
import "../mixins/BorrowerExitPerimeter.sol";

/**
 * @title LoanMaintenanceViews contract.
 * @notice Read-only loan and interest queries. These touch no state and take no
 *   part in the security perimeter, so they are hosted separately from the
 *   state-changing maintenance module; the protocol routes to both by selector.
 * */
contract LoanMaintenanceViews is
    LoanOpeningsEvents,
    LoanMaintenanceEvents,
    VaultController,
    InterestUser,
    LiquidationHelper
{
    struct LoanReturnData {
        bytes32 loanId;
        address loanToken;
        address collateralToken;
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

    constructor() public {}

    function() external {
        revert("fallback not allowed");
    }

    function initialize(address target) external onlyOwner {
        address prevModuleContractAddress = logicTargets[this.getLoan.selector];
        _setTarget(this.getLenderInterestData.selector, target);
        _setTarget(this.getLoanInterestData.selector, target);
        _setTarget(this.getUserLoans.selector, target);
        _setTarget(this.getUserLoansV2.selector, target);
        _setTarget(this.getLoan.selector, target);
        _setTarget(this.getLoanV2.selector, target);
        _setTarget(this.getActiveLoans.selector, target);
        _setTarget(this.getActiveLoansV2.selector, target);
        emit ProtocolModuleContractReplaced(
            prevModuleContractAddress,
            target,
            "LoanMaintenanceViews"
        );
    }

    /**
     * @notice Get current lender interest data totals for all loans
     *   with a specific oracle and interest token.
     *
     * @param lender The lender address.
     * @param loanToken The loan token address.
     *
     * @return interestPaid The total amount of interest that has been paid to a lender so far.
     * @return interestPaidDate The date of the last interest pay out, or 0 if no interest has been withdrawn yet.
     * @return interestOwedPerDay The amount of interest the lender is earning per day.
     * @return interestUnPaid The total amount of interest the lender is owned and not yet withdrawn.
     * @return interestFeePercent The fee retained by the protocol before interest is paid to the lender.
     * @return principalTotal The total amount of outstanding principal the lender has loaned.
     * */
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
        )
    {
        LenderInterest memory lenderInterestLocal = lenderInterest[lender][loanToken];

        interestUnPaid = block
            .timestamp
            .sub(lenderInterestLocal.updatedTimestamp)
            .mul(lenderInterestLocal.owedPerDay)
            .div(86400);
        if (interestUnPaid > lenderInterestLocal.owedTotal)
            interestUnPaid = lenderInterestLocal.owedTotal;

        return (
            lenderInterestLocal.paidTotal,
            lenderInterestLocal.paidTotal != 0 ? lenderInterestLocal.updatedTimestamp : 0,
            lenderInterestLocal.owedPerDay,
            lenderInterestLocal.updatedTimestamp != 0 ? interestUnPaid : 0,
            lendingFeePercent,
            lenderInterestLocal.principalTotal
        );
    }

    /**
     * @notice Get current interest data for a loan.
     *
     * @param loanId A unique ID representing the loan.
     *
     * @return loanToken The loan token that interest is paid in.
     * @return interestOwedPerDay The amount of interest the borrower is paying per day.
     * @return interestDepositTotal The total amount of interest the borrower has deposited.
     * @return interestDepositRemaining The amount of deposited interest that is not yet owed to a lender.
     * */
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
        )
    {
        loanToken = loanParams[loans[loanId].loanParamsId].loanToken;
        interestOwedPerDay = loanInterest[loanId].owedPerDay;
        interestDepositTotal = loanInterest[loanId].depositTotal;

        uint256 endTimestamp = loans[loanId].endTimestamp;
        uint256 interestTime = block.timestamp > endTimestamp ? endTimestamp : block.timestamp;
        interestDepositRemaining = endTimestamp > interestTime
            ? endTimestamp.sub(interestTime).mul(interestOwedPerDay).div(86400)
            : 0;
    }

    /**
     * @notice Get all user loans.
     *
     * Only returns data for loans that are active.
     *
     * @param user The user address.
     * @param start The lower loan ID to start with.
     * @param count The maximum number of results.
     * @param loanType The type of loan.
     *   loanType 0: all loans.
     *   loanType 1: margin trade loans.
     *   loanType 2: non-margin trade loans.
     * @param isLender Whether the user is lender or borrower.
     * @param unsafeOnly The safe filter (True/False).
     *
     * @return loansData The array of loans as query result.
     * */
    function getUserLoans(
        address user,
        uint256 start,
        uint256 count,
        uint256 loanType,
        bool isLender,
        bool unsafeOnly
    ) external view returns (LoanReturnData[] memory loansData) {
        EnumerableBytes32Set.Bytes32Set storage set = isLender
            ? lenderLoanSets[user]
            : borrowerLoanSets[user];

        uint256 end = start.add(count).min256(set.length());
        if (start >= end) {
            return loansData;
        }

        loansData = new LoanReturnData[](count);
        uint256 itemCount;
        for (uint256 i = end - start; i > 0; i--) {
            if (itemCount == count) {
                break;
            }
            LoanReturnData memory loanData = _getLoan(
                set.get(i + start - 1), /// loanId
                loanType,
                unsafeOnly
            );
            if (loanData.loanId == 0) continue;

            loansData[itemCount] = loanData;
            itemCount++;
        }

        if (itemCount < count) {
            assembly {
                mstore(loansData, itemCount)
            }
        }
    }

    /**
     * @notice Get all user loans.
     *
     * Only returns data for loans that are active.
     *
     * @param user The user address.
     * @param start The lower loan ID to start with.
     * @param count The maximum number of results.
     * @param loanType The type of loan.
     *   loanType 0: all loans.
     *   loanType 1: margin trade loans.
     *   loanType 2: non-margin trade loans.
     * @param isLender Whether the user is lender or borrower.
     * @param unsafeOnly The safe filter (True/False).
     *
     * @return loansData The array of loans as query result.
     * */
    function getUserLoansV2(
        address user,
        uint256 start,
        uint256 count,
        uint256 loanType,
        bool isLender,
        bool unsafeOnly
    ) external view returns (LoanReturnDataV2[] memory loansDataV2) {
        EnumerableBytes32Set.Bytes32Set storage set = isLender
            ? lenderLoanSets[user]
            : borrowerLoanSets[user];

        uint256 end = start.add(count).min256(set.length());
        if (start >= end) {
            return loansDataV2;
        }

        loansDataV2 = new LoanReturnDataV2[](count);
        uint256 itemCount;
        for (uint256 i = end - start; i > 0; i--) {
            if (itemCount == count) {
                break;
            }
            LoanReturnDataV2 memory loanDataV2 = _getLoanV2(
                set.get(i + start - 1), /// loanId
                loanType,
                unsafeOnly
            );
            if (loanDataV2.loanId == 0) continue;

            loansDataV2[itemCount] = loanDataV2;
            itemCount++;
        }

        if (itemCount < count) {
            assembly {
                mstore(loansDataV2, itemCount)
            }
        }
    }

    /**
     * @notice Get one loan data structure by matching ID.
     *
     * Wrapper to internal _getLoan call.
     *
     * @param loanId A unique ID representing the loan.
     *
     * @return loansData The data structure w/ loan information.
     * */
    function getLoan(bytes32 loanId) external view returns (LoanReturnData memory loanData) {
        return
            _getLoan(
                loanId,
                0, /// loanType
                false /// unsafeOnly
            );
    }

    /**
     * @notice Get one loan data structure by matching ID.
     *
     * Wrapper to internal _getLoan call.
     *
     * @param loanId A unique ID representing the loan.
     *
     * @return loansData The data structure w/ loan information.
     * */
    function getLoanV2(bytes32 loanId) external view returns (LoanReturnDataV2 memory loanDataV2) {
        return
            _getLoanV2(
                loanId,
                0, /// loanType
                false /// unsafeOnly
            );
    }

    /**
     * @notice Get all active loans.
     *
     * @param start The lower loan ID to start with.
     * @param count The maximum number of results.
     * @param unsafeOnly The safe filter (True/False).
     *
     * @return loansData The data structure w/ loan information.
     * */
    function getActiveLoans(
        uint256 start,
        uint256 count,
        bool unsafeOnly
    ) external view returns (LoanReturnData[] memory loansData) {
        uint256 end = start.add(count).min256(activeLoansSet.length());
        if (start >= end) {
            return loansData;
        }

        loansData = new LoanReturnData[](count);
        uint256 itemCount;
        for (uint256 i = end - start; i > 0; i--) {
            if (itemCount == count) {
                break;
            }
            LoanReturnData memory loanData = _getLoan(
                activeLoansSet.get(i + start - 1), /// loanId
                0, /// loanType
                unsafeOnly
            );
            if (loanData.loanId == 0) continue;

            loansData[itemCount] = loanData;
            itemCount++;
        }

        if (itemCount < count) {
            assembly {
                mstore(loansData, itemCount)
            }
        }
    }

    /**
     * @dev New view function which will return the loan data.
     * @dev This function was created to support backward compatibility
     * @dev As in we the old getActiveLoans function is not expected to be changed by the wathcers.
     *
     * @param start The lower loan ID to start with.
     * @param count The maximum number of results.
     * @param unsafeOnly The safe filter (True/False).
     *
     * @return loanData The data structure
     * @return extendedLoanData The data structure which contained (borrower & creation time)
     */
    function getActiveLoansV2(
        uint256 start,
        uint256 count,
        bool unsafeOnly
    ) external view returns (LoanReturnDataV2[] memory loansDataV2) {
        uint256 end = start.add(count).min256(activeLoansSet.length());
        if (start >= end) {
            return loansDataV2;
        }

        loansDataV2 = new LoanReturnDataV2[](count);
        uint256 itemCount;
        for (uint256 i = end - start; i > 0; i--) {
            if (itemCount == count) {
                break;
            }
            LoanReturnDataV2 memory loanDataV2 = _getLoanV2(
                activeLoansSet.get(i + start - 1), /// loanId
                0, /// loanType
                unsafeOnly
            );
            if (loanDataV2.loanId == 0) continue;

            loansDataV2[itemCount] = loanDataV2;
            itemCount++;
        }

        if (itemCount < count) {
            assembly {
                mstore(loansDataV2, itemCount)
            }
        }
    }

    /**
     * @notice Internal function to get one loan data structure.
     *
     * @param loanId A unique ID representing the loan.
     * @param loanType The type of loan.
     *   loanType 0: all loans.
     *   loanType 1: margin trade loans.
     *   loanType 2: non-margin trade loans.
     * @param unsafeOnly The safe filter (True/False).
     *
     * @return loansData The data structure w/ the loan information.
     * */
    function _getLoan(
        bytes32 loanId,
        uint256 loanType,
        bool unsafeOnly
    ) internal view returns (LoanReturnData memory loanData) {
        Loan memory loanLocal = loans[loanId];
        LoanParams memory loanParamsLocal = loanParams[loanLocal.loanParamsId];

        if (loanType != 0) {
            if (
                !((loanType == 1 && loanParamsLocal.maxLoanTerm != 0) ||
                    (loanType == 2 && loanParamsLocal.maxLoanTerm == 0))
            ) {
                return loanData;
            }
        }

        LoanInterest memory loanInterestLocal = loanInterest[loanId];

        (uint256 currentMargin, uint256 collateralToLoanRate) = IPriceFeeds(priceFeeds)
            .getCurrentMargin(
                loanParamsLocal.loanToken,
                loanParamsLocal.collateralToken,
                loanLocal.principal,
                loanLocal.collateral
            );

        uint256 maxLiquidatable;
        uint256 maxSeizable;
        if (currentMargin <= loanParamsLocal.maintenanceMargin) {
            (maxLiquidatable, maxSeizable, ) = _getLiquidationAmounts(
                loanLocal.principal,
                loanLocal.collateral,
                currentMargin,
                loanParamsLocal.maintenanceMargin,
                collateralToLoanRate
            );
        } else if (unsafeOnly) {
            return loanData;
        }

        return
            LoanReturnData({
                loanId: loanId,
                loanToken: loanParamsLocal.loanToken,
                collateralToken: loanParamsLocal.collateralToken,
                principal: loanLocal.principal,
                collateral: loanLocal.collateral,
                interestOwedPerDay: loanInterestLocal.owedPerDay,
                interestDepositRemaining: loanLocal.endTimestamp >= block.timestamp
                    ? loanLocal
                        .endTimestamp
                        .sub(block.timestamp)
                        .mul(loanInterestLocal.owedPerDay)
                        .div(86400)
                    : 0,
                startRate: loanLocal.startRate,
                startMargin: loanLocal.startMargin,
                maintenanceMargin: loanParamsLocal.maintenanceMargin,
                currentMargin: currentMargin,
                maxLoanTerm: loanParamsLocal.maxLoanTerm,
                endTimestamp: loanLocal.endTimestamp,
                maxLiquidatable: maxLiquidatable,
                maxSeizable: maxSeizable
            });
    }

    /**
     * @notice Internal function to get one loan data structure v2.
     *
     * @param loanId A unique ID representing the loan.
     * @param loanType The type of loan.
     *   loanType 0: all loans.
     *   loanType 1: margin trade loans.
     *   loanType 2: non-margin trade loans.
     * @param unsafeOnly The safe filter (True/False).
     *
     * @return loansData The data v2 structure w/ the loan information.
     * */
    function _getLoanV2(
        bytes32 loanId,
        uint256 loanType,
        bool unsafeOnly
    ) internal view returns (LoanReturnDataV2 memory loanDataV2) {
        Loan memory loanLocal = loans[loanId];
        LoanParams memory loanParamsLocal = loanParams[loanLocal.loanParamsId];

        if (loanType != 0) {
            if (
                !((loanType == 1 && loanParamsLocal.maxLoanTerm != 0) ||
                    (loanType == 2 && loanParamsLocal.maxLoanTerm == 0))
            ) {
                return loanDataV2;
            }
        }

        LoanInterest memory loanInterestLocal = loanInterest[loanId];

        (uint256 currentMargin, uint256 collateralToLoanRate) = IPriceFeeds(priceFeeds)
            .getCurrentMargin(
                loanParamsLocal.loanToken,
                loanParamsLocal.collateralToken,
                loanLocal.principal,
                loanLocal.collateral
            );

        uint256 maxLiquidatable;
        uint256 maxSeizable;
        if (currentMargin <= loanParamsLocal.maintenanceMargin) {
            (maxLiquidatable, maxSeizable, ) = _getLiquidationAmounts(
                loanLocal.principal,
                loanLocal.collateral,
                currentMargin,
                loanParamsLocal.maintenanceMargin,
                collateralToLoanRate
            );
        } else if (unsafeOnly) {
            return loanDataV2;
        }

        return
            LoanReturnDataV2({
                loanId: loanId,
                loanToken: loanParamsLocal.loanToken,
                collateralToken: loanParamsLocal.collateralToken,
                borrower: loanLocal.borrower,
                principal: loanLocal.principal,
                collateral: loanLocal.collateral,
                interestOwedPerDay: loanInterestLocal.owedPerDay,
                interestDepositRemaining: loanLocal.endTimestamp >= block.timestamp
                    ? loanLocal
                        .endTimestamp
                        .sub(block.timestamp)
                        .mul(loanInterestLocal.owedPerDay)
                        .div(86400)
                    : 0,
                startRate: loanLocal.startRate,
                startMargin: loanLocal.startMargin,
                maintenanceMargin: loanParamsLocal.maintenanceMargin,
                currentMargin: currentMargin,
                maxLoanTerm: loanParamsLocal.maxLoanTerm,
                endTimestamp: loanLocal.endTimestamp,
                maxLiquidatable: maxLiquidatable,
                maxSeizable: maxSeizable,
                creationTimestamp: loanLocal.startTimestamp
            });
    }
}
